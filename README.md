# XozHub AI

Un assistant IA pour **Roblox Studio** : un plugin en forme de petit panneau, un site pour
l'appairer, et une IA qui génère builds, scripts Luau, GUI et animations — puis les insère
directement dans ton jeu.

Le projet est séparé en deux :

```
.
├── start.bat                   ← lanceur Windows (double-clic)
│
├── plugin/                     ← le plugin Roblox Studio (Luau)
│   ├── src/XozHubAI.plugin.lua
│   └── build/XozHubAI.rbxmx    ← généré, c'est ce fichier qu'on installe
│
└── site/                       ← le site + le serveur IA
    ├── start.bat               ← lanceur Windows (double-clic)
    ├── start.sh                ← lanceur macOS / Linux
    ├── server.js               ← serveur + API d'appairage
    ├── ai.js                   ← couche IA (provider ou mode démo)
    ├── public/                 ← l'interface (HTML/CSS/JS, zéro dépendance)
    │   ├── index.html
    │   ├── styles.css
    │   └── app.js
    └── tools/build-plugin.js
```

---

## 1. Démarrer le site

**Le plus simple : double-clique sur `start.bat`** (Windows) — le navigateur s'ouvre tout seul sur
http://localhost:8787.

Sinon, en ligne de commande :

```bash
cd site
npm start          # ou : ./start.sh
```

Puis ouvre **http://localhost:8787**.

> ⚠️ **N'ouvre jamais `site/public/index.html` en double-cliquant dessus.**
> Tu verrais la page sans son design (les chemins `/styles.css` et `/app.js` ne résolvent pas en
> `file://`) et l'IA ne pourrait pas fonctionner : tout passe par le serveur.
> Passe toujours par `http://localhost:8787`. Si tu ouvres quand même le fichier directement, un
> bandeau jaune te le rappelle en haut de page.

Sans clé API, l'IA tourne en **mode démo** (réponses Roblox correctes pré-écrites).
Pour brancher une vraie IA, il suffit de définir des variables d'environnement :

```bash
# n'importe quel endpoint compatible OpenAI
export AI_API_KEY="sk-..."
export AI_BASE_URL="https://api.openai.com/v1"   # ou OpenRouter, Groq, local…
export AI_MODEL="gpt-4o-mini"
npm start
```

---

## 2. Installer le plugin

1. Sur le site, clique sur **Télécharger le plugin** (ou ouvre
   `http://localhost:8787/download/XozHubAI.rbxmx`).
2. Dans Roblox Studio : **Explorer → clic droit → Insert from File…** → choisis `XozHubAI.rbxmx`.
3. Clic droit sur le script `XozHubAI` → **Save as Local Plugin**.
4. Le bouton **XozHub AI** apparaît dans la barre d'outils (onglet *Plugins*).

> Autre méthode : crée un `Script` dans Studio, colle le contenu de
> `plugin/src/XozHubAI.plugin.lua`, puis **Save as Local Plugin**.

---

## 3. Appairer

1. Sur le site, section **Connecter le plugin** → clique sur **Générer le code**.
2. Un code à 6 caractères s'affiche.
3. Dans le plugin : vérifie l'adresse du serveur (`http://localhost:8787`),
   tape le code, clique sur **Connecter**.
4. Le badge passe au vert des deux côtés. Tu peux discuter.

Tu peux écrire depuis le site **ou** depuis le panneau Studio : c'est la même conversation.

---

## 4. Utiliser l'IA

Décris ce que tu veux :

- « construis un temple futuriste dans le Workspace »
- « fais-moi une GUI de shop sombre et animée »
- « un système de combat avec dégâts et cooldown »
- « une animation d'attaque au corps à corps »

Chaque bloc `lua` de la réponse affiche un bouton **Insérer** : un clic crée le script au bon
endroit (ServerScriptService, StarterGui ou sur ta sélection active), le sélectionne et l'ouvre
dans l'éditeur.

---

## Regénérer le `.rbxmx` après une modif du plugin

```bash
cd site
npm run build:plugin
```

Le fichier généré est `plugin/build/XozHubAI.rbxmx`.

---

## API du serveur

| Méthode | Route                     | Rôle                                   |
| ------- | ------------------------- | -------------------------------------- |
| `POST`  | `/api/session`            | Crée une session → `{ code, token }`   |
| `GET`   | `/api/session/state`      | État + messages (long-poll)            |
| `POST`  | `/api/session/message`    | Message envoyé depuis le site          |
| `POST`  | `/api/plugin/connect`     | Appairage du plugin avec le code       |
| `GET`   | `/api/plugin/poll`        | Heartbeat + récupération des messages  |
| `POST`  | `/api/plugin/message`     | Message envoyé depuis le plugin        |
| `POST`  | `/api/plugin/disconnect`  | Déconnexion du plugin                  |
| `GET`   | `/api/info`               | Mode IA, modèle, nombre de sessions    |

---

## Notes

- Le plugin fait des requêtes HTTP locales via `HttpService`. Si Studio bloque, autorise les
  plugins HTTP dans **Game Settings → Security → Allow HTTP Requests**.
- Les sessions expirent au bout de 2 heures.
- Rien n'est envoyé à l'extérieur : le serveur tourne sur ta machine. Seul le message de
  l'utilisateur part vers le fournisseur d'IA si tu as configuré une clé API.
