/**
 * Utilities Module
 * Common utility functions used across the admin panel
 *
 * ── Cache API ───────────────────────────────────────────────────────────
 * Toutes les requêtes GET vers /admin/api/* sont automatiquement mises en
 * cache côté client pendant 30s. Les mutations (POST/PUT/DELETE) invalident
 * le cache des URLs concernées automatiquement.
 */

// =========================================================================
// 1) API CACHE — stockage en mémoire avec TTL
// =========================================================================
const AdminApiCache = {
  _store: new Map(),
  _defaultTTL: 30000, // 30 secondes

  // URLs dont les réponses ne doivent JAMAIS être mises en cache
  _neverCache: [
    "/admin/api/backup/",
    "/admin/api/logs",
    "/admin/api/permissions",
  ],

  // Associations endpoint → préfixe à invalider en cas de mutation
  // Ex: POST /admin/api/categories → invalide toutes les GET /admin/api/categories*
  _bustMap: {
    "/admin/api/categories": "/admin/api/categories",
    "/admin/api/products": "/admin/api/products",
    "/admin/api/carousel-images": "/admin/api/carousel-images",
    "/admin/api/users": "/admin/api/users",
    "/admin/api/commandes": "/admin/api/commandes",
    "/admin/api/logs": "/admin/api/logs",
    "/admin/api/newsletter": "/admin/api/newsletter",
    "/admin/api/roles": "/admin/api/roles",
    "/admin/api/api-tokens": "/admin/api/api-tokens",
    "/admin/api/images": "/admin/api/images",
    "/admin/api/discounts": "/admin/api/discounts",
    "/admin/api/quotes": "/admin/api/quotes",
    "/admin/api/stats": "/admin/api/stats",
  },

  /** Récupère une entrée du cache (null si absente ou expirée) */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.data;
  },

  /** Stocke une valeur dans le cache avec une durée de vie optionnelle */
  set(key, data, ttl) {
    this._store.set(key, {
      data,
      expiresAt: Date.now() + (ttl || this._defaultTTL),
    });
  },

  /** Invalide une clé exacte */
  invalidate(key) {
    this._store.delete(key);
  },

  /**
   * Invalide le cache pour toutes les URLs qui commencent par un préfixe
   * correspondant à l'URL de la mutation.
   * Ex: POST /admin/api/categories/5 → invalide tout /admin/api/categories*
   */
  invalidateByMutation(url) {
    // 1) Vérifier la _bustMap pour une correspondance exacte
    for (const [pattern, prefix] of Object.entries(this._bustMap)) {
      if (url.startsWith(pattern)) {
        this._deleteByPrefix(prefix);
        return;
      }
    }

    // 2) Fallback : extraire le "base path" (3 premiers segments)
    try {
      const pathname =
        typeof url === "string"
          ? url.startsWith("http")
            ? new URL(url).pathname
            : url
          : "";
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length >= 3) {
        const base = "/" + segments.slice(0, 3).join("/");
        this._deleteByPrefix(base);
      }
    } catch {
      // Ignorer les URLs malformées
    }
  },

  /** Supprime toutes les clés qui commencent par un préfixe */
  _deleteByPrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
      }
    }
  },

  /** Vérifie si une URL est eligible au cache */
  isCacheable(url) {
    return !this._neverCache.some((pattern) => url.includes(pattern));
  },

  /** Génère une clé de cache normalisée */
  cacheKey(url) {
    return typeof url === "string" ? url : String(url);
  },

  /** Vide tout le cache */
  clear() {
    this._store.clear();
  },
};

// =========================================================================
// 2) FETCH PATCH — Auth + Cache + Circuit Breaker 429
// =========================================================================
(function patchFetch() {
  const originalFetch = window.fetch;
  let _rateLimitedUntil = 0;

  window.fetch = (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const isAdminAPI = typeof url === "string" && url.includes("/admin/api/");
    const cacheKey = isAdminAPI ? AdminApiCache.cacheKey(url) : null;

    // ── A) MUTATION (POST/PUT/PATCH/DELETE) → invalider le cache ────────
    if (isAdminAPI && method !== "GET" && method !== "HEAD") {
      AdminApiCache.invalidateByMutation(typeof url === "string" ? url : "");
    }

    // ── B) GET : servir depuis le cache si disponible ────────────────────
    if (isAdminAPI && method === "GET" && AdminApiCache.isCacheable(url)) {
      const cached = AdminApiCache.get(cacheKey);
      if (cached !== null) {
        console.debug(`[Cache] HIT ${url}`);
        return Promise.resolve(
          new Response(JSON.stringify(cached), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
    }

    // ── C) Circuit breaker 429 ───────────────────────────────────────────
    if (isAdminAPI && Date.now() < _rateLimitedUntil) {
      const secsLeft = Math.ceil((_rateLimitedUntil - Date.now()) / 1000);
      console.warn(
        `[RateLimit] Requête bloquée (cooldown ${secsLeft}s) : ${url}`,
      );
      return Promise.resolve(
        new Response(JSON.stringify({ error: "rate_limited_client" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // ── D) Exécution de la vraie requête ─────────────────────────────────
    const opts = { credentials: "include", ...options };
    opts.headers = { ...(options.headers || {}) };

    const token = AdminAuth?.getAuthToken?.();
    if (token && !opts.headers["Authorization"]) {
      opts.headers["Authorization"] = `Bearer ${token}`;
    }
    if (opts.headers["Authorization"] === "Bearer null") {
      delete opts.headers["Authorization"];
    }

    return originalFetch(url, opts).then((res) => {
      // Détection rate limit 429
      if (isAdminAPI && res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
        _rateLimitedUntil = Date.now() + retryAfter * 1000;
        _showRateLimitBanner(retryAfter);
      }

      // Mise en cache des réponses GET réussies
      if (
        isAdminAPI &&
        method === "GET" &&
        res.ok &&
        AdminApiCache.isCacheable(url)
      ) {
        // On clone la réponse pour pouvoir lire le body sans consommer l'original
        const cloned = res.clone();
        cloned
          .json()
          .then((data) => {
            AdminApiCache.set(cacheKey, data);
            console.debug(`[Cache] STORE ${url}`);
          })
          .catch(() => {
            /* Ignorer les réponses non-JSON */
          });
      }

      return res;
    });
  };

  // ── Bannière rate-limit ──────────────────────────────────────────────
  function _showRateLimitBanner(seconds) {
    document.getElementById("rl-banner")?.remove();

    const banner = document.createElement("div");
    banner.id = "rl-banner";
    Object.assign(banner.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "99999",
      background: "#dc2626",
      color: "#fff",
      textAlign: "center",
      padding: "10px 20px",
      fontSize: "14px",
      fontWeight: "600",
      boxShadow: "0 2px 8px rgba(0,0,0,.35)",
      transition: "background .4s",
    });

    let remaining = seconds;
    const update = () => {
      banner.textContent = `⚠️ Trop de requêtes API — pause de ${remaining}s avant la prochaine action`;
    };
    update();
    document.body.prepend(banner);

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        banner.style.background = "#16a34a";
        banner.textContent =
          "✅ Limite levée — vous pouvez reprendre la navigation";
        setTimeout(() => banner.remove(), 2500);
      } else {
        update();
      }
    }, 1000);
  }
})();

// =========================================================================
// 3) TOASTS & ALERTS
// =========================================================================
function showToast(message, type = "info") {
  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container position-fixed top-0 end-0 p-3";
    toastContainer.style.zIndex = "1055";
    document.body.appendChild(toastContainer);
  }

  const toastElement = document.createElement("div");
  toastElement.className = `toast align-items-center text-white bg-${
    type === "error" ? "danger" : type
  } border-0`;
  toastElement.setAttribute("role", "alert");
  toastElement.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  toastContainer.appendChild(toastElement);

  const toast = new bootstrap.Toast(toastElement);
  toast.show();

  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove();
  });
}

function showAlert(message, type = "info") {
  const typeMapping = {
    success: {
      bg: "bg-success",
      icon: "bi-check-circle-fill",
      text: "text-white",
    },
    danger: {
      bg: "bg-danger",
      icon: "bi-exclamation-triangle-fill",
      text: "text-white",
    },
    warning: {
      bg: "bg-warning",
      icon: "bi-exclamation-triangle-fill",
      text: "text-dark",
    },
    info: { bg: "bg-info", icon: "bi-info-circle-fill", text: "text-white" },
  };

  const style = typeMapping[type] || typeMapping["info"];
  const toastId =
    "toast-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

  const toastHtml = `
    <div class="toast align-items-center ${style.bg} ${style.text} border-0" role="alert" id="${toastId}" data-bs-autohide="true" data-bs-delay="4000">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center">
          <i class="bi ${style.icon} me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close ${style.text === "text-white" ? "btn-close-white" : ""} me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;

  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container position-fixed top-0 end-0 p-3";
    toastContainer.style.zIndex = "1055";
    document.body.appendChild(toastContainer);
  }

  toastContainer.insertAdjacentHTML("beforeend", toastHtml);

  const toastElement = document.getElementById(toastId);
  if (toastElement) {
    const t = new bootstrap.Toast(toastElement);
    t.show();
    toastElement.addEventListener("hidden.bs.toast", () => {
      toastElement?.parentNode?.removeChild(toastElement);
    });
  }
}

// =========================================================================
// 4) HELPERS
// =========================================================================
function getTagColor(tag) {
  switch (tag?.toLowerCase()) {
    case "premium":
      return "bg-warning text-dark";
    case "prioritaire":
      return "bg-primary";
    case "standard":
    default:
      return "bg-secondary";
  }
}

function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case "disponible":
      return "bg-success";
    case "en rupture":
      return "bg-danger";
    case "sur commande":
      return "bg-warning text-dark";
    default:
      return "bg-secondary";
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// =========================================================================
// 5) SHARED CONFIG — canonical STATUS_CONFIG + invoice template
// =========================================================================
const STATUS_CONFIG = {
  en_attente: {
    label: "En attente",
    cls: "bg-warning text-dark",
    icon: "bi-clock-history",
  },
  confirmee: {
    label: "Confirmée",
    cls: "bg-info text-dark",
    icon: "bi-check-circle",
  },
  en_cours: { label: "En cours", cls: "bg-primary", icon: "bi-arrow-repeat" },
  livree: { label: "Livrée", cls: "bg-success", icon: "bi-bag-check-fill" },
  annulee: { label: "Annulée", cls: "bg-danger", icon: "bi-x-circle" },
  remboursee: {
    label: "Remboursée",
    cls: "bg-secondary",
    icon: "bi-arrow-counterclockwise",
  },
  devis_demande: {
    label: "Devis demandé",
    cls: "bg-info text-dark",
    icon: "bi-file-earmark-text",
  },
  devis_envoye: { label: "Devis envoyé", cls: "bg-primary", icon: "bi-send" },
  devis_accepte: {
    label: "Devis accepté",
    cls: "bg-success",
    icon: "bi-check2-all",
  },
  devis_refuse: {
    label: "Devis refusé",
    cls: "bg-danger",
    icon: "bi-x-circle-fill",
  },
};

/**
 * Génère le HTML d'une facture.
 * Utilisé par orders.js (admin) et la version client (commandes.js).
 */
function generateInvoiceHTML(order, includePrintBtn = false) {
  const ht = (order.totalAmount || 0) / 1.2;
  const tva = (order.totalAmount || 0) - ht;
  const items = Array.isArray(order.items) ? order.items : [];
  const today = new Date().toLocaleDateString("fr-FR");
  const ref = `F-${String(order.id).padStart(6, "0")}`;

  const itemsRows = items.length
    ? items
        .map((it) => {
          const q = Number(it.quantity || it.qty || 1);
          const p = Number(it.price || 0);
          return `<tr><td>${it.product_name || it.productName || "Produit"}</td><td class="text-center">${q}</td><td class="text-end">${p.toFixed(2)} €</td><td class="text-end">${(p * q).toFixed(2)} €</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="4">Aucun article</td></tr>`;

  const orderDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const printBtnHTML = includePrintBtn
    ? `<button class="print-btn" onclick="window.print()" style="background:#7602F9;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin-bottom:20px">🖨️ Imprimer / PDF</button>`
    : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Facture ${ref} | CYNA</title><style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;padding:40px 50px;color:#1a1a2e;max-width:800px;margin:0 auto}
    h1{color:#7602F9;font-size:1.8em}.header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #7602F9}
    .header .logo{color:#7602F9;font-weight:700;font-size:1.5em}.header .ref{text-align:right}
    .ref .num{font-size:1.4em;font-weight:700;color:#5610C0}.ref .date{color:#888;font-size:.85em}
    .info{margin:25px 0;display:flex;gap:30px}.info>div{flex:1}.info h3{color:#5610C0;font-size:.9em;margin-bottom:8px;text-transform:uppercase}.info p{font-size:.85em;line-height:1.6}
    table{width:100%;border-collapse:collapse;margin:25px 0}th{background:#0a1628;color:#00d4aa;padding:10px 12px;text-align:left;font-size:.85em}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:.85em}.totals{float:right;width:300px;margin-top:20px}
    .totals tr td:last-child{text-align:right;font-weight:600}.totals .grand{font-size:1.2em;color:#7602F9}
    .footer{margin-top:60px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:.75em;color:#888}
    @media print{.print-btn{display:none}}
  </style></head><body>
  ${printBtnHTML}
  <div class="header">
    <div class="logo">🛡️ CYNA</div>
    <div class="ref"><div class="num">${ref}</div><div class="date">${today}</div></div>
  </div>
  <div class="info">
    <div><h3>Émetteur</h3><p>CYNA SAS<br>123 Rue de la Cybersécurité<br>75000 Paris<br>SIRET: 123 456 789 00010</p></div>
    <div><h3>Client</h3><p>Client ID: ${order.userId || "—"}<br>Commande N° ${order.id}<br>Date: ${orderDate}</p></div>
  </div>
  <table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unit.</th><th>Sous-total</th></tr></thead><tbody>${itemsRows}</tbody></table>
  <div class="totals"><table><tr><td>Sous-total HT</td><td>${ht.toFixed(2)} €</td></tr><tr><td>TVA (20%)</td><td>${tva.toFixed(2)} €</td></tr><tr class="grand"><td>Total TTC</td><td>${(order.totalAmount || 0).toFixed(2)} €</td></tr></table></div>
  <div class="footer">CYNA SAS — Capital social 50 000€ — RCS Paris — TVA FR12345678900<br>Facture générée le ${today}</div>
</body></html>`;
}

// =========================================================================
// 6) EXPORTS
// =========================================================================
// Remplacement de prompt() par une modale Bootstrap
function showPrompt(title, defaultValue = "") {
  return new Promise((resolve) => {
    const modal = new bootstrap.Modal("#genericPromptModal");
    document.getElementById("genericPromptTitle").textContent = title;
    const input = document.getElementById("genericPromptInput");
    input.value = defaultValue;
    const saveBtn = document.getElementById("genericPromptSave");
    const handler = () => {
      resolve(input.value);
      modal.hide();
    };
    saveBtn.onclick = handler;
    input.onkeydown = (e) => {
      if (e.key === "Enter") handler();
    };
    modal.show();
    setTimeout(() => input.focus(), 200);
    document
      .getElementById("genericPromptModal")
      .addEventListener("hidden.bs.modal", () => resolve(null), { once: true });
  });
}

window.AdminUtils = {
  showToast,
  showAlert,
  getTagColor,
  getStatusColor,
  slugify,
};

window.AdminApiCache = AdminApiCache;
