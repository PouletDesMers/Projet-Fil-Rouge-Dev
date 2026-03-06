# CYNA — Plateforme SaaS Cybersécurité

![CI](https://github.com/PouletDesMers/Projet-Fil-Rouge-Dev/actions/workflows/ci.yml/badge.svg)

Projet fil rouge — Spécialisation DEV / CPI | École INGETIS Paris

CYNA est une plateforme SaaS de cybersécurité permettant aux entreprises de souscrire à des solutions de protection (EDR, XDR, SOC). Le projet est découpé en trois services containerisés : une API Go, un serveur web Node.js et une base de données PostgreSQL.

---

## Stack technique

| Couche | Technologie |
|---|---|
| API backend | Go 1.21 — gorilla/mux, lib/pq, bcrypt, OTP |
| Serveur web / proxy | Node.js 20 — Express, http-proxy-middleware |
| Base de données | PostgreSQL 16 |
| Containerisation | Docker + Docker Compose |
| CI | GitHub Actions |

---

## Architecture

```
Projet-Fil-Rouge-Dev/
├── api/                    # API REST en Go
│   ├── config/             # Configuration (DB, env)
│   ├── errors/             # Classes d'erreurs personnalisées + tests
│   ├── middleware/         # Auth JWT, rate limiting, logger, error handler + tests
│   ├── models/             # Modèles de données
│   ├── repositories/       # Couche d'accès aux données (SQL)
│   ├── services/           # Logique métier
│   ├── handlers/           # Contrôleurs HTTP
│   ├── routes/             # Déclaration des routes
│   ├── cache/              # Cache en mémoire
│   ├── logger/             # Logger structuré
│   └── main.go
├── web/                    # Serveur web Node.js (proxy + frontend)
│   ├── server.js
│   ├── frontend/           # Pages HTML/CSS/JS publiques
│   ├── backend/            # Interface d'administration
│   └── middleware/         # Rate limiting, sécurité
├── db/                     # Scripts SQL d'initialisation
├── .github/workflows/      # CI GitHub Actions
└── docker-compose.yml
```

### Architecture en couches (API Go)

```
Routes → Handlers → Services → Repositories → PostgreSQL
              ↕
         Middleware (Auth, RateLimit, Logger, ErrorHandler)
```

---

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/)
- Go 1.21+ (développement local API uniquement)
- Node.js 20+ (développement local web uniquement)

---

## Lancement avec Docker

```bash
# Cloner le projet
git clone https://github.com/PouletDesMers/Projet-Fil-Rouge-Dev.git
cd Projet-Fil-Rouge-Dev

# Créer le fichier d'environnement
cp .env.example .env
# Renseigner STRIPE_SECRET_KEY et STRIPE_PUBLISHABLE_KEY dans .env

# Démarrer tous les services
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend CYNA | http://localhost:3000 |
| API REST | http://localhost:8080 |
| Swagger / API Docs | http://localhost:8080/swagger |
| PostgreSQL | localhost:5432 |

---

## Variables d'environnement

Créez un fichier `.env` à la racine avec les variables suivantes :

```env
# Stripe (requis pour les paiements)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Optionnel — générés automatiquement par docker-compose si absents
API_SECRET=
RESTIC_PASSWORD=
```

---

## Développement local

### API Go

```bash
cd api
go mod download
go run main.go
```

### Serveur web Node.js

```bash
cd web
npm install
npm start
```

---

## Tests

### Tests Go (13 tests unitaires)

```bash
cd api
go test ./... -v
```

Modules testés : `errors/`, `middleware/validate`, `middleware/error_handler`

### Tests Node.js

```bash
cd web
npm test
```

---

## CI/CD

La pipeline GitHub Actions se déclenche sur chaque push et pull request :

- **Job `test-go`** : `go build` → `go vet` → `go test ./...`
- **Job `test-node`** : `npm ci` → `npm test`

---

## Modules fonctionnels

| Module | Endpoints |
|---|---|
| Authentification | `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout` |
| Utilisateurs | `GET/PUT /api/users/me`, `GET /api/admin/users` |
| Catalogue produits | `GET/POST/PUT/DELETE /api/products`, `GET /api/categories` |
| Abonnements | `GET/POST /api/subscriptions`, `DELETE /api/subscriptions/:id` |
| Facturation | `GET /api/billing/invoices` |
| Images | `POST /api/images/upload`, `DELETE /api/images/:id` |
| API Keys | `GET/POST/DELETE /api/apikeys` |
| Support | `GET/POST /api/support/tickets` |
| Sauvegarde | `POST /api/admin/backup` (Restic) |

---

## Sécurité

- Authentification par token JWT (header `Authorization: Bearer <token>`)
- 2FA via TOTP (compatible Google Authenticator)
- Rate limiting par IP (middleware Go)
- Headers HTTP sécurisés
- Mots de passe hashés avec bcrypt
- Sauvegarde chiffrée avec Restic (AES-256)

---

## Projet pédagogique — TP INGETIS Paris

Ce projet suit le programme des 4 séances du TP *Node.js & API REST — De la théorie à la production* :

| Séance | Livrable |
|---|---|
| 1 — Architecture en couches | `feat: architecture en couches - modules Produits et Abonnements` ✅ |
| 2 — Sécurité JWT + OWASP | `feat: securite JWT + rate limiting + OWASP hardening` |
| 3 — Services tiers (Stripe, emails) | `feat: paiement Stripe + webhooks + emails transactionnels` |
| 4 — Production (Swagger, tests, Docker) | `feat: swagger + tests unitaires + docker + health check` |

