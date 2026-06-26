# Checklist securite

Date: 27 avril 2026
Perimetre: API Go, serveur web Node, documentation securite

## Deja fait (constate lors du premier audit)

- [x] 2FA TOTP present et fonctionnel cote API Go.
- [x] Mots de passe haches avec bcrypt.
- [x] Rate limiting present cote API Go.
- [x] Headers HTTP de securite presents cote API Go.
- [x] Journalisation d'evenements de securite presente (auth/rate-limit/permissions).
- [x] Sauvegarde Restic chiffree en place (avec point d'attention sur le secret par defaut, traite en P2).

## P0 - Critique

- [x] Aligner le mecanisme d'authentification avec la documentation:
  - Soit implementer un vrai JWT signe.
  - Soit corriger la documentation et la spec pour decrire un token de session stocke en base.
- [x] Mettre a jour la section securite de README pour supprimer l'ambiguite JWT actuelle.
- [x] Corriger la spec OpenAPI pour ne plus declarer JWT si le backend n'en emet pas.
- [x] Supprimer les secrets exposes du fichier .env, puis regenerer les cles impactees.

## P1 - Eleve

- [x] Activer effectivement les middlewares Node de securite declares (CSRF, validation, logging de securite).
- [x] Activer les rate limiters Node sur les routes sensibles (auth, admin, endpoints critiques).
- [x] Ajouter des headers HTTP de securite cote Node (equivalent a ceux deja poses cote API Go).
- [x] Passer le cookie d'auth en mode secure en HTTPS (avec gestion propre dev/prod).
- [x] Verifier toutes les routes /api/admin pour imposer un controle admin explicite.

## P2 - Important

- [x] Retirer le mot de passe Restic par defaut code en dur et rendre RESTIC_PASSWORD obligatoire.
- [x] Uniformiser la politique de securite entre API Go et Node (headers, logs, rate limiting).
- [x] Ajouter des tests de non-regression securite pour auth et routes admin.
- [x] Ajouter un controle CI qui echoue si un secret est detecte dans les fichiers versionnes.

## Criteres de validation (Done criteria)

- [x] La doc securite, la spec OpenAPI et le comportement reel d'auth sont coherents.
- [x] Les routes sensibles Node ont rate limiting et protections CSRF/validation actives.
- [x] Aucun secret reel n'est present dans le depot.
- [x] Les routes /api/admin refusent systematiquement les non-admin.
- [x] Les sauvegardes chiffrees n'acceptent plus de secret par defaut faible.

## Ordre recommande d'execution

1. Traiter P0 entierement (auth/doc/spec/secrets).
2. Traiter P1 (hardening runtime Node + controle d'acces admin).
3. Finaliser avec P2 (durcissement long terme + CI + tests).
4. Valider tous les done criteria.

## Validation manuelle (Docker) - Etat actuel

- [x] `curl http://localhost:3000/health` OK.
- [x] `curl -I http://localhost:3000/` retourne des headers de securite.
- [x] Route Swagger API exposee sur `/swagger` (en plus de `/api/swagger.json`).

## Outillage

- [x] Script de pentest executable ajoute: `scripts/pentest.sh`.
- [x] Le script valide automatiquement: health, headers, swagger, controle admin, rate limit login, hygiene repo/secrets.
- [x] Protection CSRF verifiee automatiquement dans le script de pentest.
- [x] Page web de pentest ajoutee: `/backend/pentest.html` (admin only).
- [x] Controle CI de secrets ajoute: `scripts/secret-scan.sh`.
