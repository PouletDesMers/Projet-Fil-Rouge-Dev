## 4.3 Analyse de vulnérabilités (Snyk)

Dans le cadre de la sécurisation continue (DevSecOps), l'outil **Snyk** a été intégré au projet CYNA afin d'identifier, corriger et monitorer les vulnérabilités liées aux dépendances (Snyk Open Source), au code source (Snyk Code - SAST), et aux conteneurs (Snyk Container).

### 4.3.1 Stratégie et Intégration CI/CD
L'intégration de Snyk repose sur une _Security Gate_ automatisée implantée via GitHub Actions (`.github/workflows/security.yml`).
- **Politique (Fail-on-policy) :** Le pipeline est configuré avec l'argument `--severity-threshold=high`. Toute vulnérabilité classée *High* ou *Critical* fait systématiquement échouer le build, empêchant le déploiement de code non sécurisé.
- **Résultats SARIF/JSON :** Les rapports de scan sont exportés en JSON (Artifacts) et en SARIF (Intégration via GitHub CodeQL) pour le suivi technique de la dette de sécurité.

### 4.3.2 Snyk Open Source (SCA)
Une campagne d'assainissement a été menée pour traiter et mitiger les failles critiques et hautes provenant de l'écosystème Node.js (frontend/backend-proxy) et Go (API). 
* **Backend (API Go) :** `snyk test` valide avec succès qu'aucun chemin vulnérable n'est présent parmi les librairies manipulées.
* **Web (Node.js) :** 
  * Majoration de dépendances clefs telles que `axios`, `express` et `multer` (mise à jour critique vers la v2.1.1 pour corriger plusieurs failles d'Uncontrolled Recursion / DoS).
  * Implémentation de résolutions spécifiques (`overrides`) pour mitiger le risque transitif (ex: `picomatch` ReDoS).
  * Utilisation d'exceptions formelles documentées (`.snyk` / ignore) pour justifier l'acceptation temporaire de risques quand aucun correctif d'éditeur n'est disponible sur le dépôt (ex. `xlsx` ReDoS).

Au terme de l'audit et des actions correctives, la validation locale et d'intégration continue assure **0 faille de niveau High ou Critical**.

### 4.3.3 Snyk Code (SAST)
Snyk Code scanne le code propriétaire du projet à la recherche de patrons vulnérables (ex: Injections SQL, Hardcoded Secrets).
*(Note opérationnelle : requiert au préalable l'activation de la fonctionnalité Snyk Code SAST depuis le portail d'organisation Snyk Settings).*

### 4.3.4 Snyk Container & Environnement d'exécution
Le pipeline scanne l'image applicative (Dockerfile) au moment du build. La stratégie recommande l'usage d'images socles minimalistes (ex: `node:20-alpine` ou images chaînées `distroless`) et l'exclusion formelle de l'accès `root` pour limiter la surface d'attaque en production.
