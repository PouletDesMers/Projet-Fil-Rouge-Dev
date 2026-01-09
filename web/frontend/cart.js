  /***********************
   * 1) AUTH UI
   ***********************/
  const token = localStorage.getItem("token");
  const loginBtn = document.getElementById("loginBtn");
  const accountDropdown = document.getElementById("accountDropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  if (token) {
    accountDropdown?.classList.remove("d-none");
    loginBtn?.classList.add("d-none");
  } else {
    accountDropdown?.classList.add("d-none");
    loginBtn?.classList.remove("d-none");
  }

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    window.location.href = "/index.html";
  });

  /***********************
   * 2) PANIER STORAGE
   * On stocke dans localStorage.cartItems :
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

  // (Optionnel) helper pour plus tard: ajouter un produit depuis la page produit
  function addToCart(item) {
    const items = getCartItems();
    const idx = items.findIndex(x => x.id === item.id && x.duration === item.duration);
    if (idx >= 0) {
      items[idx].qty = (Number(items[idx].qty) || 0) + (Number(item.qty) || 1);
    } else {
      items.push({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 1,
        duration: item.duration || "Mensuel",
      });
    }
    saveCartItems(items);
  }

  /***********************
   * 3) SPA ROUTER (Home <-> Panier)
   ***********************/
  const appRoot = document.getElementById("appRoot");
  const navCartBtn = document.getElementById("navCartBtn");

  // On mémorise le HTML initial (accueil) pour pouvoir y revenir
  const HOME_HTML = appRoot ? appRoot.innerHTML : "";

  function moneyEUR(n) {
    return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",") + " €";
  }

  function calcTotals(items) {
    const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    const tax = 0; // si vous voulez une TVA plus tard
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  function renderHome() {
    if (!appRoot) return;
    appRoot.innerHTML = HOME_HTML;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderCart() {
    if (!appRoot) return;

    const items = getCartItems();
    const { subtotal, tax, total } = calcTotals(items);

    const itemsHtml = items.length
      ? items.map((it, index) => `
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
                <label class="small text-muted mb-0">Quantité</label>
                <input type="number" min="1" value="${Number(it.qty) || 1}"
                       class="form-control form-control-sm"
                       style="width:90px"
                       data-action="qty" data-index="${index}">
              </div>

              <div class="fw-semibold">${moneyEUR((Number(it.price)||0) * (Number(it.qty)||0))}</div>
            </div>
          </div>
        </div>
      `).join("")
      : `
        <div class="alert alert-light border shadow-sm">
          Ton panier est vide.
        </div>
      `;

    appRoot.innerHTML = `
      <div class="container my-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h1 class="h4 mb-0">Récapitulatif de mon panier</h1>
          <button class="btn btn-outline-secondary btn-sm" id="backToShopBtn">
            <i class="bi bi-arrow-left"></i> Continuer mes achats
          </button>
        </div>

        <div class="row g-3">
          <!-- COL GAUCHE: Les produits -->
          <div class="col-lg-8">
            <div class="vstack gap-3">
              ${itemsHtml}
            </div>
          </div>

          <!-- COL DROITE: Récap des prix / code promo / chatbot / paiement sécurisé -->
          <div class="col-lg-4">
            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h2 class="h6 mb-3">Récap des prix</h2>

                <div class="d-flex justify-content-between small mb-2">
                  <span class="text-muted">Sous-total</span>
                  <span>${moneyEUR(subtotal)}</span>
                </div>
                <div class="d-flex justify-content-between small mb-2">
                  <span class="text-muted">Taxes</span>
                  <span>${moneyEUR(tax)}</span>
                </div>
                <hr>
                <div class="d-flex justify-content-between fw-semibold">
                  <span>Total</span>
                  <span>${moneyEUR(total)}</span>
                </div>

                <button class="btn btn-cyna w-100 mt-3" id="checkoutBtn" ${items.length ? "" : "disabled"}>
                  Valider ma commande
                </button>
              </div>
            </div>

            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h3 class="h6 mb-2">Code promo</h3>
                <div class="input-group">
                  <input type="text" class="form-control" placeholder="Mon bon de réduction" id="promoInput">
                  <button class="btn btn-outline-secondary" type="button" id="promoApplyBtn">Ajouter</button>
                </div>
                <div class="small text-muted mt-2" id="promoMsg"></div>
              </div>
            </div>

            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h3 class="h6 mb-2">Une question ?</h3>
                <button class="btn btn-outline-secondary w-100" type="button" id="chatbotBtn">
                  Contact Me (chatbot)
                </button>
                <div class="small text-muted mt-2">
                  (réponses automatiques aux questions répétitives)
                </div>
              </div>
            </div>

            <div class="card shadow-sm border-0">
              <div class="card-body">
                <h3 class="h6 mb-3">Paiement sécurisé</h3>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-truck"></i>
                  <span class="small">Activation du service en 24h max</span>
                </div>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-shield-check"></i>
                  <span class="small">Transactions sécurisées</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-lock"></i>
                  <span class="small">Données protégées</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mini chatbot (simple) -->
        <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1080;">
          <div class="card shadow d-none" id="chatbotBox" style="width: 320px;">
            <div class="card-header d-flex justify-content-between align-items-center"
                 style="background: var(--cyna-dark); color: white;">
              <span>Assistant CYNA</span>
              <button class="btn btn-sm btn-outline-light" id="chatbotCloseBtn">X</button>
            </div>
            <div class="card-body" style="max-height: 260px; overflow:auto;">
              <div class="small text-muted mb-2">Questions fréquentes :</div>
              <div class="d-grid gap-2">
                <button class="btn btn-sm btn-outline-secondary" data-q="abo">Comment modifier mon abonnement ?</button>
                <button class="btn btn-sm btn-outline-secondary" data-q="pay">Quelles méthodes de paiement ?</button>
                <button class="btn btn-sm btn-outline-secondary" data-q="help">Contacter le support</button>
              </div>
              <hr>
              <div class="small" id="chatbotAnswer"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Interactions
    document.getElementById("backToShopBtn")?.addEventListener("click", renderHome);

    // Gestion qty / suppression
    appRoot.querySelectorAll("[data-action='remove']").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-index"));
        const items = getCartItems();
        items.splice(idx, 1);
        saveCartItems(items);
        renderCart();
      });
    });

    appRoot.querySelectorAll("[data-action='qty']").forEach(input => {
      input.addEventListener("change", () => {
        const idx = Number(input.getAttribute("data-index"));
        const items = getCartItems();
        const v = Math.max(1, Number(input.value) || 1);
        items[idx].qty = v;
        saveCartItems(items);
        renderCart();
      });
    });

    // Code promo (mock)
    document.getElementById("promoApplyBtn")?.addEventListener("click", () => {
      const code = (document.getElementById("promoInput")?.value || "").trim().toUpperCase();
      const msg = document.getElementById("promoMsg");
      if (!msg) return;
      if (!code) {
        msg.textContent = "Entre un code promo.";
        return;
      }
      msg.textContent = "Code promo enregistré (démo) : " + code;
    });

    // Checkout (démo)
    document.getElementById("checkoutBtn")?.addEventListener("click", () => {
      if (!token) {
        alert("Tu dois être connecté pour valider la commande (rediriger vers /auth.html dans votre logique).");
        return;
      }
      alert("Checkout (démo) — à brancher sur votre page/étapes checkout.");
    });

    // Chatbot simple
    const chatbotBox = document.getElementById("chatbotBox");
    const chatbotAnswer = document.getElementById("chatbotAnswer");

    document.getElementById("chatbotBtn")?.addEventListener("click", () => {
      chatbotBox?.classList.toggle("d-none");
    });
    document.getElementById("chatbotCloseBtn")?.addEventListener("click", () => {
      chatbotBox?.classList.add("d-none");
    });
    appRoot.querySelectorAll("#chatbotBox [data-q]").forEach(btn => {
      btn.addEventListener("click", () => {
        const q = btn.getAttribute("data-q");
        if (!chatbotAnswer) return;
        if (q === "abo") chatbotAnswer.textContent = "Va dans Mon compte > Abonnements pour renouveler / résilier.";
        if (q === "pay") chatbotAnswer.textContent = "Paiement par carte (Stripe) et/ou PayPal selon intégration.";
        if (q === "help") chatbotAnswer.textContent = "Tu peux utiliser la page Outils/Contact pour ouvrir un ticket.";
      });
    });

    window.scrollTo({ top: 0, behavior: "instant" });
  }

  /***********************
   * 4) Bind navbar click + init
   ***********************/
  navCartBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    renderCart();
  });

  // Init badge
  updateCartBadge();

  // (Optionnel) si tu veux voir le rendu direct sans passer par une page produit :
  // Décommente pour ajouter un item de démo une seule fois.
  /*
  if (!localStorage.getItem("demoCartDone")) {
    addToCart({ id: "edr", name: "CYNA EDR", price: 59.99, qty: 1, duration: "Mensuel" });
    addToCart({ id: "xdr", name: "CYNA XDR", price: 129.99, qty: 1, duration: "Annuel" });
    localStorage.setItem("demoCartDone", "1");
  }
  */