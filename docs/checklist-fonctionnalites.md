# 📋 Checklist : Fonctionnalités de la Plateforme SaaS Cyna

## 1. Front-Office : Navigation & Catalogue
- [x] Développer la SPA (Single Page Application) mobile-first
- [x] Mettre en place le menu burger adaptatif selon l'état de connexion
- [x] **Accueil :** Intégrer un carrousel promotionnel interactif en 3 sections
- [x] **Accueil :** Ajouter une zone de texte fixe éditable via back-office
- [x] **Accueil :** Créer la grille dynamique des catégories de produits
- [x] **Accueil :** Mettre en place la section « Les Top Produits du moment »
- [x] **Accueil :** Ajouter un pied de page dynamique sur desktop (liens légaux, réseaux sociaux)
- [x] **Catalogue :** Afficher l'image d'en-tête et la description par catégorie
- [x] **Catalogue :** Configurer l'affichage (liste verticale mobile, grille desktop)
- [x] **Catalogue :** Paramétrer le tri dynamique (priorité back-office, stock épuisé en fin)
- [x] **Produit (SaaS) :** Intégrer le carrousel d'illustrations (dashboards, UI)
- [x] **Produit (SaaS) :** Afficher la description et les caractéristiques techniques
- [x] **Produit (SaaS) :** Gérer la tarification modulaire (mensuel, annuel, utilisateur/appareil)
- [x] **Produit (SaaS) :** Implémenter le CTA dynamique ("S'abonner", "Essayer", "Indisponible")
- [x] **Produit (SaaS) :** Intégrer l'algorithme de suggestion (6 services similaires)
- [x] **Recherche :** Créer un moteur multi-facettes (titre, description, specs, prix, catégories, dispo)
- [ ] **Recherche :** Appliquer les règles de priorité de correspondance (exacte, 1 diff, commence par, contient)
- [x] **Recherche :** Optimiser pour un temps de réponse inférieur à 100 ms

## 2. Parcours d'Achat (Tunnel de conversion)
- [x] **Panier :** Permettre la modification (quantité, durée d'abonnement)
- [x] **Panier :** Calculer en temps réel le total TTC
- [x] **Panier :** Rendre accessible aux visiteurs non connectés
- [x] **Panier :** Gérer l'indisponibilité des services en temps réel
- [x] **Checkout :** Gérer le flow d'authentification / inscription / invité
- [x] **Checkout :** Intégrer le formulaire d'adresse de facturation
- [x] **Checkout :** Mettre en place la saisie / sélection des moyens de paiement sécurisés
- [x] **Checkout :** Créer la page de confirmation avec récapitulatif
- [x] **Checkout :** Automatiser l'envoi de l'e-mail de confirmation

## 3. Espace Utilisateur (Mon Compte)
- [x] **Authentification :** Sécuriser l'inscription (contrôle force mdp : 8 char, maj, min, chiffres, spéciaux)
- [x] **Authentification :** Mettre en place la validation par lien e-mail (valide 24h)
- [x] **Authentification :** Implémenter "Mot de passe oublié" et "Se souvenir de moi"
- [x] **Profil :** Gérer la modification d'e-mail/mdp avec validation croisée
- [x] **Abonnements :** Permettre le renouvellement, l'upgrade et la résiliation
- [x] **Adresses/Paiement :** Gérer le carnet d'adresses et les cartes bancaires
- [x] **Historique :** Trier les commandes par année avec accès détaillé
- [x] **Historique :** Intégrer la recherche interne et le filtrage
- [ ] **Historique :** Générer et permettre le téléchargement des factures PDF

## 4. Back-Office (Administration)
- [x] Sécuriser l'accès avec une Authentification à Double Facteur (2FA)
- [x] **Ressources :** Lister, trier (multi-critères), et sélectionner en masse
- [x] **Ressources :** Créer, modifier, et supprimer les services SaaS
- [x] **Dashboard :** Générer l'histogramme des ventes (journalières/hebdomadaires)
- [x] **Dashboard :** Générer l'histogramme multi-couches des paniers moyens
- [x] **Dashboard :** Générer le graphique camembert de répartition par catégorie
- [x] **Support :** Centraliser les requêtes du formulaire et l'historique du Chatbot

## 5. Support & Outils Transverses
- [x] Créer la page de contact avec formulaire classique lié au back-office
- [x] Implémenter le Chatbot pour réponses automatisées
- [x] Gérer l'escalade Chatbot vers agent humain
- [x] Mettre en place la pagination paramétrable depuis le back-office

## 6. Contraintes Techniques & Architecturales
- [ ] Développer l'application mobile (native/hybride) avec UX/UI dédiée
- [ ] Intégrer les notifications push et la gestion hors-ligne sur mobile
- [x] Utiliser un Design System évolutif
- [ ] Respecter les normes d'accessibilité WCAG 2.1
- [x] Configurer l'internationalisation (i18n) et le support RTL
- [x] Appliquer le chiffrement des données, gestion sécurisée des sessions, protection XSS/CSRF/SQLi

---

## Résumé

| Catégorie | Fait | Restant | Progression |
|-----------|------|---------|-------------|
| 1. Front-Office | 17/18 | 1 | 94% |
| 2. Parcours d'Achat | 9/9 | 0 | 100% |
| 3. Espace Utilisateur | 8/9 | 1 | 89% |
| 4. Back-Office | 7/7 | 0 | 100% |
| 5. Support | 4/4 | 0 | 100% |
| 6. Architecture | 3/6 | 3 | 50% |
| **Total** | **48/53** | **5 restants** | **90%** |
