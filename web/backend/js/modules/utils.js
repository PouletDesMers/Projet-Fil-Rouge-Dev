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
  _neverCache: ["/admin/api/backup/", "/admin/api/logs"],

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
// 5) EXPORTS
// =========================================================================
window.AdminUtils = {
  showToast,
  showAlert,
  getTagColor,
  getStatusColor,
  slugify,
};

window.AdminApiCache = AdminApiCache;
