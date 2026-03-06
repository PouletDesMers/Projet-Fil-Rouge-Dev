# Guide du Panneau Admin 🛡️

## Accès au Panneau Admin

1. Connectez-vous avec un compte admin (par exemple: `admin2@example.com`)
2. Le bouton "Panneau Admin" apparaîtra dans la navbar
3. Cliquez dessus pour accéder au panneau d'administration

## Fonctionnalités Disponibles

### 📊 Vue d'Ensemble
- **Statistiques en temps réel** :
  - Total utilisateurs
  - Utilisateurs actifs
  - Admins
  - Utilisateurs avec 2FA activé

### 👥 Gestion des Utilisateurs

#### Voir la Liste des Utilisateurs
Le tableau affiche :
- ID et Email
- Nom complet (Prénom + Nom)
- Rôle (Admin/Client avec badge coloré)
- Statut (actif/inactif)
- État 2FA (icône bouclier vert/rouge)
- Date d'inscription

#### Actions Rapides sur Chaque Utilisateur

1. **👁️ Voir les Détails**
   - Cliquez sur l'icône œil
   - Affiche toutes les informations de l'utilisateur
   - Permet de passer en mode édition directement

2. **✏️ Éditer un Utilisateur**
   - Cliquez sur l'icône crayon
   - Modifiez les informations :
     - Email
     - Rôle (admin/client)
     - Prénom et Nom
     - Téléphone
     - Statut
     - Compte actif/inactif
   - Cliquez sur "Enregistrer" pour valider

3. **⬆️ Promouvoir en Admin**
   - Cliquez sur l'icône flèche haut
   - Confirmation requise
   - Change le rôle de "client" à "admin"

4. **⬇️ Rétrograder en Client**
   - Cliquez sur l'icône flèche bas
   - Confirmation requise
   - Change le rôle de "admin" à "client"

5. **✅/❌ Activer/Désactiver**
   - Cliquez sur le bouton vert (activer) ou rouge (désactiver)
   - Confirmation requise
   - Active ou désactive le compte utilisateur

### 🔐 Actions Avancées dans l'Éditeur

Lors de l'édition d'un utilisateur, vous avez accès à :

#### 1. Réinitialiser le Mot de Passe
- Génère automatiquement un nouveau mot de passe sécurisé
- Affiche le mot de passe temporaire
- **Important** : Copiez et envoyez-le à l'utilisateur de manière sécurisée

#### 2. Réinitialiser la 2FA
- Visible uniquement si l'utilisateur a la 2FA activée
- Désactive complètement la 2FA
- L'utilisateur devra la reconfigurer s'il le souhaite

#### 3. Envoyer Email de Bienvenue
- Envoie un email automatique à l'utilisateur
- Utile pour les nouveaux comptes

#### 4. Supprimer l'Utilisateur
- ⚠️ **ACTION IRRÉVERSIBLE**
- Supprime définitivement l'utilisateur de la base de données
- Double confirmation requise

## Sécurité

- ✅ Seuls les admins peuvent accéder au panneau
- ✅ Authentification par token (stocké dans localStorage et cookies)
- ✅ Les mots de passe ne sont jamais affichés
- ✅ Toutes les actions sont sécurisées par l'API

## API Endpoints Utilisés

- `GET /api/users` - Liste tous les utilisateurs
- `GET /api/users/:id` - Détails d'un utilisateur
- `PUT /api/users/:id` - Mise à jour d'un utilisateur
- `DELETE /api/users/:id` - Suppression d'un utilisateur
- `DELETE /api/user/2fa/remove` - Réinitialisation 2FA

## Notes Techniques

### Mises à Jour Partielles
L'API supporte les mises à jour partielles :
- Seuls les champs fournis sont mis à jour
- Le mot de passe n'est pas modifié si le champ est vide
- Évite d'écraser accidentellement des données

### Gestion des Erreurs
- Alertes en temps réel en cas d'erreur
- Messages clairs et explicites
- Validation côté client et serveur

### Responsive Design
- Interface adaptée aux différentes tailles d'écran
- Utilise Bootstrap 5
- Compatible mobile, tablette et desktop

## Troubleshooting

### "No authorization token provided"
- Reconnectez-vous
- Vérifiez que votre compte est bien admin

### "Erreur lors de la récupération des détails"
- Vérifiez que l'API est démarrée
- Consultez les logs Docker : `sudo docker-compose logs api`

### Les modifications ne sont pas sauvegardées
- Vérifiez la connexion à la base de données
- Consultez les logs : `sudo docker-compose logs -f`

## Améliorations Futures Possibles

- 📧 Système d'envoi d'emails réel
- 📈 Graphiques et statistiques avancées
- 🔍 Recherche et filtres sur les utilisateurs
- 📑 Export des données (CSV, Excel)
- 📝 Logs d'audit des actions admin
- 👥 Gestion des entreprises
- 📦 Gestion des abonnements et produits
- 🎫 Système de tickets de support intégré
