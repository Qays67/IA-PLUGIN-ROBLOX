"use strict";

/**
 * XozHub AI — serveur du site + backend du plugin Roblox Studio.
 *
 * Flux d'appairage :
 *  1. Le site appelle POST /api/session  -> reçoit { code, token }
 *  2. L'utilisateur tape ce code dans le plugin Roblox Studio
 *  3. Le plugin appelle POST /api/plugin/connect { code }
 *  4. Les deux côtés échangent via polling sur la même session
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { generateReply, hasApiKey, MODEL } = require("./ai");

const PORT = Number(process.env.PORT || 8787);
const ROOT_DIR = __dirname;
const PLUGIN_FILE = path.join(ROOT_DIR, "XozHubAI.rbxmx");
const PLUGIN_SOURCE = path.join(ROOT_DIR, "XozHubAI.plugin.lua");

// Liste blanche des fichiers servis au navigateur.
// Volontairement explicite : server.js et ai.js ne doivent jamais être téléchargeables.
const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
]);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const PLUGIN_TIMEOUT_MS = 12000;
const WAIT_TIMEOUT_MS = 25000;

/** @type {Map<string, Session>} */
const sessions = new Map();

function makeCode() {
  let code;
  do {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  } while (sessions.has(code));
  return code;
}

function createSession() {
  const code = makeCode();
  const session = {
    code,
    token: crypto.randomBytes(24).toString("hex"),
    createdAt: Date.now(),
    plugin: { connected: false, lastSeen: 0, name: "" },
    messages: [],
    waiters: new Set(),
    busy: false,
  };
  sessions.set(code, session);
  return session;
}

function normalizeCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

function pluginOnline(session) {
  return session.plugin.connected && Date.now() - session.plugin.lastSeen < PLUGIN_TIMEOUT_MS;
}

function pushMessage(session, role, content) {
  const message = {
    index: session.messages.length,
    role,
    content,
    at: Date.now(),
  };
  session.messages.push(message);
  flushWaiters(session);
  return message;
}

function flushWaiters(session) {
  for (const waiter of session.waiters) {
    clearTimeout(waiter.timer);
    waiter.resolve();
  }
  session.waiters.clear();
}

function waitForChange(session, timeout = WAIT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const waiter = { resolve, timer: null };
    waiter.timer = setTimeout(() => {
      session.waiters.delete(waiter);
      resolve();
    }, timeout);
    session.waiters.add(waiter);
  });
}

/** Lance la génération IA sur un message utilisateur, puis ajoute la réponse. */
async function handleUserMessage(session, content) {
  pushMessage(session, "user", content);
  if (session.busy) return;
  session.busy = true;
  try {
    const history = session.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    const { content: reply, mode } = await generateReply(history);
    pushMessage(session, "assistant", reply);
    if (mode === "demo") session.messages.at(-1).demo = true;
  } catch (err) {
    pushMessage(session, "assistant", `❌ Erreur de génération : ${err.message}`);
  } finally {
    session.busy = false;
    flushWaiters(session);
  }
}

// ---------------------------------------------------------------- helpers ---

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error("Payload trop volumineux"));
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("JSON invalide"));
      }
    });
    req.on("error", reject);
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".rbxmx": "application/xml",
  ".lua": "text/plain; charset=utf-8",
};

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: "Introuvable" });
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

function findSessionByCode(code) {
  return sessions.get(normalizeCode(code)) || null;
}

function findSessionByToken(token) {
  for (const session of sessions.values()) {
    if (session.token === token) return session;
  }
  return null;
}

function sessionState(session) {
  return {
    code: session.code,
    pluginConnected: pluginOnline(session),
    pluginName: session.plugin.name,
    busy: session.busy,
    messages: session.messages,
  };
}

// ------------------------------------------------------------------ routes ---

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method || "GET";

  // --- Site : création de session -----------------------------------------
  if (pathname === "/api/session" && method === "POST") {
    const session = createSession();
    return sendJson(res, 200, { code: session.code, token: session.token });
  }

  // --- Site : état complet (long-poll) ------------------------------------
  if (pathname === "/api/session/state" && method === "GET") {
    const session = findSessionByToken(url.searchParams.get("token"));
    if (!session) return sendJson(res, 404, { error: "Session expirée" });
    const since = Number(url.searchParams.get("since") || -1);
    if (session.messages.length <= since + 1 && !url.searchParams.has("now")) {
      await waitForChange(session);
    }
    return sendJson(res, 200, sessionState(session));
  }

  // --- Site : envoi d'un message ------------------------------------------
  if (pathname === "/api/session/message" && method === "POST") {
    const body = await readBody(req);
    const session = findSessionByToken(body.token);
    if (!session) return sendJson(res, 404, { error: "Session expirée" });
    const content = String(body.content || "").trim();
    if (!content) return sendJson(res, 400, { error: "Message vide" });
    await handleUserMessage(session, content);
    return sendJson(res, 200, sessionState(session));
  }

  // --- Plugin : connexion avec le code ------------------------------------
  if (pathname === "/api/plugin/connect" && method === "POST") {
    const body = await readBody(req);
    const session = findSessionByCode(body.code);
    if (!session) return sendJson(res, 404, { error: "Code invalide. Vérifie le code affiché sur le site." });
    session.plugin.connected = true;
    session.plugin.lastSeen = Date.now();
    session.plugin.name = String(body.name || "Roblox Studio").slice(0, 60);
    pushMessage(session, "system", `✅ Plugin Roblox Studio connecté (${session.plugin.name}).`);
    return sendJson(res, 200, { ok: true, code: session.code, messages: session.messages.length });
  }

  // --- Plugin : déconnexion ------------------------------------------------
  if (pathname === "/api/plugin/disconnect" && method === "POST") {
    const body = await readBody(req);
    const session = findSessionByCode(body.code);
    if (session) {
      session.plugin.connected = false;
      pushMessage(session, "system", "🔌 Plugin déconnecté.");
    }
    return sendJson(res, 200, { ok: true });
  }

  // --- Plugin : heartbeat + récupération des messages (long-poll) ---------
  if (pathname === "/api/plugin/poll" && method === "GET") {
    const session = findSessionByCode(url.searchParams.get("code"));
    if (!session) return sendJson(res, 404, { error: "Code invalide" });
    session.plugin.connected = true;
    session.plugin.lastSeen = Date.now();

    const since = Number(url.searchParams.get("since") || 0);
    if (session.messages.length <= since) {
      await waitForChange(session, 20000);
      session.plugin.lastSeen = Date.now();
    }

    return sendJson(res, 200, {
      ok: true,
      connected: true,
      siteOnline: true,
      busy: session.busy,
      messages: session.messages.filter((m) => m.index >= since),
      total: session.messages.length,
    });
  }

  // --- Plugin : envoi d'un message ----------------------------------------
  if (pathname === "/api/plugin/message" && method === "POST") {
    const body = await readBody(req);
    const session = findSessionByCode(body.code);
    if (!session) return sendJson(res, 404, { error: "Code invalide" });
    session.plugin.lastSeen = Date.now();
    const content = String(body.content || "").trim();
    if (!content) return sendJson(res, 400, { error: "Message vide" });
    await handleUserMessage(session, content);
    return sendJson(res, 200, { ok: true, total: session.messages.length });
  }

  // --- Infos serveur --------------------------------------------------------
  if (pathname === "/api/info" && method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      aiMode: hasApiKey() ? "live" : "demo",
      model: hasApiKey() ? MODEL : "démo intégrée",
      sessions: sessions.size,
    });
  }

  return sendJson(res, 404, { error: "Route inconnue" });
}

// ------------------------------------------------------------------ server ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // CORS (utile si le site est servi ailleurs)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url);
    }

    // Téléchargement du plugin
    if (url.pathname === "/download/XozHubAI.rbxmx") {
      return serveStatic(res, PLUGIN_FILE);
    }
    if (url.pathname === "/download/XozHubAI.plugin.lua") {
      return serveStatic(res, PLUGIN_SOURCE);
    }

    // Fichiers statiques du site (liste blanche)
    const asset = STATIC_FILES.get(url.pathname);
    if (asset) {
      return serveStatic(res, path.join(ROOT_DIR, asset));
    }

    return sendJson(res, 404, { error: "Introuvable" });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
});

// Nettoyage des vieilles sessions (2h)
setInterval(() => {
  const limit = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, session] of sessions) {
    if (session.createdAt < limit) sessions.delete(code);
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log("");
  console.log("  ╭──────────────────────────────────────────╮");
  console.log("  │            XozHub AI  —  serveur          │");
  console.log("  ╰──────────────────────────────────────────╯");
  console.log(`   Site      :  http://localhost:${PORT}`);
  console.log(`   Plugin    :  http://localhost:${PORT}/download/XozHubAI.rbxmx`);
  console.log(`   Mode IA   :  ${hasApiKey() ? `live (${MODEL})` : "démo intégrée (pas de clé API)"}`);
  console.log("");
});
