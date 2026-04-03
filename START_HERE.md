# 🚀 Guide Rapide - Démarrage et Test

## ✅ Statut Actuel

✅ Services Docker lancés :
- **PostgreSQL** : Port 5432
- **API Backend** : Port 8080
- **Frontend Web** : Port 3000

## 🎯 Prochaines Étapes

### 1. Vérifier que tout fonctionne

**Exécutez ces scripts :**
```bash
# Vérifier les services
check-services.bat

# Tester l'API
test-api.bat
```

### 2. Trouver votre adresse IP locale

**Windows PowerShell :**
```powershell
ipconfig
```
Cherchez "Adresse IPv4" (exemple: `192.168.1.100`)

**Ou utilisez le script :**
```bash
check-services.bat
```

### 3. Configurer l'app mobile

**Créez un fichier `.env` à la racine du projet et ajoutez :**
```env
EXPO_PUBLIC_API_URL=http://VOTRE_IP_ICI:8080/api
```

Si vous testez sur le même ordinateur que Docker, `http://localhost:8080/api` peut suffire sur iOS/web, et `http://10.0.2.2:8080/api` sur l'émulateur Android.

### 4. Utiliser le service API

**Dans votre app mobile, utilisez le fichier créé :**
```typescript
import apiService from '@/services/apiService';

// Connexion
const response = await apiService.login(email, password);

// Récupérer les catégories
const categories = await apiService.getCategories();
```

### 5. Lancer l'application mobile

```bash
npm start
```

Puis scannez le QR code avec **Expo Go** sur votre smartphone.

## 📱 Fichiers Créés

### Scripts de test (Windows)
- **start-dev.bat** - Démarre tous les services Docker
- **check-services.bat** - Vérifie que tout fonctionne
- **test-api.bat** - Teste les endpoints de l'API

### Configuration mobile
- **services/api.ts** - Client API principal utilisé par l'app Expo
- **services/apiService.ts** - Service API complet avec toutes les méthodes
- **services/api-base-url.ts** - Résolution centralisée de l'URL API
- **constants/config.example.ts** - Configuration d'exemple

### Documentation
- **TEST_GUIDE.md** - Guide de test détaillé
- **START_HERE.md** - Ce fichier

## 🧪 Tests Rapides

### Test 1 : API Backend

**Dans votre navigateur :**
```
http://localhost:8080/api/health
```

**Vous devriez voir :**
```json
{"status": "ok"}
```

### Test 2 : Frontend Web

**Dans votre navigateur :**
```
http://localhost:3000
```

### Test 3 : Base de données

```bash
docker-compose exec db psql -U postgres -d mydb -c "SELECT COUNT(*) FROM utilisateur;"
```

### Test 4 : Depuis votre mobile

1. Configurez `EXPO_PUBLIC_API_URL` dans `.env`
2. Lancez `npm start`
3. Scannez le QR code avec Expo Go
4. Testez la connexion depuis l'app

## 🔧 Dépannage Rapide

### Problème : "Network request failed"

**Solution :**
1. Vérifiez votre IP locale : `ipconfig`
2. Mettez à jour `EXPO_PUBLIC_API_URL` dans `.env`
3. Vérifiez que votre téléphone est sur le même WiFi
4. Testez l'API dans votre navigateur : `http://VOTRE_IP:8080/api/health`

### Problème : L'API ne répond pas

```bash
# Voir les logs
docker-compose logs api

# Redémarrer l'API
docker-compose restart api
```

### Problème : Erreur de connexion à la DB

```bash
# Redémarrer tous les services
docker-compose down
docker-compose up -d
```

## 📚 Documentation Complète

Pour plus de détails, consultez :
- **TEST_GUIDE.md** - Guide de test complet
- **GUIDE_BACKEND_GO.md** - Documentation du backend

## 🎉 Workflow de Développement

**Terminal 1 - Services Docker :**
```bash
docker-compose up
# ou
start-dev.bat
```

**Terminal 2 - Logs API :**
```bash
docker-compose logs -f api
```

**Terminal 3 - App Mobile :**
```bash
npm start
```

## 📞 Endpoints API Principaux

```
POST   /api/login              - Connexion
POST   /api/users              - Inscription
GET    /api/user/profile       - Profil utilisateur
GET    /api/categories         - Liste des catégories
GET    /api/services           - Liste des services
GET    /api/products           - Liste des produits
POST   /api/orders             - Créer une commande
GET    /api/user/orders        - Mes commandes
POST   /api/support/tickets    - Créer un ticket
```

## 🔑 Utilisateurs de Test

Après avoir exécuté `test-api.bat`, vous aurez un utilisateur de test :
- Email: `test@example.com`
- Password: `Test123!`

## ✨ Commandes Utiles

```bash
# Démarrer
start-dev.bat                    # Démarre tout
npm start                        # Démarre l'app mobile

# Tester
check-services.bat               # Vérifie les services
test-api.bat                     # Teste l'API

# Logs
docker-compose logs -f           # Tous les logs
docker-compose logs -f api       # Logs API seulement
docker-compose logs -f db        # Logs DB seulement

# Redémarrer
docker-compose restart api       # Redémarre l'API
docker-compose restart db        # Redémarre la DB

# Arrêter
docker-compose down              # Arrête tout
docker-compose down -v           # Arrête + supprime les données

# Nettoyer
docker-compose down -v           # Tout supprimer
docker system prune -f           # Nettoyer Docker
```

## 📱 Configuration Mobile Détaillée

### 1. Installer les dépendances (si pas fait)
```bash
npm install
```

### 2. Configurer l'API

**Méthode 1 : Configuration simple**
```typescript
// services/apiService.ts (ligne 6)
const API_BASE_URL = 'http://192.168.1.100:8080/api'; // Changez l'IP !
```

**Méthode 2 : Configuration avancée**
```typescript
// constants/config.ts
export const API_URL = __DEV__ 
  ? 'http://192.168.1.100:8080/api'  // Dev
  : 'https://api.cyna.com/api';      // Production
```

### 3. Permissions réseau (iOS)

**Fichier : `app.json`**
```json
{
  "expo": {
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

## 🎯 Checklist Complète

- [ ] Docker installé et lancé
- [ ] Services démarrés (`docker-compose up -d`)
- [ ] API répond (`http://localhost:8080/api/health`)
- [ ] IP locale trouvée (`ipconfig`)
- [ ] IP configurée dans `apiService.ts`
- [ ] Dépendances installées (`npm install`)
- [ ] App mobile lancée (`npm start`)
- [ ] QR code scanné avec Expo Go
- [ ] Téléphone sur le même WiFi
- [ ] Test de connexion réussi

## 🚀 Vous êtes prêt !

Tous les fichiers nécessaires ont été créés. Suivez simplement les étapes ci-dessus et vous pourrez tester votre application mobile avec le backend Docker.

**En cas de problème, consultez TEST_GUIDE.md pour des solutions détaillées.**

---

**Bon développement ! 🎉**
