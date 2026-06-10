# AUDIT — Application mobile CYNA
**Date :** 2026-06-10  
**Auditeur :** Lead Developer (revue finale pré-production)  
**Périmètre :** Application mobile React Native / Expo Router — tous les écrans, services, contextes et composants

---

## Récapitulatif exécutif

L'application couvre l'intégralité des parcours utilisateur attendus d'un e-commerce SaaS : auth 2FA, catalogue paginé, panier avec durées d'abonnement, checkout Stripe, dashboard, commandes/abonnements/factures, chatbot FAQ, notifications. La qualité UI est homogène et soignée. Cependant, **une faille de sécurité bloquante** a été identifiée sur le reset de mot de passe, et plusieurs bugs fonctionnels doivent être corrigés avant mise en production.

---

## 1. Fonctionnel — Parcours utilisateur de bout en bout

### ✅ Parcours qui fonctionnent correctement

| Parcours | Fichiers | Verdict |
|---|---|---|
| Connexion + 2FA TOTP | `app/(auth)/login.tsx`, `context/auth-context.tsx` | ✅ Complet |
| Inscription avec règles mot de passe | `app/(auth)/register.tsx` | ✅ Complet |
| Restauration de session (SecureStore) | `context/auth-context.tsx:40-63` | ✅ Correct |
| Accueil : carrousel + catégories + top produits | `app/(tabs)/index.tsx` | ✅ Complet |
| Catalogue avec pagination + filtres | `app/(tabs)/explore.tsx` | ✅ Complet |
| Fiche produit + durée + panier | `app/product/[id].tsx` | ✅ Fonctionnel (bug perf, voir §3) |
| Panier + durées + remises | `app/(tabs)/cart.tsx`, `context/cart-context.tsx` | ✅ Fonctionnel (bug updateDuration, voir §3) |
| Checkout 4 étapes + Stripe | `app/checkout/index.tsx`, `services/stripe.ts` | ✅ Fonctionnel |
| Dashboard + stats abonnements | `app/(tabs)/dashboard.tsx` | ✅ Complet |
| Historique commandes + détail + PDF | `app/orders/index.tsx`, `app/orders/[id].tsx` | ✅ Complet |
| Factures PDF (export expo-print) | `app/account/invoices.tsx`, `services/pdf.ts` | ✅ Complet |
| Abonnements | `app/account/subscriptions.tsx` | ✅ Complet |
| Profil + édition | `app/account/profile.tsx` | ✅ Complet |
| Contact / Support (ticket API) | `app/contact.tsx` | ✅ Complet |
| Chatbot FAQ offline | `app/chat.tsx` | ✅ Complet |
| Notifications | `app/notifications.tsx` | ✅ Complet |
| Menu modal | `app/menu.tsx` | ✅ Complet |
| FAB Chat | `components/chat-fab.tsx`, `app/_layout.tsx` | ✅ Complet |

### ⚠️ Anomalies fonctionnelles détectées

**F-1 — Fiche produit charge toute la liste (performance + scalabilité)**  
`app/product/[id].tsx:41`
```ts
const all = await api.get<Record<string, unknown>[]>('/api/produits');
const found = (all || []).find(p => String(p.id_produit) === id);
```
Il n'existe pas d'endpoint `GET /api/produits/{id}`, donc **l'app télécharge l'intégralité du catalogue pour afficher une seule fiche**. Avec 50 produits ce n'est pas visible, mais c'est une limite architecturale.

**F-2 — `updateDuration` peut créer des doublons dans le panier**  
`context/cart-context.tsx:73-76`
```ts
return { ...i, id: `${i.productId}_${duration}`, duration };
```
Si l'utilisateur a déjà `prodX_1_month` et `prodX_1_year` dans le panier, puis change la durée du premier vers `1_year`, deux items auront le même `id`. Le state devient incohérent.

**F-3 — `NotificationBell` instanciée 3 fois en parallèle**  
`app/(tabs)/_layout.tsx` — lignes 32-57, appelée dans 3 `screenOptions.headerRight`  
À chaque navigation, **3 requêtes GET /api/notifications** sont déclenchées simultanément. Le badge ne se rafraîchit jamais après la première vue (pas de `useFocusEffect`).

**F-4 — Logout sans confirmation dans le menu modal**  
`app/menu.tsx:94` : `onPress={logout}` — déclenche immédiatement la déconnexion.  
`app/(tabs)/account.tsx:63` : affiche une confirmation Alert. **Incohérence** : l'un protège, l'autre non.

**F-5 — Panier non persistant**  
`context/cart-context.tsx` — le panier est en mémoire React uniquement. Fermer l'app vide le panier. Pour un service d'abonnement SaaS, c'est une friction notable.

**F-6 — Double filtrage prix dans le catalogue**  
`app/(tabs)/explore.tsx:79-96`  
Quand `search.trim()` est vide, les filtres `minPrice`/`maxPrice` ne sont envoyés **qu'à `/api/produits`** sans paramètres, puis filtrés côté client. Lorsqu'une recherche est active, ils sont passés à l'API mais aussi redirigés côté client. Le filtrage est donc inconsistant selon le mode.

---

## 2. Bugs et cas limites

| ID | Fichier | Ligne | Description |
|---|---|---|---|
| B-1 | `context/cart-context.tsx` | 73 | `updateDuration` : doublon potentiel si deux durées identiques |
| B-2 | `app/(tabs)/explore.tsx` | 25 | Erreur TypeScript `SearchParams` (confirmée par `tsc --noEmit`) |
| B-3 | `app/menu.tsx` | 94 | Logout sans confirmation (incohérence avec account.tsx) |
| B-4 | `app/(tabs)/_layout.tsx` | 37–57 | 3 instances de NotificationBell, badge périmé |
| B-5 | `app/product/[id].tsx` | 41 | Charge toute la liste produits pour une fiche |
| B-6 | `app/(tabs)/_layout.tsx` | 64 | `return null` pendant auth loading = flash blanc au démarrage |
| B-7 | `app/orders/index.tsx` | 102 | `as any` sur router.push (mask d'une erreur de typage) |
| B-8 | `chat.tsx` | 104 | `let msgCounter = 0` variable globale de module — état partagé si hot-reload |

**Preuve B-2 (TypeScript error réelle) :**
```
$ npx tsc --noEmit
app/(tabs)/explore.tsx(25,39): error TS2344: Type 'SearchParams' does not satisfy the constraint 'string'.
```

---

## 3. Sécurité

> **Note préliminaire :** C'est une app de cybersécurité vendue à des TPE/PME. Le niveau d'exigence sécurité est supérieur à la moyenne. Les problèmes ci-dessous sont jugés selon ce prisme.

### ❌ CRITIQUE — Reset de mot de passe sans token de vérification

`app/(auth)/forgot-password.tsx:75`, `services/api.ts`
```ts
await api.post('/api/password-reset', { email: email.trim().toLowerCase(), password });
```

**Ce que fait l'API :** reçoit un email + un nouveau mot de passe, et réinitialise directement.  
**Ce qui manque :** **aucun token OTP, aucun email de confirmation, aucun vérification que le demandeur contrôle cette adresse mail.**

Un attaquant connaissant l'email d'un utilisateur (ex. adresse visible dans une facture partagée) peut :
1. Appeler `POST /api/password-reset { email: "victime@exemple.com", password: "Hack1234!" }`
2. Se connecter immédiatement avec les nouvelles credentials

**Il s'agit d'un bypass d'authentification complet.** Sur une application qui gère des services EDR/SOC/XDR pour des entreprises, la compromission d'un compte peut donner accès à des données d'incidents de sécurité, des contrats et des contacts.

> **Gravité : CRITIQUE — Bloquant pour la mise en production.**

### ⚠️ MODÉRÉ — Token JWT exposé dans le contexte React

`context/auth-context.tsx:19`
```ts
export interface AuthContextType {
  token: string | null;  // ← exposé à tous les composants enfants
  ...
}
```

Le token JWT est accessible par `useAuth()` depuis n'importe quel composant de l'app. Seul `setAuthToken()` (module-level) suffit pour les appels API. L'exposition du token dans le contexte augmente inutilement la surface d'attaque (ex. un composant tiers, un log, un snapshot de test).

### ⚠️ MODÉRÉ — Données de carte en state React ordinaire

`app/checkout/index.tsx:48-51`
```ts
const [cardNumber, setCardNumber] = useState('');
const [cardExpiry, setCardExpiry]  = useState('');
const [cardCvc, setCardCvc]        = useState('');
```

Les 16 chiffres de carte et le CVC sont dans un state React non chiffré. En cas d'exception React Native qui sérialise l'état dans un rapport d'erreur (Sentry, Crashlytics), ces données pourraient être incluses. L'approche correcte est de ne stocker ces données que le temps minimal nécessaire à la tokenisation.

### ⚠️ MODÉRÉ — `/api/abonnements` retourne tous les abonnements (bug backend connu)

Documenté dans la mémoire du projet. Un utilisateur authentifié appelle `GET /api/abonnements` et reçoit **les abonnements de tous les utilisateurs** de la plateforme. C'est une violation de la confidentialité des données (RGPD possible). Visible dans `app/account/subscriptions.tsx:42` et `app/(tabs)/dashboard.tsx:44`.

### ℹ️ INFO — URL de production hardcodée

`services/api-base-url.ts:34`
```ts
return 'https://api.cyna.com';
```
Ce domaine n'est probablement pas encore actif. S'assurer qu'il est configuré via `EXPO_PUBLIC_API_URL` en production.

### ℹ️ INFO — `.env.example` expose les noms des clés sensibles

`STRIPE_SECRET_KEY=sk_test_...` dans `.env.example` : la clé secrète Stripe ne devrait **jamais** être dans un fichier mobile `.env`. Elle doit rester exclusivement serveur. Vérifier que `.env` ne contient pas une vraie `sk_live_...`.

---

## 4. Qualité du code

### ❌ Code mort avec `console.error` en production

`services/apiService.ts` — ce fichier n'est **importé nulle part** dans l'application :
```
$ grep -r "apiService" app/ components/ context/ hooks/
(aucun résultat)
```
Il contient deux `console.error` (lignes 107 et 162), des types en doublon incompatibles avec ceux de `api.ts` (ex. `User.id: number` vs `User.id: string`), et des commentaires JSDoc redondants sur chaque méthode. **Fichier à supprimer.**

### ❌ Erreur TypeScript non corrigée

```
app/(tabs)/explore.tsx(25,39): error TS2344: 
  Type 'SearchParams' does not satisfy the constraint 'string'.
```
Le build TypeScript échoue. En production Expo, le build JS continue (transpilation), mais c'est un signal d'alarme dans un contexte pré-prod.

### ⚠️ Casts de type dégradés

**7 occurrences de `as any`** dans des `router.push()` :
- `app/orders/index.tsx:102`
- `app/(tabs)/account.tsx:103, 105, 107, 115, 119`
- `app/account/payment-methods.tsx:96`

Et plusieurs `as never` dans `app/(tabs)/index.tsx`, `app/product/[id].tsx`, `app/category/[id].tsx`. Ces casts masquent des erreurs de typage du routeur.

### ⚠️ Duplication des types API

`services/api.ts` et `services/apiService.ts` (mort) définissent des types `User`, `Category`, `Product` incompatibles entre eux. Risque de confusion pour tout développeur qui ouvre le fichier mort en croyant qu'il est actif.

---

## 5. UI/UX

### ⚠️ Anomalies UI/UX détectées

**U-1 — Onglet Dashboard caché et inaccessible**  
`app/(tabs)/_layout.tsx:155`
```tsx
<Tabs.Screen name="dashboard" options={{ href: null }} />
```
`dashboard.tsx` existe et contient du code métier complet, mais il n'est accessible depuis aucune navigation de l'app. C'est soit du code mort, soit une feature incomplète.

**U-2 — Écrans stub dans la navigation**  
`app/account/addresses.tsx` — affiché dans le menu "Carnet d'adresses", contient uniquement un message "Aucune adresse enregistrée" sans aucune fonctionnalité. Si c'est volontaire, le lien devrait être retiré du menu ou labellisé "Bientôt disponible".

**U-3 — Flash blanc au démarrage**  
`app/(tabs)/_layout.tsx:64`
```tsx
if (isLoading) return null;
```
Pendant la restauration de session (vérification du token SecureStore), le layout des tabs retourne `null`, causant un écran blanc. Un spinner ou un splash screen prolongé serait plus professionnel.

**U-4 — Loader sans SafeAreaView**  
`app/product/[id].tsx:83-87`
```tsx
return (
  <View style={styles.loader}>
    <ActivityIndicator size="large" color="#3b12a3" />
  </View>
);
```
`View` sans `SafeAreaView` : sur iPhone avec encoche, le spinner peut être rogné.

### ✅ Points UI positifs
- Cohérence des couleurs (#3b12a3) sur tous les écrans
- États vides correctement gérés (panier vide, aucune commande, aucune notification)
- États loading/error présents sur tous les écrans principaux
- Stepper visuel dans le checkout
- Feedback "Ajouté au panier !" temporaire sur la fiche produit

---

## 6. Performance

| Problème | Fichier | Impact |
|---|---|---|
| Charge toute la liste produits pour une fiche | `app/product/[id].tsx:41` | N×100ms par produit en BDD |
| 3 instances de NotificationBell au même moment | `app/(tabs)/_layout.tsx` | 3× GET /api/notifications par navigation |
| Double filtrage prix (API + client) | `app/(tabs)/explore.tsx:79-96` | Données partiellement filtrées |
| `Image` RN natif sur l'accueil vs `expo-image` | `app/(tabs)/index.tsx:113` | Pas de cache disk sur les images |
| Carousel implémenté avec `ScrollView` horizontal | `app/(tabs)/index.tsx:101` | Moins performant que `FlatList` horizontal |

---

## 7. Accessibilité

**Niveau actuel : minimal.** Aucun `accessibilityLabel`, `accessibilityRole`, ni `accessible` sur les éléments interactifs dans l'ensemble du code analysé.

```
$ grep -r "accessibilityLabel\|accessibilityRole\|accessible=" app/
(aucun résultat)
```

- Les boutons `TouchableOpacity` n'ont aucun label pour les lecteurs d'écran (VoiceOver / TalkBack)
- Les icônes seules (ex. cloche de notification, icône panier) n'ont pas de description textuelle alternative
- Le contraste du texte secondaire (#888 sur fond blanc) est à la limite des recommendations WCAG 2.1 AA (ratio ~4.6:1)

---

## Verdicts par catégorie

| Catégorie | Verdict | Justification |
|---|---|---|
| Fonctionnel | ⚠️ À améliorer | Parcours couverts, bugs notables (updateDuration, fiche produit, persistance panier) |
| Bugs / cas limites | ⚠️ À améliorer | Identifiés et documentés, aucun crash complet |
| **Sécurité** | **❌ Bloquant** | **Reset mdp sans vérification = bypass auth sur app cybersécurité** |
| Qualité du code | ⚠️ À améliorer | apiService.ts mort, erreur TS, casts dégradés |
| UI/UX | ⚠️ À améliorer | Cohérente globalement, stub écrans, flash blanc |
| Performance | ⚠️ À améliorer | Charge totale produits, 3× bell |
| Accessibilité | ❌ Bloquant | Aucun label (hors scope projet si assumé, sinon bloquant légalement) |

---

## Note globale : **12/20**

**Points forts (acquis) :**
- Architecture claire (Expo Router + contexts bien séparés)
- Normalisation backend→frontend robuste (normalizeProduct, normalizeOrder, etc.)
- SecureStore pour le JWT (correct)
- 2FA TOTP implémenté et fonctionnel
- UI cohérente et travaillée
- Gestion d'erreurs présente sur tous les formulaires
- Pagination FlatList avec `onEndReached` (catalogue, catégorie)
- Génération PDF locale (expo-print)

**Points qui font baisser la note :**
- Faille sécurité critique sur le reset de mot de passe (-3)
- Bug de duplication dans le panier (-1)
- Code mort (apiService.ts) avec types incompatibles (-1)
- Erreur TypeScript en production (-1)
- Accessibilité absente (-2)

---

## 3 — Plan de correction

### 🔴 BLOQUANTS (ne pas mettre en prod sans correction)

**C-1 — Reset mot de passe : ajouter une vérification email**  
`app/(auth)/forgot-password.tsx` + backend Go  
Deux approches possibles :
- **OTP 6 chiffres** envoyé par email, saisi à l'étape 2 avant le nouveau mdp
- **Token unique** dans le lien email, validé avant le reset  
Impact : modification du backend + écran forgot-password (ajout étape OTP entre email et nouveau mdp)

**C-2 — Supprimer `services/apiService.ts`**  
Fichier mort, types incompatibles, `console.error` en prod.  
Impact : 1 fichier supprimé, 0 import à mettre à jour

**C-3 — Corriger l'erreur TypeScript `SearchParams`**  
`app/(tabs)/explore.tsx:25` — changer le generic de `useLocalSearchParams` ou redéfinir le type.  
Impact : 1 ligne de code

---

### 🟠 IMPORTANTS (corrections avant lancement public)

**C-4 — Retirer `token` du contexte Auth**  
`context/auth-context.tsx:19` — supprimer `token: string | null` de l'interface, garder uniquement `isAuthenticated`.  
Impact : supprimer la prop, vérifier qu'aucun composant ne l'utilise (grep `\.token` dans le projet)

**C-5 — Corriger `updateDuration` dans le CartContext**  
`context/cart-context.tsx:73` — avant de changer l'id, retirer l'entrée existante avec le nouvel id si elle existe.  
Impact : 5 lignes dans cart-context.tsx

**C-6 — Un seul NotificationBell avec useFocusEffect**  
`app/(tabs)/_layout.tsx` — créer un hook `useNotifications()` appelé une fois dans le layout, passer `unread` en prop via context ou state partagé. Utiliser `useFocusEffect` pour rafraîchir au focus.  
Impact : refactor du TabLayout, création d'un hook

**C-7 — Confirmation logout dans le menu modal**  
`app/menu.tsx:94` — wrapper `logout` dans un `Alert.alert` identique à `account.tsx:63`  
Impact : 8 lignes

**C-8 — Charger le produit par son ID**  
`app/product/[id].tsx:41` — soit ajouter un endpoint `GET /api/produits/{id}` côté backend, soit passer par le slug. En attendant, limiter la liste chargée.  
Impact : modification backend + 1 appel API modifié

**C-9 — Corriger `/api/abonnements` côté backend**  
`api/handlers` — filtrer par `user_id` dans le handler. Mentionné en mémoire projet comme bug connu.  
Impact : backend uniquement

---

### 🟡 POLISH (amélioration qualité)

**C-10 — Persister le panier (AsyncStorage/expo-secure-store)**  
`context/cart-context.tsx` — sauvegarder `items` dans AsyncStorage au changement, restaurer au mount.  
Impact : ~20 lignes dans cart-context

**C-11 — Remplacer `as any` par du typage correct**  
7 occurrences dans `account.tsx` et `orders/index.tsx` — utiliser le type `Href` d'expo-router ou créer des fonctions typées.  
Impact : cosmétique

**C-12 — Ajouter SafeAreaView sur le loader de product/[id]**  
`app/product/[id].tsx:83` — remplacer `View` par `SafeAreaView`  
Impact : 1 ligne

**C-13 — Labels d'accessibilité sur les CTA principaux**  
Ajouter `accessibilityLabel` et `accessibilityRole="button"` sur les boutons critiques (login, paiement, déconnexion).  
Impact : ~20 lignes réparties dans les écrans auth et checkout

**C-14 — Utiliser expo-image sur l'accueil**  
`app/(tabs)/index.tsx` — remplacer `Image` de react-native par `Image` d'expo-image pour bénéficier du cache disque.  
Impact : 1 import, syntaxe identique

**C-15 — Gérer l'affichage du Dashboard**  
Décider si l'onglet Dashboard est en production ou non. S'il ne l'est pas, retirer `dashboard.tsx` de la navigation. S'il l'est, le rendre accessible.

---

*Rapport généré le 2026-06-10. Attente de validation avant Phase 4 (corrections).*
