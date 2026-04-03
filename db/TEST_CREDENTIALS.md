# Comptes de test

Ce fichier regroupe les identifiants de demonstration charges par `02_seed.sql`.

## Base de donnees PostgreSQL

- Host: `localhost`
- Port: `5432`
- Database: `mydb`
- User: `postgres`
- Password: `password`

## Comptes applicatifs

- Admin:
  - Email: `admin@cyna.fr`
  - Mot de passe: `Admin1234!`
  - Role: `Admin`

- Utilisateur:
  - Email: `user@cyna.fr`
  - Mot de passe: `Admin1234!`
  - Role: `Client`

## Clés API de demo

- Admin API key: `demo-admin-api-key`
- User API key: `demo-user-api-key`

## Remarques

- Les mots de passe de demo ne doivent jamais etre utilises en production.
- L'initialisation SQL est executee uniquement lors de la creation initiale du volume PostgreSQL.
- Pour rejouer l'initialisation complete: `docker compose down -v && docker compose up --build`.
