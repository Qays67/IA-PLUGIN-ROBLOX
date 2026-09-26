# XozHub AI

Un assistant IA pour **Roblox Studio** : un plugin en forme de petit panneau, un site pour
l'appairer, et une IA qui génère builds, scripts Luau, GUI et animations — puis les insère
directement dans ton jeu.

---

## Contenu du dossier

Tout est à plat, sans sous-dossier.

| Fichier | Rôle |
| --- | --- |
| `start.bat` | **Lanceur Windows — double-clique dessus.** Démarre le serveur et ouvre le navigateur. |
| `start.sh` | Lanceur macOS / Linux |
| `index.html` | Le site (page d'installation + connexion + chat) |
| `styles.css` | Le design du site |
| `app.js` | La logique du site (appairage, chat, copie de code) |
| `server.js` | Le serveur : sessions, code d'appairage, relais des messages |
| `ai.js` | La couche IA (provider compatible OpenAI, ou mode démo sans clé) |
| `package.json` | Scripts `npm start` et `npm run build:plugin` |
| `build-plugin.js` | Génère `XozHubAI.rbxmx` à partir du `.lua` |
| `XozHubAI.plugin.lua` | Le plugin Roblox Studio (code source Luau) |
| `XozHubAI.rbxmx` | **C'est ce fichier qu'on installe dans Roblox Studio** |

---

## 1. Démarrer le site

**Le plus simple : double-clique sur `start.bat`.** Le serveur démarre et le navigateur s'ouvre
tout seul sur http://localhost:8787. Laisse la fenêtre noire ouverte : c'est le serveur.

En ligne de commande, si tu préfères :

```bash
npm start        # ou : ./start.sh
```

> ⚠️ **N'ouvre jamais `index.html` en double-cliquant dessus.**
> La page s'afficherait (un bandeau jaune te le dirait), mais l'IA a besoin du serveur pour
> fonctionner : les sessions et les messages passent par lui. Passe toujours par
> **http://localhost:8787**.

Sans clé API, l'IA tourne en **mode démo** : des réponses Roblox complètes et correctes sont
renvoyées, tu peux tout tester. Pour brancher une vraie IA, définis des variables
d'environnement avant de lancer :

```bash
# n'importe quel endpoint compatible OpenAI
export AI_API_KEY="sk-..."                       # Windows : set AI_API_KEY=sk-...
export AI_BASE_URL="https://api.openai.com/v1"   # OpenRouter, Groq, Ollama…
export AI_MODEL="gpt-4o-mini"
npm start
```

---

## 2. Installer le plugin

1. Sur le site, clique sur **Télécharger le plugin** (section *Installation*).
2. Dans Roblox Studio : **Explorer → clic droit → Insert from File…** → choisis `XozHubAI.rbxmx`.
3. Clic droit sur le script `XozHubAI` → **Save as Local Plugin**.
4. Le bouton **XozHub AI** apparaît dans la barre d'outils (onglet *Plugins*).

> Autre méthode : crée un `Script` dans Studio, colle le contenu de `XozHubAI.plugin.lua`,
> puis **Save as Local Plugin**.

---

## 3. Appairer

1. Sur le site, section **Connecter le plugin** → clique sur **Générer le code**.
2. Un code à 6 caractères s'affiche.
3. Dans le plugin : vérifie l'adresse (`http://localhost:8787`), tape le code, clique sur
   **Connecter**.
4. Les deux badges passent au vert. Tu peux discuter.

Tu peux écrire depuis le site **ou** depuis le panneau Studio : c'est la même conversation.

---

## 4. Utiliser l'IA

Décris ce que tu veux :

- « construis un temple futuriste dans le Workspace »
- « fais-moi une GUI de shop sombre et animée »
- « un système de combat avec dégâts et cooldown »
- « une animation d'attaque au corps à corps »

Chaque bloc `lua` de la réponse affiche un bouton **Insérer** : un clic crée le script au bon
endroit (ServerScriptService, StarterGui, ou sur ta sélection active), le sélectionne et
l'ouvre dans l'éditeur.

---

## Modifier le plugin

Après avoir édité `XozHubAI.plugin.lua`, régénère le `.rbxmx` :

```bash
npm run build:plugin
```

---

## API du serveur

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/api/session` | Crée une session → `{ code, token }` |
| `GET` | `/api/session/state` | État + messages (long-poll) |
| `POST` | `/api/session/message` | Message envoyé depuis le site |
| `POST` | `/api/plugin/connect` | Appairage du plugin avec le code |
| `GET` | `/api/plugin/poll` | Heartbeat + récupération des messages |
| `POST` | `/api/plugin/message` | Message envoyé depuis le plugin |
| `POST` | `/api/plugin/disconnect` | Déconnexion du plugin |
| `GET` | `/api/info` | Mode IA, modèle, nombre de sessions |

---

## Notes

- Le plugin fait des requêtes HTTP locales via `HttpService`. Si Studio bloque, autorise les
  plugins HTTP dans **Game Settings → Security → Allow HTTP Requests**.
- Les sessions expirent au bout de 2 heures.
- Rien n'est envoyé à l'extérieur : le serveur tourne sur ta machine. Seul le message de
  l'utilisateur part vers le fournisseur d'IA si tu as configuré une clé API.
