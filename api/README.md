# API Golang

Cette API REST fournit des opérations CRUD pour une base de données de gestion d'entreprises, produits et abonnements.

## Prérequis

- Go 1.21+
- PostgreSQL

## Installation

1. Clonez ou copiez le projet.
2. Installez les dépendances : `go mod tidy`

## Configuration

1. Créez une base de données PostgreSQL.
2. Exécutez le script SQL `Base.sql` pour créer les tables.
3. Modifiez la chaîne de connexion dans `database.go` si nécessaire.

## Lancement

```bash
go run main.go
```

L'API écoute sur http://localhost:8080

## Endpoints

### Catégories
- GET /categories - Liste toutes les catégories
- POST /categories - Crée une catégorie
- GET /categories/{id} - Récupère une catégorie
- PUT /categories/{id} - Met à jour une catégorie
- DELETE /categories/{id} - Supprime une catégorie

### Services
- GET /services - Liste tous les services
- POST /services - Crée un service
- GET /services/{id} - Récupère un service
- PUT /services/{id} - Met à jour un service
- DELETE /services/{id} - Supprime un service

### Produits
- GET /produits - Liste tous les produits
- POST /produits - Crée un produit
- GET /produits/{id} - Récupère un produit
- PUT /produits/{id} - Met à jour un produit
- DELETE /produits/{id} - Supprime un produit

### Tarifications
- GET /tarifications - Liste toutes les tarifications
- POST /tarifications - Crée une tarification
- GET /tarifications/{id} - Récupère une tarification
- PUT /tarifications/{id} - Met à jour une tarification
- DELETE /tarifications/{id} - Supprime une tarification

### Entreprises
- GET /entreprises - Liste toutes les entreprises
- POST /entreprises - Crée une entreprise
- GET /entreprises/{id} - Récupère une entreprise
- PUT /entreprises/{id} - Met à jour une entreprise
- DELETE /entreprises/{id} - Supprime une entreprise

### Utilisateurs
- GET /utilisateurs - Liste tous les utilisateurs
- POST /utilisateurs - Crée un utilisateur
- GET /utilisateurs/{id} - Récupère un utilisateur
- PUT /utilisateurs/{id} - Met à jour un utilisateur
- DELETE /utilisateurs/{id} - Supprime un utilisateur

### Abonnements
- GET /abonnements - Liste tous les abonnements
- POST /abonnements - Crée un abonnement
- GET /abonnements/{id} - Récupère un abonnement
- PUT /abonnements/{id} - Met à jour un abonnement
- DELETE /abonnements/{id} - Supprime un abonnement

### Commandes
- GET /commandes - Liste toutes les commandes
- POST /commandes - Crée une commande
- GET /commandes/{id} - Récupère une commande
- PUT /commandes/{id} - Met à jour une commande
- DELETE /commandes/{id} - Supprime une commande

### Factures
- GET /factures - Liste toutes les factures
- POST /factures - Crée une facture
- GET /factures/{id} - Récupère une facture
- PUT /factures/{id} - Met à jour une facture
- DELETE /factures/{id} - Supprime une facture

### Paiements
- GET /paiements - Liste tous les paiements
- POST /paiements - Crée un paiement
- GET /paiements/{id} - Récupère un paiement
- PUT /paiements/{id} - Met à jour un paiement
- DELETE /paiements/{id} - Supprime un paiement

### Tickets de support
- GET /tickets - Liste tous les tickets
- POST /tickets - Crée un ticket
- GET /tickets/{id} - Récupère un ticket
- PUT /tickets/{id} - Met à jour un ticket
- DELETE /tickets/{id} - Supprime un ticket

### Notifications
- GET /notifications - Liste toutes les notifications
- POST /notifications - Crée une notification
- GET /notifications/{id} - Récupère une notification
- PUT /notifications/{id} - Met à jour une notification
- DELETE /notifications/{id} - Supprime une notification