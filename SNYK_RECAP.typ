#set page(paper: "a4", margin: (x: 2cm, y: 2cm))
#set text(font: "Linux Libertine", lang: "fr")
#set heading(numbering: "1.")

#align(center)[
  #text(size: 24pt, weight: "bold")[Récapitulatif Snyk — CYNA]
  
  #v(1em)
  Auteur: Equipe sécurité   Date: 29 mai 2026
]

#line(length: 100%)

= Résumé exécutif

Ce rapport rassemble toutes les opérations effectuées pour intégrer Snyk (Open Source, Code, Container) dans le projet, les scans effectués, les erreurs rencontrées, les modifications appliquées et les recommandations opérationnelles. Les sections suivantes présentent :

- un historique des actions et commits effectués ;
- les résultats clefs des scans (frontend/backend) ;
- des exemples "Avant / Après" montrant le code vulnérable et la correction recommandée ;
- la liste détaillée des fichiers modifiés et commandes utiles ;
- recommandations Docker & CI.

#v(1em)
*Légende des severités*
- #text(fill: red, weight: "bold")[CRITICAL]
- #text(fill: orange, weight: "bold")[HIGH]
- #text(fill: yellow.darken(20%), weight: "bold")[MEDIUM]
- #text(fill: gray, weight: "bold")[LOW]

#line(length: 100%)

= Actions réalisées

+ Installation et authentification de la CLI Snyk localement (`snyk auth`).
+ Scans initiaux :
  - Frontend `web` : `npx snyk test` #sym.arrow résultats détaillés sauvegardés.
  - Backend `api` : `npx snyk test --all-projects` #sym.arrow OK (aucun chemin vulnérable).
+ Synchronisation `package-lock.json` (`cd web && npm install`).
+ Upgrades ciblées : `axios` #sym.arrow `^1.15.2`, `express` #sym.arrow `^4.22.2`.
+ Réscan et export JSON (`npx snyk test --json > web/snyk-web-after.json`).
+ Envoi de snapshots : `snyk monitor` (api + web).
+ Ajout de CI GitHub : `.github/workflows/security.yml` (Snyk OSS/Code/Container).
+ Opt-in Node 24 pour Actions : ajout de `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` dans les workflows.
+ Gestion Git : déplacement des modifications vers la branche `clement-dev`, résolution des conflits et push.

= Fichiers modifiés / ajoutés

- `web/package.json` (bump `axios`, `express` — préservation `express-rate-limit`, `helmet`).
- `web/package-lock.json` (regénéré).
- `web/snyk-web.json` / `web/snyk-web-after.json` (exports Snyk JSON).
- `.github/workflows/security.yml` (nouveau pipeline Snyk).
- `.github/workflows/ci.yml` (opt-in Node24).
- `SNYK_RECAP.adoc`, `SNYK_RECAP.md`, `SNYK_RECAP.typ` (rapports générés).

= Erreurs rencontrées et résolution

== `npm install -g snyk` #sym.arrow EACCES (permission denied)
*Cause* : tentative d'installation globale sans droits root vers `/usr/lib/node_modules/`.

*Action* :
- option rapide : `sudo npm install -g snyk` (si acceptable),
- option safe : `npm config set prefix '~/.npm-global'` et ajouter `~/.npm-global/bin` au `PATH`,
- usage recommandé : `nvm` pour gérer Node sans sudo.

*Log (extrait)* :
```text
npm error code EACCES
Error: EACCES: permission denied, mkdir '/usr/lib/node_modules/snyk'
```

== `npx snyk test` (web) #sym.arrow package-lock out of sync
*Problème détecté* : `csv-parse@^5.6.0` absent du `package-lock.json`. *Solution* : `cd web && npm install` puis `npx snyk test`.

= Résultats détaillés — Frontend `web`

- Avant corrections : ~30 vulnérabilités détectées.
- Après `axios`/`express` upgrade : 12 vulnérabilités restantes :
- #text(fill: red)[CRITICAL] : 1
- #text(fill: orange)[HIGH] : 8
- #text(fill: yellow.darken(20%))[MEDIUM] : 3
- #text(fill: gray)[LOW] : 0

Ces vulnérabilités sont principalement introduites par : `multer` (uploads), `picomatch` (transitivement), `path-to-regexp`.

*Recommandation prioritaire* : migrer `multer` vers `^2.x` (breaking change) et auditer tous les points d'upload (validation, timeouts, file limits, gestion d'erreurs).

= Résumé Backend `api`

- `snyk test --all-projects` a analysé 62 dépendances — aucun chemin vulnérable trouvé.
- `snyk monitor --all-projects` envoyé pour historisation.

= Exemples Avant / Après (code)

== Injection SQL
*#text(fill: red)[❌ AVANT — Injection SQL possible]*
```js
app.get('/products/:category', async (req, res) => {
const category = req.params.category;
const result = await db.query(
`SELECT * FROM products WHERE category = '${category}'`
);
res.json(result.rows);
});
```

*#text(fill: green)[✅ APRÈS — Requête paramétrée]*
```js
app.get('/products/:category', async (req, res) => {
const category = req.params.category;
const result = await db.query(
'SELECT * FROM products WHERE category = $1',
[category]
);
res.json(result.rows);
});
```

== Authentification
*#text(fill: red)[❌ AVANT (extrait vulnérable volontaire)]*
```js
router.post('/login', async (req, res) => {
const { email, password } = req.body;
const result = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
// logging du mot de passe + token créé avec secret en dur etc.
});
```

*#text(fill: green)[✅ APRÈS — corrections appliquées]*
```js
router.post('/login', async (req, res) => {
const { email, password } = req.body;
// Requête paramétrée
const result = await db.query('SELECT id, password_hash, role FROM users WHERE email = $1', [email]);
// CompareHash, ne loggez pas les passwords
// Sign JWT avec process.env.JWT_SECRET, expiration et algo HS256
});
```

= Docker & Container — recommandations

- Image recommandée pour production : `node:20-alpine` (taille réduite, moins de CVE) ou `distroless` pour surface minimale.
- Dockerfile sécurisé : multi-stage build, utilisateur non-root, copier uniquement `node_modules` et code nécessaire, healthcheck.

= CI / GitHub Actions — détails

- Nouveau workflow ajouté : `.github/workflows/security.yml` (jobs : Snyk OSS, Snyk Code, Snyk Container).
- Ajout de l'env global `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` pour anticiper la dépréciation Node20 sur runners.
- Important : ajouter le secret `SNYK_TOKEN` dans GitHub pour activer `snyk monitor`, tagging de projet et politiques org.

= Commandes utiles (reproduction)

```sh
# Frontend
cd web
npm install
npx snyk test --json > snyk-web-after.json
snyk monitor

# Backend
cd ../api
npx snyk test --all-projects
snyk monitor --all-projects
```

= Prochaines étapes recommandées

+ Migrer `multer` vers `^2.x` et adapter le code d'upload ; ajouter tests d'intégration.
+ Mettre en place une job CI pour `snyk monitor` afin d'historiser automatiquement.
+ Créer PRs pour les changements majeurs et activer gating (Snyk fail-on-policy pour `high`/`critical`).
