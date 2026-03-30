/***********************
 * 1) AUTH UI (Moved to navbar.js)
 ***********************/

/***********************
 * 2) CART STORAGE
 * Stored in localStorage.cartItems :
 * [{ id, name, price, qty, duration }]
 ***********************/
const CART_KEY = "cartItems";

function getCartItems() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveCartItems(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartBadge();
}

function getCartCount() {
  return getCartItems().reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
}

function updateCartBadge() {
  const cartBadge = document.getElementById("cartBadge");
  if (!cartBadge) return;
  const count = getCartCount();
  if (count > 0) {
    cartBadge.textContent = String(count);
    cartBadge.classList.remove("d-none");
  } else {
    cartBadge.textContent = "0";
    cartBadge.classList.add("d-none");
  }
}

  // (Optional) helper for later: add a product from the product page
  function addToCart(item) {
    const items = getCartItems();
    const idx = items.findIndex(
      (x) => x.id === item.id && x.duration === item.duration
    );
    if (idx >= 0) {
      items[idx].qty = (Number(items[idx].qty) || 0) + (Number(item.qty) || 1);
    } else {
      items.push({
        id: item.id,
        slug: item.slug || item.id,
        name: item.name,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 1,
        duration: item.duration || "Monthly",
      });
  }
  saveCartItems(items);
}

/***********************
 * 3) SPA ROUTER (Home <-> Cart)
 ***********************/
const appRoot = document.getElementById("appRoot");

// Memorize initial HTML (home) to be able to return to it
const HOME_HTML = appRoot ? appRoot.innerHTML : "";

// Applied promo state
let appliedPromo = null; // { code, type:'percent'|'amount', discount, label }

function moneyEUR(n) {
  return (
    (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",") +
    " €"
  );
}

function calcTotals(items) {
  const subtotal = items.reduce(
    (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
    0
  );
  let promoDiscount = 0;
  if (appliedPromo) {
    if (appliedPromo.type === "percent") {
      promoDiscount = (subtotal * appliedPromo.discount) / 100;
    } else {
      promoDiscount = Math.min(appliedPromo.discount, subtotal);
    }
  }
  const tax = 0; // TVA à connecter si besoin
  const total = Math.max(0, subtotal - promoDiscount + tax);
  return { subtotal, promoDiscount, tax, total };
}

function renderHome() {
  if (!appRoot) return;
  appRoot.innerHTML = HOME_HTML;
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Validate promo code via Stripe (server-side)
async function validatePromoCode(code) {
  try {
    const res = await fetch("/api/validate-promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Code invalide");
    return data; // { valid, code, type, discount, label }
  } catch (err) {
    throw err;
  }
}

function renderCart() {
  if (!appRoot) return;

  const items = getCartItems();
  const { subtotal, promoDiscount, tax, total } = calcTotals(items);

  const itemsHtml = items.length
    ? items
        .map(
          (it, index) => `
        <div class="d-flex gap-3 align-items-start border rounded-3 p-3 bg-white shadow-sm">
          <div class="rounded-3 d-flex align-items-center justify-content-center"
               style="width:72px;height:72px;background: var(--cyna-light);">
            <i class="bi bi-shield-lock" style="font-size:26px;color: var(--cyna-dark);"></i>
          </div>

          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="fw-semibold">${it.name}</div>
                <div class="text-muted small">Durée : ${it.duration || "Mensuel"}</div>
              </div>
              <button class="btn btn-sm btn-outline-danger" data-action="remove" data-index="${index}" aria-label="Supprimer">
                <i class="bi bi-trash"></i>
              </button>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-2">
              <div class="d-flex align-items-center gap-2">
                <label class="small text-muted mb-0">Qté</label>
                <input type="number" min="1" value="${Number(it.qty) || 1}"
                       class="form-control form-control-sm"
                       style="width:80px"
                       data-action="qty" data-index="${index}">
              </div>
              <div class="fw-semibold">${moneyEUR((Number(it.price) || 0) * (Number(it.qty) || 0))}</div>
            </div>
          </div>
        </div>
      `
        )
        .join("")
    : `
        <div class="alert alert-light border shadow-sm">
          <i class="bi bi-cart-x me-2"></i> Votre panier est vide.
        </div>
      `;

  const promoHtml = appliedPromo
    ? `<div class="alert alert-success py-2 px-3 d-flex justify-content-between align-items-center small mt-2 mb-0">
         <span><i class="bi bi-tag-fill me-1"></i><strong>${appliedPromo.label}</strong> appliqué !</span>
         <button class="btn btn-sm btn-link text-danger p-0 ms-2" id="promoRemoveBtn">✕</button>
       </div>`
    : "";

  appRoot.innerHTML = `
      <div class="container my-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h1 class="h4 mb-0"><i class="bi bi-cart3 me-2"></i>Récapitulatif commande</h1>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm" id="backHistoryBtn">
              <i class="bi bi-arrow-left"></i> Retour
            </button>
            <button class="btn btn-outline-primary btn-sm" id="continueShoppingBtn">
              <i class="bi bi-shop"></i> Continuer mes achats
            </button>
          </div>
        </div>

        <div class="row g-3">
          <!-- LEFT COL: Produits -->
          <div class="col-lg-8">
            <div class="vstack gap-3">
              ${itemsHtml}
            </div>
          </div>

          <!-- RIGHT COL: Récap / promo / paiement -->
          <div class="col-lg-4">
            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h2 class="h6 mb-3">Récapitulatif</h2>

                <div class="d-flex justify-content-between small mb-2">
                  <span class="text-muted">Sous-total</span>
                  <span>${moneyEUR(subtotal)}</span>
                </div>
                ${promoDiscount > 0 ? `
                <div class="d-flex justify-content-between small mb-2 text-success">
                  <span><i class="bi bi-tag-fill me-1"></i>Réduction promo</span>
                  <span>− ${moneyEUR(promoDiscount)}</span>
                </div>` : ""}
                <div class="d-flex justify-content-between small mb-2">
                  <span class="text-muted">TVA</span>
                  <span>${moneyEUR(tax)}</span>
                </div>
                <hr>
                <div class="d-flex justify-content-between fw-bold fs-5">
                  <span>Total</span>
                  <span class="text-primary">${moneyEUR(total)}</span>
                </div>

                <button class="btn btn-cyna w-100 mt-3" id="checkoutBtn" ${items.length ? "" : "disabled"}>
                  <i class="bi bi-credit-card me-1"></i>Passer au paiement
                </button>
              </div>
            </div>

            <!-- Promo Code -->
            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h3 class="h6 mb-2"><i class="bi bi-ticket-perforated me-1"></i>Code promo</h3>
                ${appliedPromo ? promoHtml : `
                <div class="input-group">
                  <input type="text" class="form-control text-uppercase" placeholder="Votre code promo" id="promoInput"
                         style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
                  <button class="btn btn-outline-primary" type="button" id="promoApplyBtn">
                    <span id="promoApplyLabel">Appliquer</span>
                    <span id="promoApplySpinner" class="spinner-border spinner-border-sm d-none" role="status"></span>
                  </button>
                </div>
                <div class="small mt-2 d-none" id="promoMsg"></div>
                `}
              </div>
            </div>

            <!-- Chatbot -->
            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h3 class="h6 mb-2">Une question ?</h3>
                <button class="btn btn-outline-secondary w-100" type="button" id="chatbotBtn">
                  <i class="bi bi-chat-dots me-1"></i>Contacter le support
                </button>
                <div class="small text-muted mt-2">Réponses automatiques aux questions courantes</div>
              </div>
            </div>

            <!-- Secure Payment -->
            <div class="card shadow-sm border-0">
              <div class="card-body">
                <h3 class="h6 mb-3"><i class="bi bi-lock-fill me-1 text-success"></i>Paiement sécurisé</h3>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-lightning-charge text-primary"></i>
                  <span class="small">Activation du service sous 24h</span>
                </div>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-shield-check text-success"></i>
                  <span class="small">Transactions sécurisées par Stripe</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-lock text-warning"></i>
                  <span class="small">Données protégées SSL/TLS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mini chatbot -->
        <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1080;">
          <div class="card shadow d-none" id="chatbotBox" style="width: 320px;">
            <div class="card-header d-flex justify-content-between align-items-center"
                 style="background: var(--cyna-dark); color: white;">
              <span><i class="bi bi-robot me-1"></i>CYNA Assistant</span>
              <button class="btn btn-sm btn-outline-light" id="chatbotCloseBtn">✕</button>
            </div>
            <div class="card-body" style="max-height: 260px; overflow:auto;">
              <div class="small text-muted mb-2">Questions fréquentes :</div>
              <div class="d-grid gap-2">
                <button class="btn btn-sm btn-outline-secondary" data-q="abo">Comment modifier mon abonnement ?</button>
                <button class="btn btn-sm btn-outline-secondary" data-q="pay">Modes de paiement acceptés ?</button>
                <button class="btn btn-sm btn-outline-secondary" data-q="help">Contacter le support</button>
              </div>
              <hr>
              <div class="small" id="chatbotAnswer"></div>
            </div>
          </div>
        </div>
      </div>
    `;

  // ── Bouton Retour (historique navigateur) ──
  document.getElementById("backHistoryBtn")?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      renderHome();
    }
  });

  // ── Continuer les achats ──
  document.getElementById("continueShoppingBtn")?.addEventListener("click", renderHome);

  // ── Supprimer un article ──
  appRoot.querySelectorAll("[data-action='remove']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-index"));
      const items = getCartItems();
      items.splice(idx, 1);
      saveCartItems(items);
      renderCart();
    });
  });

  // ── Modifier la quantité ──
  appRoot.querySelectorAll("[data-action='qty']").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number(input.getAttribute("data-index"));
      const items = getCartItems();
      const v = Math.max(1, Number(input.value) || 1);
      items[idx].qty = v;
      saveCartItems(items);
      renderCart();
    });
  });

  // ── Code promo Stripe ──
  document.getElementById("promoApplyBtn")?.addEventListener("click", async () => {
    const code = (document.getElementById("promoInput")?.value || "").trim();
    const msg = document.getElementById("promoMsg");
    const spinner = document.getElementById("promoApplySpinner");
    const label = document.getElementById("promoApplyLabel");
    if (!msg) return;

    if (!code) {
      msg.textContent = "Veuillez entrer un code promo.";
      msg.className = "small mt-2 text-danger";
      msg.classList.remove("d-none");
      return;
    }

    // Afficher spinner
    spinner?.classList.remove("d-none");
    if (label) label.textContent = "";

    try {
      const result = await validatePromoCode(code);
      if (result.valid) {
        appliedPromo = {
          code: result.code,
          type: result.type,         // 'percent' | 'amount'
          discount: result.discount, // valeur numérique
          label: result.label,       // ex: "WELCOME20 (-20%)"
        };
        renderCart(); // re-render avec réduction appliquée
      } else {
        msg.textContent = "Code promo invalide ou expiré.";
        msg.className = "small mt-2 text-danger";
        msg.classList.remove("d-none");
        spinner?.classList.add("d-none");
        if (label) label.textContent = "Appliquer";
      }
    } catch (err) {
      msg.textContent = err.message || "Erreur lors de la validation.";
      msg.className = "small mt-2 text-danger";
      msg.classList.remove("d-none");
      spinner?.classList.add("d-none");
      if (label) label.textContent = "Appliquer";
    }
  });

  // ── Supprimer promo ──
  document.getElementById("promoRemoveBtn")?.addEventListener("click", () => {
    appliedPromo = null;
    renderCart();
  });

  // ── Checkout Stripe ──
  document.getElementById("checkoutBtn")?.addEventListener("click", async () => {
    const items = getCartItems();
    if (!items.length) return;

    const btn = document.getElementById("checkoutBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Redirection…';

    try {
      const { total } = calcTotals(items);

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items,
          promoCode: appliedPromo?.code || null,
        }),
      });

      // Pas connecté → rediriger vers la page de connexion
      if (res.status === 401) {
        window.location.href = "/auth.html?redirect=/index.html?view=cart";
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur Stripe");
      if (data.url) {
        // Sauvegarder le montant + code promo dans sessionStorage pour confirm-order
        const normalized = items.map(it => ({
          product_slug: it.slug || it.id || it.name,
          product_name: it.name,
          price: Number(it.price) || 0,
          quantity: Number(it.qty) || 1,
          duration: it.duration || ''
        }));
        sessionStorage.setItem('pendingOrder', JSON.stringify({
          totalAmount: total,
          demo: !!data.demo,
          promoCode: appliedPromo?.code || null,
          items: normalized,
        }));
        window.location.href = data.url;
      } else {
        throw new Error("URL de paiement manquante");
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-credit-card me-1"></i>Passer au paiement';
      alert("Erreur : " + err.message);
    }
  });

  // ── Chatbot ──
  const chatbotBox = document.getElementById("chatbotBox");
  const chatbotAnswer = document.getElementById("chatbotAnswer");

  document.getElementById("chatbotBtn")?.addEventListener("click", () => {
    chatbotBox?.classList.toggle("d-none");
  });
  document.getElementById("chatbotCloseBtn")?.addEventListener("click", () => {
    chatbotBox?.classList.add("d-none");
  });
  appRoot.querySelectorAll("#chatbotBox [data-q]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-q");
      if (!chatbotAnswer) return;
      const answers = {
        abo: "Rendez-vous dans Mon Compte > Abonnements pour modifier ou résilier.",
        pay: "Paiement par carte bancaire via Stripe (Visa, Mastercard, CB). Transactions 100% sécurisées.",
        help: "Ouvrez un ticket depuis la page Aide/Contact ou appelez le +33 1 XX XX XX XX.",
      };
      chatbotAnswer.textContent = answers[q] || "";
    });
  });

  window.scrollTo({ top: 0, behavior: "instant" });
}

/***********************
 * 4) Bind navbar click + init
 ***********************/
function initCartBindings() {
  const navCartBtn = document.getElementById("navCartBtn");
  if (navCartBtn) {
    navCartBtn.addEventListener("click", (e) => {
      if (appRoot) {
        e.preventDefault();
        renderCart();
      } else {
        // Redirect to home with cart view
        window.location.href = "/index.html?view=cart";
      }
    });
  }

  // Handle click on "Home" or Logo to reset SPA if on index.html
  const homeLinks = document.querySelectorAll(
    'a[href="/index.html"], .navbar-brand'
  );
  if (appRoot) {
    homeLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        // If we are already on index (potentially with cart displayed)
        if (
          window.location.pathname === "/index.html" ||
          window.location.pathname === "/"
        ) {
          e.preventDefault();
          renderHome();
          window.history.pushState({}, "", "/index.html");
          // Reload dynamic home data (categories, top ventes)
          try { loadCategories(); } catch (_) {}
          try { loadTopProducts(); } catch (_) {}
        }
      });
    });

    // New button on home
    const homeCartBtn = document.getElementById("homeCartBtn");
    if (homeCartBtn) {
      homeCartBtn.addEventListener("click", (e) => {
        e.preventDefault();
        renderCart();
      });
    }
  }

  updateCartBadge();
  initProductButtons();
}

function initProductButtons() {
  document.querySelectorAll(".btn-add-to-cart").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.getAttribute("data-id");
      const name = btn.getAttribute("data-name");
      const price = btn.getAttribute("data-price");
      if (id && name && price) {
        addToCart({ id, name, price: Number(price), qty: 1 });
        // Feedback
        const originalText = btn.textContent;
        btn.textContent = "Added!";
        btn.classList.replace("btn-primary", "btn-success");
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.replace("btn-success", "btn-primary");
        }, 2000);
      }
    });
  });
}

// Gérer le paramètre ?view=cart au chargement de la page
if (
  appRoot &&
  new URLSearchParams(window.location.search).get("view") === "cart"
) {
  renderCart();
}

// Si le DOM est déjà prêt
initCartBindings();

// Et aussi au chargement de la navbar
document.addEventListener("navbarLoaded", initCartBindings);

// Expose globalement pour navbar.js
window.updateCartBadge = updateCartBadge;
