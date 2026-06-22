# Guide Explicatif du Backend Go

## 📚 Table des matières
1. [Introduction au Go](#introduction-au-go)
2. [Structure du Projet](#structure-du-projet)
3. [Concepts de Go Utilisés](#concepts-de-go-utilisés)
4. [Explication Détaillée des Fichiers](#explication-détaillée-des-fichiers)
5. [Flux de Fonctionnement](#flux-de-fonctionnement)
6. [Comment Démarrer](#comment-démarrer)

---

## 🚀 Introduction au Go

Go (ou Golang) est un langage de programmation créé par Google. Voici les points clés :

### Caractéristiques principales :
- **Compilé** : Le code est transformé en binaire (contrairement à Python/JavaScript)
- **Typé statiquement** : Les types de variables sont déclarés et vérifiés à la compilation
- **Simple** : Syntaxe minimaliste et facile à apprendre
- **Concurrent** : Excellent pour gérer plusieurs tâches en parallèle
- **Rapide** : Très performant pour les APIs

### Syntaxe de base :
```go
// Déclaration de variable
var nom string = "John"
age := 25  // Déclaration courte (le type est déduit)

// Fonction
func nomFonction(parametre string) int {
    return 42
}

// Struct (comme une classe sans méthodes)
type Personne struct {
    Nom    string
    Age    int
}
```

---

## 📁 Structure du Projet

```
api/
├── main.go                    # Point d'entrée de l'application
├── database.go                # Configuration de la base de données
├── models.go                  # Définition des structures de données
├── handlers_auth.go           # Gestion de l'authentification (login, 2FA)
├── handlers_catalog.go        # Gestion du catalogue (catégories, services, produits)
├── handlers_billing.go        # Gestion de la facturation
├── handlers_entreprise.go     # Gestion des entreprises
├── handlers_support.go        # Gestion du support client
├── handlers_tarification.go   # Gestion des tarifs
├── handlers_user.go           # Gestion des utilisateurs
├── go.mod                     # Fichier de dépendances (comme package.json)
└── Dockerfile                 # Configuration Docker
```

---

## 🎯 Concepts de Go Utilisés

### 1. **Packages**
```go
package main  // Chaque fichier Go appartient à un package
```
- `main` : package spécial pour les programmes exécutables
- Les autres fichiers du projet font aussi partie de `package main`

### 2. **Imports**
```go
import (
    "net/http"              // Bibliothèque standard pour HTTP
    "encoding/json"         // Pour manipuler du JSON
    "github.com/gorilla/mux" // Bibliothèque externe (routeur web)
)
```

### 3. **Structures (Struct)**
```go
type Utilisateur struct {
    ID    int    `json:"id"`      // Tag JSON pour la sérialisation
    Email string `json:"email"`
}
```
- Équivalent des classes/objets en JavaScript
- Les tags `json:"..."` indiquent comment convertir en JSON

### 4. **Pointeurs**
```go
var age *int  // Pointeur vers un entier (peut être nil)
```
- Utilisé pour les valeurs optionnelles (qui peuvent être null/vides)

### 5. **Gestion des erreurs**
```go
result, err := fonctionQuilPeutEchouer()
if err != nil {
    // Gérer l'erreur
    return
}
```
- Go n'a pas d'exceptions, on vérifie explicitement les erreurs

### 6. **Middleware**
```go
func middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Code exécuté avant la route
        next.ServeHTTP(w, r)  // Appel de la route
        // Code exécuté après la route
    })
}
```
- Fonction qui s'exécute avant/après les routes (ex: vérifier l'authentification)

---

## 📝 Explication Détaillée des Fichiers

### **1. main.go** - Point d'entrée

**Rôle** : Démarre le serveur et définit toutes les routes de l'API

#### Fonctions principales :

##### `main()`
```go
func main() {
    initDB()  // Se connecte à la base de données
    
    // Crée un routeur (gère les URLs)
    r := mux.NewRouter()
    
    // Routes publiques (pas besoin d'authentification)
    r.HandleFunc("/api/login", loginUtilisateur).Methods("POST")
    r.HandleFunc("/api/users", createUtilisateur).Methods("POST")
    
    // Routes protégées (authentification requise)
    api := r.PathPrefix("/api").Subrouter()
    api.Use(authMiddleware)  // Applique le middleware d'authentification
    
    api.HandleFunc("/categories", getCategories).Methods("GET")
    // ... autres routes ...
    
    // Démarre le serveur sur le port 8080
    http.ListenAndServe(":8080", r)
}
```

**Explication simple** :
- C'est comme un aiguilleur : il reçoit les requêtes HTTP et les envoie à la bonne fonction
- `GET /api/categories` → appelle `getCategories()`
- `POST /api/login` → appelle `loginUtilisateur()`

##### `authMiddleware()`
```go
func authMiddleware(next http.Handler) http.Handler {
    // Vérifie si l'utilisateur a un token valide
    // Si oui : laisse passer la requête
    // Si non : renvoie une erreur 401 Unauthorized
}
```

**Explication** : Comme un garde à l'entrée, il vérifie que vous avez un badge (token) valide avant de vous laisser entrer.

##### `generateRandomToken()`
```go
func generateRandomToken() string {
    // Crée un token aléatoire sécurisé (32 caractères)
    // Utilisé pour les clés API
}
```

---

### **2. database.go** - Connexion à la base de données

**Rôle** : Établit la connexion avec PostgreSQL

```go
var db *sql.DB  // Variable globale : connexion à la DB

func initDB() {
    // 1. Récupère les paramètres de connexion depuis les variables d'environnement
    host := os.Getenv("DB_HOST")     // Ex: "localhost"
    port := os.Getenv("DB_PORT")     // Ex: "5432"
    user := os.Getenv("DB_USER")     // Ex: "postgres"
    password := os.Getenv("DB_PASSWORD")
    dbname := os.Getenv("DB_NAME")
    
    // 2. Crée la chaîne de connexion
    connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s", ...)
    
    // 3. Ouvre la connexion
    db, err = sql.Open("postgres", connStr)
    
    // 4. Vérifie que ça fonctionne
    db.Ping()
}
```

**Explication simple** :
- Comme se connecter à un coffre-fort
- Les identifiants viennent des variables d'environnement (fichier .env ou Docker)
- Une fois connecté, `db` peut être utilisé partout dans le code

---

### **3. models.go** - Définition des données

**Rôle** : Définit la structure de toutes les données (tables de la DB)

```go
type Utilisateur struct {
    ID                int        `json:"id"`
    Email             string     `json:"email"`
    MotDePasse        string     `json:"password"`
    Nom               string     `json:"lastName"`
    Prenom            string     `json:"firstName"`
    Telephone         string     `json:"phone"`
    Role              string     `json:"role"`
    Statut            string     `json:"status"`
    DateCreation      time.Time  `json:"createdAt"`
    DerniereConnexion *time.Time `json:"lastLogin"`  // * = peut être nil
    IDEntreprise      *int       `json:"companyId"`  // * = optionnel
}
```

**Explication** :
- Chaque `struct` représente une table de la base de données
- Les tags `json:"..."` indiquent le nom des champs en JSON
- Les `*` devant un type signifient que le champ est optionnel (peut être null)

**Autres modèles** :
- `Categorie` : Catégories de services
- `Service` : Services proposés
- `Produit` : Produits disponibles
- `Tarification` : Prix des produits
- `Entreprise` : Entreprises clientes
- `Abonnement` : Abonnements des entreprises
- `Commande` : Commandes passées
- `Facture` : Factures générées
- `Paiement` : Paiements effectués

---

### **4. handlers_auth.go** - Authentification

**Rôle** : Gestion du login, 2FA (authentification à deux facteurs)

#### Fonctions principales :

##### `loginUtilisateur()`
```go
func loginUtilisateur(w http.ResponseWriter, r *http.Request) {
    // 1. Récupère email et mot de passe depuis la requête
    // 2. Cherche l'utilisateur dans la DB
    // 3. Vérifie le mot de passe (hashé avec bcrypt)
    // 4. Crée un token de session
    // 5. Renvoie le token au client
}
```

**Explication** : Comme se connecter à un site web, vous donnez vos identifiants et recevez un "badge" (token) pour les prochaines requêtes.

##### `setup2FA()`, `verify2FA()`, `remove2FA()`
```go
// Active l'authentification à deux facteurs (Google Authenticator)
func setup2FA(w http.ResponseWriter, r *http.Request) {
    // 1. Génère un code secret QR
    // 2. L'utilisateur scanne le QR avec son téléphone
    // 3. Renvoie le secret et l'image QR
}

func verify2FA(w http.ResponseWriter, r *http.Request) {
    // 1. Vérifie que le code à 6 chiffres est correct
    // 2. Active le 2FA pour l'utilisateur
}
```

##### `getWebAuthnRegisterChallenge()`, `registerWebAuthn()`, `removeWebAuthn()`
```go
// Authentification avec clé physique (YubiKey, Touch ID, etc.)
```

---

### **5. handlers_catalog.go** - Catalogue

**Rôle** : Gestion des catégories, services et produits

#### Exemple : `getCategories()`
```go
func getCategories(w http.ResponseWriter, r *http.Request) {
    // 1. Exécute une requête SQL
    rows, err := db.Query("SELECT id_categorie, nom, description, actif FROM categorie")
    
    // 2. Parcourt les résultats
    var categories []Categorie
    for rows.Next() {
        var c Categorie
        rows.Scan(&c.ID, &c.Nom, &c.Description, &c.Actif)
        categories = append(categories, c)
    }
    
    // 3. Renvoie en JSON
    json.NewEncoder(w).Encode(categories)
}
```

**Explication** :
1. Fait une requête SQL pour récupérer toutes les catégories
2. Transforme les lignes SQL en objets Go (`Categorie`)
3. Convertit en JSON et envoie au client

#### Autres fonctions similaires :
- `createCategorie()` : Ajoute une nouvelle catégorie
- `updateCategorie()` : Modifie une catégorie
- `deleteCategorie()` : Supprime une catégorie
- Idem pour `Service` et `Produit`

---

### **6. handlers_user.go** - Utilisateurs

**Rôle** : Gestion CRUD des utilisateurs

#### Fonctions principales :

##### `createUtilisateur()`
```go
func createUtilisateur(w http.ResponseWriter, r *http.Request) {
    // 1. Récupère les données du nouvel utilisateur
    var u Utilisateur
    json.NewDecoder(r.Body).Decode(&u)
    
    // 2. Hashe le mot de passe (bcrypt)
    hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(u.MotDePasse), bcrypt.DefaultCost)
    
    // 3. Insère dans la base de données
    db.Exec("INSERT INTO utilisateur (email, mot_de_passe, ...) VALUES ($1, $2, ...)")
}
```

##### `getUserProfile()`
```go
func getUserProfile(w http.ResponseWriter, r *http.Request) {
    // 1. Récupère l'ID de l'utilisateur connecté (depuis le middleware)
    userID := r.Context().Value(UserIDKey).(int)
    
    // 2. Cherche ses infos dans la DB
    var u Utilisateur
    db.QueryRow("SELECT * FROM utilisateur WHERE id_utilisateur = $1", userID).Scan(&u.ID, &u.Email, ...)
    
    // 3. Renvoie en JSON
    json.NewEncoder(w).Encode(u)
}
```

---

### **7. handlers_billing.go** - Facturation

**Rôle** : Gestion des commandes, factures, paiements

Fonctions pour :
- Créer/lire/modifier/supprimer des commandes
- Créer/lire/modifier/supprimer des factures
- Créer/lire/modifier/supprimer des paiements

**Même logique que les autres handlers** : Requêtes SQL → Conversion en Go → JSON

---

### **8. handlers_entreprise.go** - Entreprises

**Rôle** : Gestion CRUD des entreprises clientes

Opérations :
- Lister toutes les entreprises
- Obtenir une entreprise par ID
- Créer une nouvelle entreprise
- Modifier une entreprise
- Supprimer une entreprise

---

### **9. handlers_support.go** - Support

**Rôle** : Gestion des tickets de support et notifications

Fonctions :
- `getTicketSupports()` : Liste tous les tickets
- `createTicketSupport()` : Crée un nouveau ticket
- `updateTicketSupport()` : Met à jour un ticket
- `getNotifications()` : Liste les notifications
- etc.

---

### **10. handlers_tarification.go** - Tarification

**Rôle** : Gestion des tarifs et abonnements

Fonctions pour :
- **Tarifications** : Prix des produits (unitaire, mensuel, annuel)
- **Abonnements** : Souscriptions des entreprises aux produits

---

### **11. go.mod** - Dépendances

**Rôle** : Comme `package.json` pour Node.js

```go
module api

go 1.21

require (
    github.com/gorilla/mux v1.7.4      // Routeur web
    github.com/lib/pq v1.10.7          // Driver PostgreSQL
    golang.org/x/crypto v0.17.0        // Cryptographie (bcrypt)
    github.com/pquerna/otp v1.5.0      // Authentification 2FA
)
```

**Explication** :
- `gorilla/mux` : Routeur HTTP pour gérer les URLs
- `lib/pq` : Pour communiquer avec PostgreSQL
- `crypto` : Pour hasher les mots de passe
- `otp` : Pour générer les codes 2FA

---

## 🔄 Flux de Fonctionnement

### Exemple : Connexion d'un utilisateur

```
1. Frontend envoie POST /api/login avec { email, password }
   ↓
2. Go reçoit la requête dans loginUtilisateur()
   ↓
3. Cherche l'utilisateur dans PostgreSQL
   SELECT * FROM utilisateur WHERE email = ?
   ↓
4. Vérifie le mot de passe (bcrypt.CompareHashAndPassword)
   ↓
5. Crée un token de session
   INSERT INTO session_utilisateur (token_session, id_utilisateur, ...)
   ↓
6. Renvoie le token au frontend
   { token: "abc123...", user: {...} }
   ↓
7. Frontend stocke le token (localStorage)
```

### Exemple : Récupérer les catégories

```
1. Frontend envoie GET /api/categories avec Header: "Authorization: Bearer abc123..."
   ↓
2. authMiddleware() intercepte la requête
   - Vérifie que le token est valide
   - Si valide : laisse passer
   - Si invalide : renvoie 401 Unauthorized
   ↓
3. getCategories() est appelé
   - Exécute SELECT * FROM categorie
   - Transforme les lignes SQL en []Categorie
   - Renvoie en JSON
   ↓
4. Frontend reçoit [{ id: 1, name: "Cloud", ... }, ...]
```

---

## 🚀 Comment Démarrer

### Prérequis
- **Go** installé (version 1.21+)
- **PostgreSQL** installé et en cours d'exécution
- **Base de données** créée avec les tables (voir `Base.sql`)

### Étape 1 : Installer les dépendances
```bash
cd Projet-Fil-Rouge-Dev/api
go mod download  # Télécharge toutes les bibliothèques nécessaires
```

### Étape 2 : Configurer les variables d'environnement
Créer un fichier `.env` ou définir les variables :
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=yourpassword
export DB_NAME=mydb
export API_SECRET=your-secret-key
```

### Étape 3 : Lancer l'API
```bash
go run .
# Ou compiler puis exécuter :
go build -o api
./api
```

L'API sera accessible sur `http://localhost:8080`

### Étape 4 : Tester
```bash
# Se connecter
curl -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Récupérer les catégories (avec le token reçu)
curl http://localhost:8080/api/categories \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🐳 Avec Docker

Le projet inclut Docker pour simplifier le déploiement :

```bash
# Démarre toute l'application (DB + API + Web)
docker-compose up

# L'API sera sur http://localhost:8080
# La base de données sur localhost:5432
```

**Dockerfile expliqué** :
```dockerfile
FROM golang:1.21           # Image de base avec Go
WORKDIR /app               # Dossier de travail
COPY . .                   # Copie les fichiers
RUN go build -o main .     # Compile le code
CMD ["./main"]             # Lance l'application
```

---

## 📚 Commandes Go Utiles

```bash
# Exécuter le code
go run .

# Compiler en binaire
go build -o api

# Télécharger les dépendances
go mod download

# Mettre à jour les dépendances
go get -u

# Formater le code
go fmt ./...

# Vérifier les erreurs
go vet ./...

# Tester (si des tests existent)
go test ./...
```

---

## 🎓 Concepts Avancés

### 1. **Gestion de la concurrence**
Go peut gérer plusieurs requêtes simultanément grâce aux **goroutines** :
```go
go fonctionAsynchrone()  // Lance en parallèle
```

### 2. **Context**
Permet de passer des données entre les middlewares et handlers :
```go
ctx := context.WithValue(r.Context(), UserIDKey, userID)
r = r.WithContext(ctx)
```

### 3. **SQL Injection Prevention**
Les `$1, $2, ...` dans les requêtes SQL empêchent les injections :
```go
// ✅ Sécurisé
db.Query("SELECT * FROM users WHERE email = $1", email)

// ❌ Dangereux
db.Query("SELECT * FROM users WHERE email = '" + email + "'")
```

---

## 🔒 Sécurité

### Authentification
- **Mots de passe** : Hashés avec bcrypt (jamais stockés en clair)
- **Tokens** : JWT ou tokens aléatoires stockés en DB
- **Sessions** : Expiration automatique après un certain temps

### Middleware d'authentification
Vérifie 3 types de tokens :
1. **Session token** : Pour les utilisateurs connectés via le web
2. **API token** : Pour les applications externes
3. **Master secret** : Pour les services internes (proxy)

### 2FA (Double authentification)
- **TOTP** : Codes à 6 chiffres (Google Authenticator)
- **WebAuthn** : Clés physiques (YubiKey, Touch ID)

---

## 🆘 Dépannage

### Erreur : "cannot connect to database"
➜ Vérifier que PostgreSQL est lancé et que les variables d'environnement sont correctes

### Erreur : "package not found"
➜ Exécuter `go mod download`

### Erreur : "port already in use"
➜ Un autre processus utilise le port 8080, le tuer ou changer le port dans `main.go`

### Erreur 401 Unauthorized
➜ Vérifier que le token est valide et bien envoyé dans le header `Authorization: Bearer TOKEN`

---

## 📖 Ressources pour Apprendre Go

1. **Tour of Go** : https://go.dev/tour/ (interactif, parfait pour débuter)
2. **Documentation officielle** : https://go.dev/doc/
3. **Go by Example** : https://gobyexample.com/ (exemples concrets)
4. **Effective Go** : https://go.dev/doc/effective_go (bonnes pratiques)

---

## 🎯 Résumé

**Ce backend Go fait quoi ?**
- ✅ API REST pour gérer des utilisateurs, entreprises, produits, commandes
- ✅ Authentification sécurisée (login, 2FA, sessions)
- ✅ Base de données PostgreSQL
- ✅ Routes protégées par middleware
- ✅ Conversion automatique JSON ↔ SQL

**Pourquoi Go ?**
- ⚡ Très rapide (compilé)
- 🛡️ Sécurisé (typage fort)
- 🚀 Simple à déployer (un seul binaire)
- 📦 Excellent pour les APIs

**Comment ça marche ?**
1. Client envoie requête HTTP → `main.go` (routeur)
2. Middleware vérifie l'authentification
3. Handler approprié traite la requête
4. Requête SQL vers PostgreSQL
5. Résultat converti en JSON et renvoyé

**Prochaines étapes** :
1. Lire le code de `main.go` ligne par ligne
2. Tester l'API avec Postman ou curl
3. Modifier une route simple (ex: ajouter un champ)
4. Créer votre propre handler

Bon apprentissage ! 🚀
