<div align="center">
  <img src="./assets/images/icon.png" alt="CYNA Logo" width="120" />

  # CYNA — Plateforme SaaS Cybersécurité

  **Protégez votre entreprise. Simplement.**

  [![CI](https://github.com/PouletDesMers/Projet-Fil-Rouge-Dev/actions/workflows/ci.yml/badge.svg)](https://github.com/PouletDesMers/Projet-Fil-Rouge-Dev/actions)
  ![Go](https://img.shields.io/badge/Go-1.21-00ADD8?logo=go&logoColor=white)
  ![React Native](https://img.shields.io/badge/React%20Native-Expo-000020?logo=expo)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?logo=postgresql&logoColor=white)
  ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
  ![Stripe](https://img.shields.io/badge/Stripe-Paiement-635BFF?logo=stripe&logoColor=white)

  *Projet Fil Rouge B3 CPI — SUP DE VINCI Paris*
</div>

---

## C'est quoi CYNA ?

CYNA est une **plateforme en ligne** qui permet aux entreprises de **souscrire à des solutions de cybersécurité** — comme un abonnement en ligne, mais pour protéger vos systèmes informatiques contre les cyberattaques.

> **Vous n'êtes pas développeur ?** Pas de panique. Imaginez CYNA comme un supermarché de la sécurité informatique : vous choisissez une protection, vous payez, et vous gérez tout depuis un tableau de bord ou une application mobile.

**EDR, XDR, SOC ?** Ce sont des types de protections — des systèmes qui surveillent et défendent automatiquement votre réseau. CYNA vous y donne accès facilement, sans être expert.

---

## Ce que CYNA permet de faire

### Sur le site web

| Fonctionnalité | Ce que vous pouvez faire |
|---|---|
| Catalogue | Parcourir et comparer toutes les offres de cybersécurité |
| Abonnement | Souscrire en quelques clics avec paiement sécurisé |
| Tableau de bord | Suivre vos abonnements, commandes et factures |
| Support | Ouvrir un ticket si vous avez un problème |
| Espace admin | Gérer les clients, produits et commandes (équipe CYNA) |

### Sur l'application mobile (iOS & Android)

| Fonctionnalité | Ce que vous pouvez faire |
|---|---|
| Connexion sécurisée | Se connecter avec double authentification (2FA) |
| Catalogue produits | Rechercher, filtrer et consulter les fiches produits |
| Panier & Paiement | Commander directement depuis son téléphone |
| Mon compte | Voir ses abonnements, factures et historique |
| Support | Contacter l'équipe CYNA depuis l'app |
| Chatbot | Obtenir des réponses rapides aux questions fréquentes |

---

## Aperçu visuel

> Des captures d'écran de l'application et du site seront ajoutées ici. Pour voir le projet en action, suivez les instructions de lancement ci-dessous.

---

## Comment est organisée la base de données ?

Les données sont stockées dans une base de données PostgreSQL. Voici comment elles s'articulent :

**Version simple :**
- **Catégorie → Service → Produit** : le catalogue des offres
- **Entreprise → Utilisateur → Abonnement** : qui utilise quoi et comment
- **Commande → Facture → Paiement** : le suivi financier
- **Ticket & Notification** : le support et la communication

**Schéma de la base de données :**

![Schéma BDD CYNA](./projet_cyna_sch%C3%A9maBDD.png)

**Modèle Conceptuel de Données (MCD) :**

![MCD CYNA](./MCD%20Cyna.png)

---

## Comment fonctionne le système ?

CYNA est composé de **trois services** qui communiquent ensemble, plus une **application mobile** :

```
                         Utilisateur
                        /            \
              Navigateur web       Application mobile
                    |               (iOS & Android)
                    |                     |
             ┌──────┴──────┐              |
             │ Site web    │              |
             │ Node.js     │              |
             │ Port 3000   │              |
             └──────┬──────┘              |
                    │                     |
                    └──────────┬──────────┘
                               │  API REST (HTTP)
                               ▼
                    ┌──────────────────────┐
                    │    API Backend        │
                    │    Go — Port 8080     │
                    │  JWT · 2FA · Stripe   │
                    └──────────┬───────────┘
                               │  SQL
                               ▼
                    ┌──────────────────────┐
                    │   Base de données    │
                    │   PostgreSQL 16      │
                    │   Port 5432          │
                    └──────────────────────┘
```

---

## Technologies utilisées

| Domaine | Technologie | Rôle |
|---|---|---|
| API Backend | **Go 1.21** | Traite les données et les requêtes |
| Site Web | **Node.js 20 + Express** | Sert les pages au navigateur |
| Application mobile | **React Native + Expo** | App iOS & Android |
| Base de données | **PostgreSQL 16** | Stocke toutes les données |
| Paiement | **Stripe** | Traitement des paiements |
| Authentification | **JWT + TOTP (2FA)** | Connexion sécurisée |
| Infrastructure | **Docker + Docker Compose** | Lance tout en une commande |
| CI/CD | **GitHub Actions** | Vérifie le code automatiquement |

---

## Lancer le projet

### Pour les développeurs

#### Prérequis

Un seul outil est nécessaire : **Docker**. Go et Node.js n'ont pas besoin d'être installés sur votre machine.

- [Télécharger Docker](https://docs.docker.com/get-docker/)

#### 1. Cloner le projet

```bash
git clone https://github.com/PouletDesMers/Projet-Fil-Rouge-Dev.git
cd Projet-Fil-Rouge-Dev
```

#### 2. Configurer les variables d'environnement

Copiez le fichier `.env.example` en `.env` et remplissez vos clés :

```bash
cp .env.example .env
```

```env
# Stripe — nécessaire pour les paiements
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### 3. Lancer le projet

```bash
docker-compose up --build
```

Les services démarrent automatiquement dans le bon ordre (base de données → API → site web).

| Service | URL |
|---|---|
| Site CYNA | http://localhost:3000 |
| API REST | http://localhost:8080 |
| Documentation API (Swagger) | http://localhost:8080/swagger |

#### Commandes utiles

```bash
# Lancer en arrière-plan
docker-compose up -d --build

# Voir les logs en temps réel
docker-compose logs -f

# Logs d'un seul service
docker-compose logs -f api

# Arrêter les services
docker-compose down

# Tout réinitialiser (repart de zéro)
docker-compose down -v

# Rebuilder un seul service
docker-compose up -d --build api
```

---

### Application mobile

L'application mobile fonctionne indépendamment des conteneurs Docker.

#### Prérequis

- [Node.js](https://nodejs.org/) installé
- L'application **Expo Go** sur votre téléphone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

#### Lancement

```bash
# Installer les dépendances
npm install

# Lancer l'application
npx expo start
```

Scannez le QR code affiché dans le terminal avec **Expo Go** pour ouvrir l'app sur votre téléphone.

Pour que l'app se connecte à l'API, créez un fichier `.env` à la racine :

```env
EXPO_PUBLIC_API_URL=http://<votre-ip-locale>:8080
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

> Remplacez `<votre-ip-locale>` par l'adresse IP de votre machine (ex: `192.168.1.42`). `localhost` ne fonctionnera pas depuis un vrai téléphone.

---

## Sécurité

| Mesure de sécurité | Détail |
|---|---|
| Authentification JWT | Chaque requête nécessite un token signé |
| Double authentification (2FA) | Code TOTP compatible Google Authenticator |
| Mots de passe | Hashés avec bcrypt (jamais stockés en clair) |
| Anti-spam | Rate limiting par adresse IP |
| En-têtes HTTP | Protection contre les attaques web courantes |
| Sauvegardes | Chiffrées avec Restic (AES-256) |

---

## Tests

```bash
# Tests de l'API Go (13 tests unitaires)
cd api
go test ./... -v

# Tests du serveur web Node.js
cd web
npm test
```

La pipeline CI/CD (GitHub Actions) lance ces tests automatiquement à chaque modification du code.

---

## Structure du projet

```
Projet-Fil-Rouge-Dev/
├── api/                    # API REST — Go
│   ├── handlers/           # Contrôleurs HTTP
│   ├── services/           # Logique métier
│   ├── repositories/       # Accès base de données
│   ├── middleware/         # Auth, rate limiting, logs
│   └── main.go
├── web/                    # Site web — Node.js
│   ├── frontend/           # Pages HTML/CSS publiques
│   └── backend/            # Interface d'administration
├── app/                    # Application mobile — React Native
│   ├── (auth)/             # Login, inscription, mot de passe oublié
│   ├── (tabs)/             # Onglets principaux (accueil, catalogue, panier...)
│   ├── product/            # Fiches produits
│   └── checkout/           # Tunnel de paiement
├── db/                     # Scripts SQL d'initialisation
├── assets/                 # Images et ressources de l'app mobile
├── .github/workflows/      # CI/CD GitHub Actions
└── docker-compose.yml      # Orchestration des services
```

---

## Contexte pédagogique

Ce projet a été développé dans le cadre du **Projet Fil Rouge** de la formation **B3 CPI** à **SUP DE VINCI Paris**.

**Objectif :** concevoir et développer de A à Z une plateforme SaaS complète — architecture, base de données, API, site web, application mobile, sécurité et déploiement.
