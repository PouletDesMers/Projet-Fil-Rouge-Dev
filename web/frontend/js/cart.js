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
  const tax = 0; // if you want VAT later
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
                <div class="text-muted small">Duration: ${
                  it.duration || "Monthly"
                }</div>
              </div>

              <button class="btn btn-sm btn-outline-danger" data-action="remove" data-index="${index}" aria-label="Remove">
                <i class="bi bi-trash"></i>
              </button>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-2">
              <div class="d-flex align-items-center gap-2">
                <label class="small text-muted mb-0">Quantity</label>
                <input type="number" min="1" value="${Number(it.qty) || 1}"
                       class="form-control form-control-sm"
                       style="width:90px"
                       data-action="qty" data-index="${index}">
              </div>

              <div class="fw-semibold">${moneyEUR(
                (Number(it.price) || 0) * (Number(it.qty) || 0)
              )}</div>
            </div>
          </div>
        </div>
      `
        )
        .join("")
    : `
        <div class="alert alert-light border shadow-sm">
          Your cart is empty.
        </div>
      `;

  appRoot.innerHTML = `
      <div class="container my-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h1 class="h4 mb-0">Order Summary</h1>
          <button class="btn btn-outline-secondary btn-sm" id="backToShopBtn">
            <i class="bi bi-arrow-left"></i> Continue shopping
          </button>
        </div>

        <div class="row g-3">
          <!-- LEFT COL: Products -->
          <div class="col-lg-8">
            <div class="vstack gap-3">
              ${itemsHtml}
            </div>
          </div>

          <!-- RIGHT COL: Price summary / promo code / chatbot / secure payment -->
          <div class="col-lg-4">
            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h2 class="h6 mb-3">Price Summary</h2>

                <div class="d-flex justify-content-between small mb-2">
                  <span class="text-muted">Subtotal</span>
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

                <button class="btn btn-cyna w-100 mt-3" id="checkoutBtn" ${
                  items.length ? "" : "disabled"
                }>
                  Checkout
                </button>
              </div>
            </div>

            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h3 class="h6 mb-2">Promo Code</h3>
                <div class="input-group">
                  <input type="text" class="form-control" placeholder="My discount coupon" id="promoInput">
                  <button class="btn btn-outline-secondary" type="button" id="promoApplyBtn">Add</button>
                </div>
                <div class="small text-muted mt-2" id="promoMsg"></div>
              </div>
            </div>

            <div class="card shadow-sm border-0 mb-3">
              <div class="card-body">
                <h3 class="h6 mb-2">Any questions?</h3>
                <button class="btn btn-outline-secondary w-100" type="button" id="chatbotBtn">
                  Contact Me (chatbot)
                </button>
                <div class="small text-muted mt-2">
                  (automated answers to repetitive questions)
                </div>
              </div>
            </div>

            <div class="card shadow-sm border-0">
              <div class="card-body">
                <h3 class="h6 mb-3">Secure Payment</h3>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-truck"></i>
                  <span class="small">Service activation within 24h</span>
                </div>
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-shield-check"></i>
                  <span class="small">Secure transactions</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-lock"></i>
                  <span class="small">Protected data</span>
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
              <span>CYNA Assistant</span>
              <button class="btn btn-sm btn-outline-light" id="chatbotCloseBtn">X</button>
            </div>
            <div class="card-body" style="max-height: 260px; overflow:auto;">
              <div class="small text-muted mb-2">Frequently Asked Questions:</div>
              <div class="d-grid gap-2">
                <button class="btn btn-sm btn-outline-secondary" data-q="abo">How to modify my subscription?</button>
                <button class="btn btn-sm btn-outline-secondary" data-q="pay">What payment methods are available?</button>
                <button class="btn btn-sm btn-outline-secondary" data-q="help">Contact support</button>
              </div>
              <hr>
              <div class="small" id="chatbotAnswer"></div>
            </div>
          </div>
        </div>
      </div>
    `;

  // Interactions
  document
    .getElementById("backToShopBtn")
    ?.addEventListener("click", renderHome);

  // Gestion qty / suppression
  appRoot.querySelectorAll("[data-action='remove']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-index"));
      const items = getCartItems();
      items.splice(idx, 1);
      saveCartItems(items);
      renderCart();
    });
  });

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

  // Promo code (mock)
  document.getElementById("promoApplyBtn")?.addEventListener("click", () => {
    const code = (document.getElementById("promoInput")?.value || "")
      .trim()
      .toUpperCase();
    const msg = document.getElementById("promoMsg");
    if (!msg) return;
    if (!code) {
      msg.textContent = "Enter a promo code.";
      return;
    }
    msg.textContent = "Promo code registered (demo): " + code;
  });

  // Checkout (demo)
  document.getElementById("checkoutBtn")?.addEventListener("click", () => {
    if (!token) {
      alert("You must be logged in to confirm the order.");
      return;
    }
    alert("Checkout (demo) — to be connected to your checkout process.");
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
  appRoot.querySelectorAll("#chatbotBox [data-q]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-q");
      if (!chatbotAnswer) return;
      if (q === "abo")
        chatbotAnswer.textContent =
          "Go to My Account > Subscriptions to renew / cancel.";
      if (q === "pay")
        chatbotAnswer.textContent =
          "Payment by card (Stripe) and/or PayPal depending on integration.";
      if (q === "help")
        chatbotAnswer.textContent =
          "You can use the Help/Contact page to open a ticket.";
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
