"use strict";

/* =========================================================================
   XozHub AI — logique du site (appairage + chat)
   ========================================================================= */

const $ = (id) => document.getElementById(id);

const DOM = {
  chipServer:   $("chip-server"),
  chipPair:     $("chip-pair"),
  chipChat:     $("chip-chat"),
  codeSlots:    $("code-slots"),
  pairHelp:     $("pair-help"),
  btnConnect:   $("btn-connect"),
  btnCopy:      $("btn-copy"),
  btnCopyUrl:   $("btn-copy-url"),
  serverUrl:    $("server-url"),
  footerInfo:   $("footer-info"),
  chatSub:      $("chat-sub"),
  chatLog:      $("chat-log"),
  chatQuick:    $("chat-quick"),
  chatForm:     $("chat-form"),
  chatText:     $("chat-text"),
  chatSend:     $("chat-send"),
  toast:        $("toast"),
};

const CODE_LENGTH = 6;

const state = {
  origin: "http://localhost:8787",
  token: localStorage.getItem("xozhub_token") || null,
  code: null,
  revealed: false,
  connected: false,
  serverOnline: false,
  rendered: -1,
  polling: false,
  sending: false,
  timer: null,
};

/* ------------------------------------------------------------- utils --- */

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setChip(el, kind, label) {
  if (!el) return;
  el.className = "chip chip-" + kind;
  el.innerHTML = `<i></i><span>${esc(label)}</span>`;
}

let toastTimer = null;
function toast(message) {
  DOM.toast.textContent = message;
  DOM.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove("show"), 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // repli pour les navigateurs sans permission clipboard
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function apiUrl(path) {
  const base = String(state.origin || "").replace(/\/+$/, "");
  return base + path;
}

async function api(path, options) {
  const res = await fetch(apiUrl(path), options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * La page peut être ouverte en double-cliquant sur index.html (protocole file://).
 * Dans ce cas les liens /download/... ne résolvent pas : on les redirige vers les
 * fichiers du projet, et on affiche un bandeau qui explique comment lancer le serveur.
 */
function setupFileMode() {
  const fromDisk = location.protocol === "file:";

  document.querySelectorAll("[data-download]").forEach((el) => {
    const isLua = el.dataset.download === "lua";
    if (fromDisk) {
      el.href = isLua ? "XozHubAI.plugin.lua" : "XozHubAI.rbxmx";
    } else {
      el.href = isLua ? "/download/XozHubAI.plugin.lua" : "/download/XozHubAI.rbxmx";
    }
  });

  const bar = document.getElementById("filebar");
  if (bar) bar.hidden = !fromDisk;

  return fromDisk;
}

/* ------------------------------------------------- mise en forme du texte */

function inlineHtml(text) {
  let html = esc(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, "$1<em>$2</em>");
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  return html
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function splitSegments(text) {
  const segments = [];
  const re = /```([\w+-]*)[ \t]*\n?([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) segments.push({ type: "text", value: text.slice(last, match.index) });
    segments.push({ type: "code", lang: match[1] || "lua", value: match[2].replace(/\n$/, "") });
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}

function buildCodeBlock(lang, code) {
  const wrap = document.createElement("div");
  wrap.className = "code-block";

  const bar = document.createElement("div");
  bar.className = "code-bar";

  const label = document.createElement("span");
  label.className = "code-lang";
  label.textContent = lang || "lua";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "code-copy";
  btn.textContent = "Copier";
  btn.addEventListener("click", async () => {
    if (await copyText(code)) {
      btn.textContent = "Copié ✓";
      btn.classList.add("done");
      setTimeout(() => {
        btn.textContent = "Copier";
        btn.classList.remove("done");
      }, 1600);
    }
  });

  const pre = document.createElement("pre");
  const codeEl = document.createElement("code");
  codeEl.textContent = code;
  pre.appendChild(codeEl);

  bar.append(label, btn);
  wrap.append(bar, pre);
  return wrap;
}

function buildMessage(role, content) {
  const row = document.createElement("div");
  row.className = "msg msg-" + role;

  if (role !== "system") {
    const avatar = document.createElement("span");
    avatar.className = "msg-avatar";
    avatar.textContent = role === "user" ? "Toi" : "X";
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  for (const seg of splitSegments(content)) {
    if (seg.type === "code") {
      bubble.appendChild(buildCodeBlock(seg.lang, seg.value));
    } else {
      const div = document.createElement("div");
      div.innerHTML = inlineHtml(seg.value);
      while (div.firstChild) bubble.appendChild(div.firstChild);
    }
  }

  row.appendChild(bubble);
  return row;
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "msg msg-assistant";
  row.dataset.typing = "1";
  row.innerHTML =
    '<span class="msg-avatar">X</span>' +
    '<div class="bubble"><span class="dots"><span></span><span></span><span></span></span></div>';
  DOM.chatLog.appendChild(row);
  scrollChat();
}

function clearTyping() {
  DOM.chatLog.querySelectorAll('[data-typing="1"]').forEach((n) => n.remove());
}

function scrollChat() {
  DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
}

/* ------------------------------------------------------------- code UI --- */

function renderCodeSlots() {
  DOM.codeSlots.innerHTML = "";
  const chars = state.code ? state.code.split("") : Array(CODE_LENGTH).fill("");
  for (let i = 0; i < CODE_LENGTH; i++) {
    const slot = document.createElement("div");
    slot.className = "code-slot";
    slot.textContent = chars[i] || "•";
    if (state.revealed) slot.style.animationDelay = i * 45 + "ms";
    DOM.codeSlots.appendChild(slot);
  }
  DOM.codeSlots.dataset.empty = String(!state.revealed);
  DOM.codeSlots.dataset.armed = String(state.revealed);
}

/* ------------------------------------------------------------- session --- */

async function createSession() {
  const data = await api("/api/session", { method: "POST" });
  state.token = data.token;
  state.code = data.code;
  state.rendered = -1;
  localStorage.setItem("xozhub_token", data.token);
}

async function restoreSession() {
  if (!state.token) return false;
  try {
    const data = await api(`/api/session/state?token=${state.token}&now=1`);
    state.code = data.code;
    state.connected = data.pluginConnected;
    renderMessages(data.messages || []);
    return true;
  } catch {
    state.token = null;
    localStorage.removeItem("xozhub_token");
    return false;
  }
}

/* -------------------------------------------------------------- render --- */

function renderMessages(messages) {
  for (const msg of messages) {
    if (msg.index <= state.rendered) continue;
    clearTyping();
    DOM.chatLog.appendChild(buildMessage(msg.role, msg.content));
    state.rendered = msg.index;
  }
  if (messages.length) scrollChat();
}

function updateConnection() {
  if (state.connected) {
    setChip(DOM.chipPair, "live", "Plugin connecté");
    setChip(DOM.chipChat, "live", "Connecté");
    DOM.chatSub.textContent = "Lié à Roblox Studio";
  } else if (state.revealed) {
    setChip(DOM.chipPair, "wait", "En attente du plugin");
    setChip(DOM.chipChat, "idle", "Plugin hors ligne");
    DOM.chatSub.textContent = "Écris ton code dans le plugin";
  } else {
    setChip(DOM.chipPair, "idle", "Pas encore appairé");
    setChip(DOM.chipChat, "idle", "Plugin hors ligne");
    DOM.chatSub.textContent = "Assistant Roblox Studio";
  }
}

/* ----------------------------------------------------------------- poll --- */

async function poll() {
  if (state.polling || !state.token) return;
  state.polling = true;
  try {
    const data = await api(`/api/session/state?token=${state.token}&since=${state.rendered}`);
    renderMessages(data.messages || []);

    const was = state.connected;
    state.connected = data.pluginConnected;
    if (state.connected !== was || !state.serverOnline) {
      state.serverOnline = true;
      updateConnection();
      setChip(DOM.chipServer, "live", "Serveur en ligne");
      DOM.chatSend.disabled = false;
      DOM.chatText.disabled = false;
    }
    if (state.connected && !was) {
      DOM.pairHelp.innerHTML = "✅ Plugin connecté. Va dans le chat et décris ce que tu veux construire.";
    }
  } catch (err) {
    state.serverOnline = false;
    setChip(DOM.chipServer, "err", "Serveur hors ligne");
    DOM.chatSend.disabled = true;
  } finally {
    state.polling = false;
  }
}

/* -------------------------------------------------------------- envoi --- */

async function sendMessage(text) {
  const content = String(text || "").trim();
  if (!content || state.sending) return;

  if (!state.serverOnline) {
    toast("Serveur hors ligne — lance `npm start` dans le dossier site.");
    return;
  }

  state.sending = true;
  DOM.chatSend.disabled = true;
  addTyping();

  try {
    const data = await api("/api/session/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: state.token, content }),
    });
    renderMessages(data.messages || []);
  } catch (err) {
    clearTyping();
    DOM.chatLog.appendChild(buildMessage("system", "❌ " + err.message));
    scrollChat();
  } finally {
    state.sending = false;
    DOM.chatSend.disabled = false;
    poll();
  }
}

/* --------------------------------------------------------------- boot ---- */

function observeReveals() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((n) => n.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" }
  );
  items.forEach((n) => io.observe(n));
}

function bindEvents() {
  DOM.btnConnect.addEventListener("click", async () => {
    if (state.revealed) {
      toast("Ton code est déjà affiché. Colle-le dans le plugin Roblox Studio.");
      return;
    }
    DOM.btnConnect.disabled = true;
    try {
      if (!state.token || !state.code) await createSession();
      state.revealed = true;
      renderCodeSlots();
      DOM.btnConnect.querySelector(".btn-label").textContent = "Code affiché";
      DOM.btnCopy.hidden = false;
      DOM.pairHelp.innerHTML =
        "Ouvre le plugin dans Roblox Studio, clique sur <b>Connecter</b>, saisis ce code et valide.";
      updateConnection();
      toast("Code généré — colle-le dans le plugin");
    } catch (err) {
      DOM.btnConnect.disabled = false;
      toast("Impossible de joindre le serveur");
    }
  });

  DOM.btnCopy.addEventListener("click", async () => {
    if (!state.code) return;
    toast((await copyText(state.code)) ? "Code copié" : "Copie impossible");
  });

  DOM.btnCopyUrl.addEventListener("click", async () => {
    toast((await copyText(DOM.serverUrl.value)) ? "Adresse copiée" : "Copie impossible");
  });

  DOM.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = DOM.chatText.value;
    DOM.chatText.value = "";
    sendMessage(text);
  });

  DOM.chatQuick.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-prompt]");
    if (btn) sendMessage(btn.dataset.prompt);
  });

  DOM.serverUrl.addEventListener("change", async () => {
    const value = DOM.serverUrl.value.trim().replace(/\/+$/, "") || "http://localhost:8787";
    DOM.serverUrl.value = value;
    state.origin = value;

    // nouvelle adresse : on repart d'une session propre
    state.token = null;
    state.code = null;
    state.revealed = false;
    state.rendered = -1;
    state.connected = false;
    localStorage.removeItem("xozhub_token");
    resetChatToIntro();
    renderCodeSlots();
    DOM.btnConnect.disabled = false;
    DOM.btnConnect.querySelector(".btn-label").textContent = "Générer le code";
    DOM.btnCopy.hidden = true;

    await checkServer();
    await createSession().catch(() => {});
    updateConnection();
  });
}

function resetChatToIntro() {
  [...DOM.chatLog.querySelectorAll(".msg")].slice(2).forEach((n) => n.remove());
}

async function checkServer() {
  try {
    const info = await api("/api/info");
    state.serverOnline = true;
    setChip(DOM.chipServer, "live", "Serveur en ligne");
    DOM.footerInfo.textContent = `serveur ${state.origin} · IA ${info.aiMode} · ${info.model}`;
    DOM.chatSend.disabled = false;
    DOM.chatText.disabled = false;
    return true;
  } catch {
    state.serverOnline = false;
    setChip(DOM.chipServer, "err", "Serveur hors ligne");
    DOM.footerInfo.textContent = `serveur injoignable sur ${state.origin} — lance start.bat (Windows) ou npm start`;
    DOM.chatSend.disabled = true;
    return false;
  }
}

async function boot() {
  observeReveals();
  bindEvents();

  // adresse du serveur : même origine si la page est servie, sinon localhost
  const fromDisk = setupFileMode();
  state.origin = location.protocol.startsWith("http")
    ? location.origin
    : "http://localhost:8787";
  DOM.serverUrl.value = state.origin;

  renderCodeSlots();

  if (fromDisk) {
    DOM.footerInfo.textContent =
      `page ouverte depuis le disque — serveur attendu sur ${state.origin}`;
  }

  await checkServer();

  if (!fromDisk) await restoreSession();

  updateConnection();
  poll();
  clearInterval(state.timer);
  state.timer = setInterval(poll, 1200);
}

boot();
