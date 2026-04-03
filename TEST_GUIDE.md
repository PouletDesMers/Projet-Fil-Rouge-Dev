# 🧪 Guide de Test - Application Mobile + Backend Docker

## ✅ Étape 1 : Vérifier que les services Docker fonctionnent

Vos services sont lancés :
- **db** : PostgreSQL sur port 5432
- **api** : Backend Go sur port 8080  
- **web** : Frontend Next.js sur port 3000

### Commandes de vérification :

```bash
# Voir le statut des conteneurs
docker-compose ps

# Voir les logs en temps réel
docker-compose logs -f

# Voir les logs d'un service spécifique
docker-compose logs -f api
docker-compose logs -f db
docker-compose logs -f web
```

---

## ✅ Étape 2 : Trouver votre adresse IP locale

**Windows PowerShell :**
```powershell
ipconfig
# Cherchez "Adresse IPv4" dans la section WiFi ou Ethernet
# Exemple : 192.168.1.100
```

**Ou dans votre navigateur :**
- Tapez "quelle est mon ip locale" dans Google
- Ou allez dans Paramètres Windows → Réseau → Propriétés

**Notez cette adresse IP**, vous en aurez besoin pour l'app mobile !

---

## ✅ Étape 3 : Tester l'API Backend

### Option A : Depuis votre navigateur

Ouvrez dans votre navigateur :
- http://localhost:8080/api/health
- http://localhost:8080/api/categories (peut nécessiter authentification)

### Option B : Avec curl (Git Bash ou PowerShell)

```bash
# Test de santé
curl http://localhost:8080/api/health

# Test de création d'utilisateur
curl -X POST http://localhost:8080/api/users -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"firstName\":\"Test\",\"lastName\":\"User\",\"phone\":\"0612345678\",\"role\":\"client\"}"

# Test de login
curl -X POST http://localhost:8080/api/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\"}"

# Si le login réussit, vous recevrez un token. Utilisez-le pour tester les autres endpoints :
curl http://localhost:8080/api/categories -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### Option C : Avec Postman ou Insomnia

1. Importez cette collection de tests
2. Testez les endpoints un par un

---

## ✅ Étape 4 : Configurer l'application mobile

### A. Configurer l'URL de l'API

Créez ou modifiez le fichier de configuration de l'API dans votre app mobile :

**Fichier : `constants/config.ts` ou similaire**
```typescript
// Utilisez EXPO_PUBLIC_API_URL si possible
export const API_URL = __DEV__
  ? process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api'
  : 'https://api.cyna.com/api';

export const API_CONFIG = {
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};
```

**Ou créez un service API :**

**Fichier : `services/api.ts`**
```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api';

export const api = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  async getCategories(token: string) {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });
    return response.json();
  },

  // Ajoutez d'autres méthodes selon vos besoins
};
```

### B. Vérifier les permissions réseau

**Fichier : `app.json`**
Assurez-vous que les permissions réseau sont activées :
```json
{
  "expo": {
    "android": {
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSAppTransportSecurity": {
          "NSAllowsArbitraryLoads": true
        }
      }
    }
  }
}
```

---

## ✅ Étape 5 : Lancer l'application mobile

### Option 1 : Avec Expo Go (Recommandé pour le test)

```bash
# Démarrer le serveur de développement
npm start
# ou
npx expo start
```

**Résultat attendu :**
- Un QR code s'affiche dans le terminal
- L'interface Metro Bundler s'ouvre dans votre navigateur

**Sur votre smartphone :**
1. Installez **Expo Go** depuis l'App Store (iOS) ou Play Store (Android)
2. Ouvrez Expo Go
3. Scannez le QR code
4. L'application se charge

**⚠️ Important :**
- Votre téléphone ET votre ordinateur doivent être sur le **même réseau WiFi**
- Désactivez les VPN si vous en avez

### Option 2 : Émulateur Android

```bash
# Lancer l'émulateur
npm run android
# ou
npx expo start --android
```

### Option 3 : Simulateur iOS (Mac uniquement)

```bash
npm run ios
# ou
npx expo start --ios
```

---

## ✅ Étape 6 : Tester les fonctionnalités

### Test 1 : Connexion utilisateur

1. Lancez l'app mobile
2. Allez sur l'écran de login
3. Entrez les identifiants d'un utilisateur test :
   - Email : `test@example.com`
   - Password : `Test123!`
4. Vérifiez que vous êtes connecté

### Test 2 : Voir les logs en temps réel

**Terminal 1 - Logs de l'API :**
```bash
docker-compose logs -f api
```

**Terminal 2 - App mobile :**
```bash
npm start
```

**Observez :**
- Quand vous faites une action dans l'app mobile, vous devriez voir les requêtes dans les logs de l'API

### Test 3 : Vérifier la base de données

```bash
# Se connecter à PostgreSQL
docker-compose exec db psql -U postgres -d mydb

# Lister les tables
\dt

# Voir les utilisateurs créés
SELECT id_utilisateur, email, prenom, nom, role, statut FROM utilisateur;

# Voir les sessions actives
SELECT * FROM session_utilisateur ORDER BY date_creation DESC LIMIT 5;

# Quitter
\q
```

---

## ✅ Étape 7 : Tests de bout en bout

### Scénario complet :

1. **Créer un utilisateur depuis l'app mobile**
   - Ouvrez l'écran d'inscription
   - Remplissez le formulaire
   - Soumettez

2. **Vérifier dans la base de données**
   ```sql
   docker-compose exec db psql -U postgres -d mydb -c "SELECT * FROM utilisateur ORDER BY date_creation DESC LIMIT 1;"
   ```

3. **Se connecter avec ce nouvel utilisateur**
   - Retournez à l'écran de login
   - Connectez-vous avec les nouveaux identifiants

4. **Naviguer dans l'app**
   - Accédez au catalogue
   - Consultez les catégories
   - Voir les produits

5. **Vérifier les logs**
   ```bash
   docker-compose logs --tail=20 api
   ```

---

## 🔧 Dépannage

### Problème : "Network request failed" dans l'app mobile

**Solutions :**
1. Vérifiez que l'URL de l'API utilise votre IP locale (pas localhost)
2. Vérifiez que votre téléphone est sur le même WiFi
3. Désactivez temporairement le pare-feu Windows
4. Testez l'API depuis votre navigateur mobile : http://VOTRE_IP:8080/api/health

**Commande Windows pour autoriser le port 8080 :**
```powershell
# Exécuter en tant qu'administrateur
netsh advfirewall firewall add rule name="Allow Port 8080" dir=in action=allow protocol=TCP localport=8080
```

### Problème : "Cannot connect to API" 

**Diagnostic :**
```bash
# Vérifier que l'API répond
curl http://localhost:8080/api/health

# Vérifier les logs de l'API
docker-compose logs api --tail=50

# Vérifier que le conteneur API est en cours d'exécution
docker-compose ps
```

### Problème : L'API retourne 401 Unauthorized

**Causes possibles :**
1. Token expiré ou invalide
2. Token non envoyé dans le header
3. Utilisateur non créé ou inactif

**Test manuel :**
```bash
# 1. Se connecter et obtenir un token
curl -X POST http://localhost:8080/api/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\"}"

# 2. Copier le token reçu et l'utiliser
curl http://localhost:8080/api/categories -H "Authorization: Bearer VOTRE_TOKEN"
```

### Problème : Base de données vide

```bash
# Vérifier si le script d'initialisation a été exécuté
docker-compose exec db psql -U postgres -d mydb -c "\dt"

# Si vide, vérifier le fichier init.sql
cat db/init.sql

# Recréer la base de données
docker-compose down -v
docker-compose up -d
```

### Problème : L'app Expo ne se connecte pas

**Solutions :**
1. Vérifiez que le serveur Metro Bundler est lancé
2. Essayez le mode tunnel : `npx expo start --tunnel`
3. Videz le cache : `npx expo start -c`

---

## 📊 Checklist de test complète

- [ ] Services Docker démarrés (db, api, web)
- [ ] API répond sur http://localhost:8080/api/health
- [ ] Frontend web accessible sur http://localhost:3000
- [ ] IP locale identifiée et notée
- [ ] URL de l'API configurée dans l'app mobile
- [ ] App mobile lancée avec `npm start`
- [ ] QR code scanné avec Expo Go
- [ ] App mobile charge correctement
- [ ] Création d'un compte utilisateur fonctionne
- [ ] Connexion utilisateur fonctionne
- [ ] Navigation dans le catalogue fonctionne
- [ ] Les logs montrent les requêtes API
- [ ] Les données sont sauvegardées en base de données

---

## 🚀 Commandes rapides

```bash
# Tout démarrer
docker-compose up -d && npm start

# Tout arrêter
docker-compose down
# Appuyez sur Ctrl+C dans le terminal de l'app mobile

# Redémarrer l'API après modification du code
docker-compose restart api

# Rebuild complet
docker-compose up --build

# Voir tous les logs
docker-compose logs -f

# Nettoyer complètement (⚠️ perd les données)
docker-compose down -v && docker system prune -f
```

---

## 📱 Exemple de fichier de service API complet

**Fichier : `services/apiService.ts`**
```typescript
const API_BASE_URL = 'http://192.168.1.100:8080/api'; // CHANGEZ L'IP !

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Authentification
  async login(email: string, password: string) {
    const data = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(userData: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    this.token = null;
  }

  // Catalogue
  async getCategories() {
    return this.request('/categories');
  }

  async getServices() {
    return this.request('/services');
  }

  async getProducts() {
    return this.request('/products');
  }

  // Profil utilisateur
  async getUserProfile() {
    return this.request('/user/profile');
  }

  async updateUserProfile(data: any) {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();
```

---

**Bon test ! 🎉**

N'hésitez pas si vous rencontrez des problèmes spécifiques.
