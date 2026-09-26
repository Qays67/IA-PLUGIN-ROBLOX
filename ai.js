"use strict";

/**
 * Couche IA du site XozHub.
 *
 * - Si une clé API est fournie (AI_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY),
 *   on appelle un endpoint compatible OpenAI (chat/completions).
 * - Sinon, on reste en "mode démo" : l'IA répond avec des templates Roblox
 *   corrects pour que tout fonctionne même sans clé.
 */

const BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const API_KEY =
  process.env.AI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  "";

const SYSTEM_PROMPT = `Tu es XozHub AI, l'assistant ultime intégré à Roblox Studio via un plugin.

Tu es un expert absolu du développement Roblox :
- Luau moderne, architecture propre, code optimisé et commenté en français.
- Builds/constructions procédurales (parts, models, terrains, maps complètes).
- GUI avancées (ScreenGui, UIListLayout, animations TweenService, thèmes modernes).
- Animations (AnimationController, KeyframeSequence construits par script, TweenService).
- Gameplay systems (combat, inventaire, data saving, anti-cheat, round systems).

RÈGLES DE RÉPONSE :
1. Réponds en français, de façon claire et courte, puis donne le code.
2. Tout code doit être dans un bloc \`\`\`lua ... \`\`\` prêt à être collé dans Roblox Studio.
3. Le code doit être complet, autonome et fonctionnel dès l'insertion.
4. Quand c'est pertinent, indique en une ligne OÙ le script doit aller
   (ex: "Script serveur dans ServerScriptService", "LocalScript dans StarterGui").
5. Pour un build, écris un script qui génère la construction dans le Workspace
   (avec un Model nommé et un dossier propre).
6. Ne demande pas de clarifications inutiles : propose une version par défaut
   impressionnante, puis propose des variantes.`;

const DEMO_REPLIES = [
  {
    match: /\b(gui|interface|menu|hud|ui|inventaire visuel|shop|boutique)\b/i,
    reply: `Boom 🔥 Voici une **GUI animée moderne** ultra propre (thème sombre + effet de glow).

📁 Où le mettre : \`LocalScript\` dans \`StarterGui\`.

\`\`\`lua
-- XozHub AI - GUI animée moderne
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local player = Players.LocalPlayer

local screen = Instance.new("ScreenGui")
screen.Name = "XozHubUI"
screen.ResetOnSpawn = false
screen.IgnoreGuiInset = true
screen.Parent = player:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.fromOffset(360, 220)
frame.Position = UDim2.new(0.5, -180, 0.5, -110)
frame.BackgroundColor3 = Color3.fromRGB(22, 24, 34)
frame.BackgroundTransparency = 1
frame.BorderSizePixel = 0
frame.Parent = screen
Instance.new("UICorner", frame).CornerRadius = UDim.new(0, 16)

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(90, 130, 255)
stroke.Thickness = 1.5
stroke.Transparency = 1
stroke.Parent = frame

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -32, 0, 40)
title.Position = UDim2.new(0, 16, 0, 16)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBold
title.TextSize = 20
title.TextColor3 = Color3.fromRGB(235, 240, 255)
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "XozHub AI"
title.TextTransparency = 1
title.Parent = frame

local button = Instance.new("TextButton")
button.Size = UDim2.new(1, -32, 0, 48)
button.Position = UDim2.new(0, 16, 1, -64)
button.BackgroundColor3 = Color3.fromRGB(64, 110, 255)
button.TextColor3 = Color3.new(1, 1, 1)
button.Font = Enum.Font.GothamBold
button.TextSize = 16
button.Text = "Appuyer ici"
button.BorderSizePixel = 0
button.TextTransparency = 1
button.Parent = frame
Instance.new("UICorner", button).CornerRadius = UDim.new(0, 10)

-- Animation d'entrée
TweenService:Create(frame, TweenInfo.new(0.45, Enum.EasingStyle.Back), {
    BackgroundTransparency = 0,
}):Play()
TweenService:Create(stroke, TweenInfo.new(0.45), { Transparency = 0 }):Play()
TweenService:Create(title, TweenInfo.new(0.5), { TextTransparency = 0 }):Play()
TweenService:Create(button, TweenInfo.new(0.6), { TextTransparency = 0 }):Play()

button.MouseEnter:Connect(function()
    TweenService:Create(button, TweenInfo.new(0.2), { BackgroundColor3 = Color3.fromRGB(86, 132, 255) }):Play()
end)
button.MouseLeave:Connect(function()
    TweenService:Create(button, TweenInfo.new(0.2), { BackgroundColor3 = Color3.fromRGB(64, 110, 255) }):Play()
end)
\`\`\`

Dis-moi si tu veux la version avec boutons, inventaire ou barre de vie 💪`,
  },
  {
    match: /\b(animation|animations|anim|animer|mouvement|attaque|marche|walk)\b/i,
    reply: `Voici une **animation complète créée par script** (aucun besoin de l'éditeur d'animation).

📁 \`Script\` dans \`ServerScriptService\`.

\`\`\`lua
-- XozHub AI - Animation procédurale
local Players = game:GetService("Players")

local function playSpin(character)
    local root = character:FindFirstChild("HumanoidRootPart")
    if not root then return end
    local t = 0
    local run = game:GetService("RunService").Heartbeat:Connect(function(dt)
        t += dt
        root.CFrame *= CFrame.Angles(0, math.rad(180 * dt), 0)
        if t > 2 then run:Disconnect() end
    end)
end

Players.PlayerAdded:Connect(function(player)
    player.CharacterAdded:Connect(function(character)
        task.wait(1)
        playSpin(character)
    end)
end)
\`\`\`

Tu veux une vraie \`KeyframeSequence\` exportable, ou une anim procédurale dans ce style ?`,
  },
  {
    match: /\b(build|builds|map|maps|construction|construi|construire|b[âa]timent|maison|temple|ville|ch[âa]teau|tour|donjon|terrain|d[ée]cor|objet|mod[èe]le)\b/i,
    reply: `Voici un **builder procédural** qui génère un temple complet 🏛️

📁 \`Script\` dans \`ServerScriptService\`.

\`\`\`lua
-- XozHub AI - Generateur de temple
local Workspace = game:GetService("Workspace")

local model = Instance.new("Model")
model.Name = "TempleXozHub"
model.Parent = Workspace

local function part(size, cframe, color, shape)
    local p = Instance.new("Part")
    p.Size = size
    p.CFrame = cframe
    p.Color = color
    p.Anchored = true
    p.Material = Enum.Material.SmoothPlastic
    if shape then p.Shape = shape end
    p.Parent = model
    return p
end

-- Sol
part(Vector3.new(80, 2, 80), CFrame.new(0, 0, 0), Color3.fromRGB(210, 205, 195))

-- Colonnes
for x = -30, 30, 15 do
    for z = -30, 30, 15 do
        if math.abs(x) == 30 or math.abs(z) == 30 then
            part(Vector3.new(4, 30, 4), CFrame.new(x, 16, z), Color3.fromRGB(235, 232, 225),
                Enum.PartType.Cylinder)
        end
    end
end

-- Toit
part(Vector3.new(84, 3, 84), CFrame.new(0, 32, 0), Color3.fromRGB(180, 90, 70))
part(Vector3.new(60, 3, 60), CFrame.new(0, 36, 0), Color3.fromRGB(200, 110, 85))
part(Vector3.new(30, 3, 30), CFrame.new(0, 40, 0), Color3.fromRGB(220, 130, 100))

print("Temple genere :", #model:GetChildren(), "parts")
\`\`\`

Dis-moi le style (médiéval, futuriste, ville entière) et je te fais la version géante 🚀`,
  },
  {
    match: /\b(script|scripts|system|syst[eè]mes?|jeu|gameplay|combat|inventaire|data|sauvegarde|anti%-?triche|round|qu[êe]te)\b/i,
    reply: `Voici un **système de rounds complet** pour ton jeu 🎮

📁 \`Script\` dans \`ServerScriptService\`.

\`\`\`lua
-- XozHub AI - Systeme de rounds
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ROUND_TIME = 60
local INTERMISSION = 10

local function broadcast(text)
    for _, p in ipairs(Players:GetPlayers()) do
        local gui = p:FindFirstChild("PlayerGui")
        local label = gui and gui:FindFirstChild("RoundLabel")
        if label then label.Text = text end
    end
end

local function countdown(seconds, message)
    for t = seconds, 0, -1 do
        broadcast(message .. " " .. t .. "s")
        task.wait(1)
    end
end

task.spawn(function()
    while true do
        countdown(INTERMISSION, "Intermission:")
        countdown(ROUND_TIME, "Round en cours:")
        broadcast("Round termine !")
        task.wait(2)
    end
end)
\`\`\`

Je peux te faire la version avec équipes, scores et classement si tu veux 🏆`,
  },
];

function demoReply(userMessage) {
  for (const entry of DEMO_REPLIES) {
    if (entry.match.test(userMessage)) return entry.reply;
  }
  return `Je suis **XozHub AI**, prêt à tout construire dans ton jeu 🔥

Demande-moi par exemple :
- 🏗️ "fais-moi un temple futuriste"
- 🖥️ "crée une GUI de shop animée"
- 🎞️ "une animation d'attaque au corps à corps"
- ⚙️ "un système de combat complet"

\`\`\`lua
-- XozHub AI - exemple rapide
local part = Instance.new("Part")
part.Name = "XozHubStart"
part.Anchored = true
part.Size = Vector3.new(10, 1, 10)
part.Position = Vector3.new(0, 5, 0)
part.Parent = workspace
\`\`\`

(Essaie aussi : "gui", "animation", "build", "système" 😉)`;
}

async function callProvider(history) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Provider ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse vide du provider IA");
  return content;
}

/**
 * Génère la réponse de l'IA à partir de l'historique de la session.
 * @param {{role:string, content:string}[]} history
 * @returns {Promise<{content:string, mode:"live"|"demo", error?:string}>}
 */
async function generateReply(history) {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const userMessage = lastUser?.content || "";

  if (!API_KEY) {
    return { content: demoReply(userMessage), mode: "demo" };
  }

  try {
    const content = await callProvider(history);
    return { content, mode: "live" };
  } catch (err) {
    return {
      content: `⚠️ Impossible de joindre l'IA en direct (${err.message}).\n\nVoici une réponse générée quand même :\n\n${demoReply(userMessage)}`,
      mode: "demo",
      error: err.message,
    };
  }
}

module.exports = { generateReply, SYSTEM_PROMPT, hasApiKey: () => Boolean(API_KEY), MODEL };
