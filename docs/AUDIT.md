# 🔍 Audit Global — CYNA Platform
> Date : 8 juin 2026 — Mise à jour après session WCAG

## 1. 🔐 Sécurité
- 🟠 Port 8080 exposé, bypass proxy Node.js
- 🟠 Pas de rate limiting sur /public
- 🟠 Pas de vérification email_verified avant achat
- 🟠 Pas de lockout après N login échoués
- 🟡 sameSite:lax → strict en prod
- 🟡 API_SECRET défini mais jamais utilisé

## 2. 🎨 UX
- ✅ Pagination serveur /users + /commandes (Fait)
- ✅ Pagination newsletter /subscribers (Fait)
- ✅ Modales avec prompt() → showPrompt() Bootstrap (Fait)
- 🟠 Pas de confirmation avant suppression (partiel)
- 🟡 Sidebar non collapsible
- 🟡 Autocomplete manquant recherche publique

## 3. ⚡ Performance
- ✅ GetCommandes/GetUsers avec pagination serveur (Fait)
- 🟡 Scripts JS sans defer/async/minification
- 🟡 Cache AdminApiCache sans limite taille
- 🟡 Chart.js + Bootstrap depuis CDN

## 4. 📋 Accessibilité (WCAG 2.1)
- ✅ Skip-link ajouté (backend + frontend navbar) (Fait)
- ✅ Modales : role="dialog", aria-modal, aria-labelledby, aria-label="Fermer" (Fait)
- ✅ Tableaux : scope="col" + <caption> (Fait)
- ✅ Labels : for= associés à leurs contrôles (Fait)
- ✅ Contraste sidebar : corrigé (rgba 0.35→0.75, 0.65→0.85) (Fait)
- ✅ id="main-content" sur <main> (backend + frontend) (Fait)
- 🟡 aria-hidden="true" sur les icônes décoratives
- 🟡 Navigation clavier : menus dropdown non ouvrables au clavier
- 🟡 WCAG HTML des pages statiques (contact, legal, equipe)

## 5. 🧹 Code
- ✅ console.log nettoyés en production (Fait)
- ✅ Templates facture + STATUS_CONFIG dédupliqués (Fait)
- ✅ innerHTML sans DOMPurify dans newsletter (Fait - data-* + event delegation)
- 🟡 Pas de tests frontend
- 🟡 admin.js — code legacy dupliqué avec modules/

## 6. 📱 Mobile
- ❌ Application mobile + notifications push (hors scope)

---

**Prochaine session suggérée :**
1. Scripts JS avec `defer`
2. Tests frontend basiques
3. Sidebar collapsible
4. WCAG pages statiques + dropdowns clavier
