#set page(paper: "a4", margin: (x: 2cm, y: 2cm))
#set text(font: "Linux Libertine", lang: "fr")
#set heading(numbering: "1.")

#align(center)[
  #text(size: 24pt, weight: "bold")[Récapitulatif Snyk — CYNA]
  
  #v(1em)
  Auteur: Equipe sécurité \
  Date: 29 mai 2026
]

#line(length: 100%)

= Résumé exécutif

Ce rapport rassemble toutes les opérations effectuées pour intégrer Snyk (Open Source, Code, Container) dans le projet, les scans effectués, les erreurs rencontrées, les modifications appliquées et les recommandations opérationnelles. 

#v(1em)
*Légende des severités*
- #text(fill: red, weight: "bold")[CRITICAL]
- #text(fill: orange, weight: "bold")[HIGH]
- #text(fill: yellow.darken(20%), weight: "bold")[MEDIUM]
- #text(fill: gray, weight: "bold")[LOW]

#line(length: 100%)

= Actions réalisées

+ Installation et authentification de la CLI Snyk localement (`snyk auth`).
+ Scans initiaux : Backend `api` OK (0 faille) / Frontend `web` : ~30 vulnérabilités.
+ Synchronisation `package-lock.json` (`cd web && npm install`).
+ Upgrades ciblées initiales : `axios` #sym.arrow `^1.15.2`, `express` #sym.arrow `^4.22.2`.
+ Upgrades critiques finalisées : `multer` #sym.arrow `2.1.1` et `overrides` NPM pour `picomatch` (`^2.3.2`).
+ Politique d'exception : création d'un fichier `.snyk` via `snyk ignore` pour la faille `xlsx` (ReDoS sans correctif partagé disponible publiquement).
+ Réscan et validation locale : 0 faille Critical/High détectée !
+ Envoi de snapshots : `snyk monitor` (api + web).
+ Ajout de CI GitHub : `.github/workflows/security.yml` (Snyk OSS/Code/Container).
+ Opt-in Node 24 pour Actions : ajout de `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` dans les workflows.
+ Gestion Git : Déplacement des modifications vers la branche `clement-dev`, résolution des conflits et push sur le dépôt.

= Fichiers modifiés / ajoutés

- `web/package.json` (bump `axios`, `express`, `multer` — ajout clause `overrides` pour `picomatch`).
- `web/package-lock.json` (regénéré).
- `web/.snyk` (règles de bypass documentées).
- `web/snyk-web.json` (exports Snyk JSON initiaux).
- `.github/workflows/security.yml` (nouveau pipeline Snyk).
- `.github/workflows/ci.yml` (opt-in Node24).
- `SNYK_RECAP.typ` et documents associés.
- `DCT_Section_4.3_Snyk.md` (section pour le Document de Conception Technique).

= Résultats détaillés — Frontend `web`

*Bilan final (après les correctifs multters, picomatch et xlsx)* :
- #text(fill: red)[CRITICAL] : 0
- #text(fill: orange)[HIGH] : 0
- #text(fill: yellow.darken(20%))[MEDIUM] : 1 (limitée par exemption justifiée pour `xlsx`)
- #text(fill: gray)[LOW] : 0

*Toutes les failles prioritaires liées à `multer` (Uncontrolled Recursion/DoS) et `picomatch` (ReDoS) ont été corrigées avec succès.*

= Résumé Backend `api`

- `snyk test --all-projects` a analysé 62 dépendances — aucun chemin vulnérable trouvé.
- `snyk monitor --all-projects` envoyé pour historisation.

= Exemples Avant / Après (code)

== 1. Injection SQL 
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

== 2. Authentification
*#text(fill: red)[❌ AVANT (vulnérable)]*
```js
router.post('/login', async (req, res) => {
const { email, password } = req.body;
const result = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
// Logging du mot de passe en clair + cryptographie faible
});
```

*#text(fill: green)[✅ APRÈS — Corrections de sécurité]*
```js
router.post('/login', async (req, res) => {
const { email, password } = req.body;
// 1) Requête paramétrée : prémunir des SQL Injecton
const result = await db.query('SELECT id, password_hash, role FROM users WHERE email = $1', [email]);
// 2) Ne pas logguer les mots de passe
// 3) Hasher/Comparer avec Bcrypt/Argon2
});
```

== 3. Dépendances Transitifs (package.json)
*#text(fill: red)[❌ AVANT — Risques de DoS, ReDoS et Faille Critique]*
```json
{
"dependencies": {
"multer": "^1.4.5-lts.2" // Présence de faille Uncontrolled Recursion / DoS
// Et picomatch v2.3.1 (faille ReDoS) appelé par des paquets tiers
}
}
```

*#text(fill: green)[✅ APRÈS — Upgrades et clauses Overrides]*
```json
{
"dependencies": {
"multer": "^2.1.1"       // Fix CVE : Upgrade vers la branche 2.x sécurisée
},
"overrides": {
"picomatch": "^2.3.2"    // Fix ReDoS : Forçage d'une version saine globalement
}
}
```

= Docker & Container — recommandations

- Image recommandée pour production : `node:20-alpine` (taille réduite, moins de CVE) ou `distroless` pour surface minimale.
- Dockerfile sécurisé : multi-stage build, utilisateur non-root, copier uniquement `node_modules` et code nécessaire, healthcheck.

= CI / GitHub Actions — détails

- Nouveau workflow ajouté : `.github/workflows/security.yml` (jobs : Snyk OSS, Snyk Code, Snyk Container).
- Protection du main : Gate de sécurité active #sym.arrow tout build échouera (fail-on-policy) si des failles HIGH/CRITICAL sont découvertes.

= Prochaines étapes recommandées

+ Tester intensivement le module d'upload (la migration de `multer` vers la version 2.1.1 pouvant introduire de légers _breaking changes_ d'API).
+ Mettre en place un plan de traitement définitif pour le paquet `xlsx` lorsqu'un correctif sera officialisé (actuellement ignoré formellement).
