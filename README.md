# Projet-Fil-Rouge-Dev

1️⃣ Table categorie

Technique :
id_categorie : clé primaire, auto-incrémentée.
nom : varchar(100), obligatoire.
description : texte descriptif optionnel.
actif : booléen, indique si la catégorie est disponible.
Relations : 1 catégorie → plusieurs services.

Non technique :
C’est la grande famille de services ou produits.
Exemple : “Informatique”, “Marketing”, “Ressources humaines”.
Chaque service appartient à une catégorie.

2️⃣ Table service
Technique :
id_service : clé primaire.
nom, description, actif.
id_categorie : clé étrangère vers categorie.
Relations : 1 service → plusieurs produits.

Non technique :
C’est une offre spécifique dans une catégorie.
Exemple : dans la catégorie “Informatique”, le service peut être “Maintenance PC” ou “Développement Web”.

3️⃣ Table produit
Technique :
id_produit : clé primaire.
nom, description.
sur_devis : booléen, indique si le prix est personnalisé.
actif : booléen, si le produit est disponible.
id_service : clé étrangère vers service.
Relations : 1 produit → plusieurs tarifications.

Non technique :
Produit = ce que le client peut acheter ou souscrire.
Exemple : “Pack maintenance 1 an”, “Abonnement Web”.
Certains produits nécessitent un devis personnalisé.

4️⃣ Table tarification
Technique :
id_tarification : clé primaire.
prix : numérique, montant.
unite : unité du service (ex: utilisateur, licence).
periodicite : fréquence (mensuel, annuel).
id_produit : clé étrangère vers produit.

Non technique :
C’est le prix du produit et la façon dont il est facturé.
Exemple : 50€/mois pour 1 licence utilisateur, ou 500€ une fois pour un service ponctuel.

5️⃣ Table entreprise
Technique :
id_entreprise : clé primaire.
nom, secteur, taille, pays.
date_creation : timestamp par défaut NOW().

Non technique :
Représente le client ou l’organisation qui achète les services.
Exemple : “Société ABC, secteur informatique, 50 employés, basée en France”.

6️⃣ Table utilisateur

Technique :
id_utilisateur : clé primaire.
email unique, mot_de_passe.
nom, prenom, telephone, role (client, admin, support).
statut, date_creation, derniere_connexion.
id_entreprise : clé étrangère vers entreprise.

Non technique :
Représente une personne utilisant la plateforme.
Peut être un client, un administrateur ou le support.
Chaque utilisateur est lié à une entreprise.

7️⃣ Table abonnement

Technique :
id_abonnement : clé primaire.
date_debut, date_fin.
quantite, statut (actif, suspendu, résilié).
renouvellement_auto : booléen.
id_entreprise, id_produit, id_tarification : clés étrangères.

Non technique :
Représente qu’une entreprise souscrit à un produit.
Exemple : “Société ABC a souscrit 10 licences Web pour 1 an, renouvellement automatique activé”.

8️⃣ Table commande
Technique :
id_commande : clé primaire.
date_commande, montant_total, statut.
id_utilisateur : clé étrangère vers utilisateur.

Non technique :
Chaque fois qu’un client achète un produit, cela crée une commande.
Statut = payée, en attente ou échec.

9️⃣ Table facture

Technique :
id_facture : clé primaire.
date_facture, montant, lien_pdf.
id_commande : clé étrangère unique vers commande.

Non technique :
Document officiel récapitulant la commande et le montant à payer.
Peut être téléchargé ou envoyé au client.

🔟 Table paiement

Technique :
id_paiement : clé primaire.
moyen (CB, PayPal), statut, date_paiement.
reference_externe pour suivi bancaire.
id_commande : clé étrangère vers commande.

Non technique :
Indique si le client a payé et comment.
Exemple : paiement via carte bancaire, en attente de validation.

1️⃣1️⃣ Table ticket_support

Technique :
id_ticket : clé primaire.
sujet, message, statut (ouvert, en cours, fermé).
date_creation, id_utilisateur : clé étrangère.

Non technique :
Permet au client de contacter le support pour un problème.
Exemple : “Je ne peux pas accéder à mon produit”.

1️⃣2️⃣ Table notification

Technique :
id_notification : clé primaire.
type (sécurité, facturation, info), message, lu (booléen).
date_creation, id_utilisateur : clé étrangère.

Non technique :
Messages envoyés à l’utilisateur pour l’informer.
Exemple : “Votre abonnement sera renouvelé demain”, “Mise à jour du système”.

💡 Résumé global pour le client :

Catégorie → Service → Produit → Tarification : la hiérarchie des offres.
Entreprise → Utilisateur → Abonnement : qui utilise quoi et comment.
Commande → Facture → Paiement : le suivi financier.
Ticket & Notification : le support et la communication.
# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
