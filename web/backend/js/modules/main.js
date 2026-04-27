/**
 * Main Module
 * Handles admin panel initialization and navigation
 */

// Global variables
let currentCategoryId = null;
let currentCategoryName = "";
const SECTION_STORAGE_KEY = "admin-active-section";

// ── Navigation throttle ────────────────────────────────────────────
// Empêche les navigations rapides (clics répétés) de flooder l'API
let _navThrottleTimer = null;
let _navWaiting = false;
const NAV_THROTTLE_MS = 500; // 500 ms minimum entre deux navigations

function _throttledNavigate(sectionBase) {
  if (_navThrottleTimer) {
    // Si une navigation a déjà été planifiée, on la remplace
    _navWaiting = true;
    clearTimeout(_navThrottleTimer);
    _navThrottleTimer = setTimeout(() => {
      _navWaiting = false;
      _navThrottleTimer = null;
      _doNavigate(sectionBase);
    }, NAV_THROTTLE_MS);
    return;
  }
  _doNavigate(sectionBase);
}

// Initialize admin panel
async function initializeAdmin() {
  // Check auth before anything
  await AdminAuth.checkAdminStatus();

  // Set today's date on dashboard
  const el = document.getElementById("dash-date");
  if (el)
    el.textContent =
      "Mis à jour le " +
      new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  // Setup event listeners
  setupEventListeners();

  if (
    window.AdminProducts &&
    typeof AdminProducts.initBulkImport === "function"
  ) {
    AdminProducts.initBulkImport();
  }

  // Restore last visited section or default to dashboard
  // Les sections "lourdes" (auto-refresh, appels multiples) ne sont pas restaurées
  // au démarrage pour éviter d'épuiser le rate limit dès le chargement de la page
  const savedSection = localStorage.getItem(SECTION_STORAGE_KEY) || "dashboard";
  const HEAVY_SECTIONS = ["logs", "api-docs"];
  navigateToSection(
    HEAVY_SECTIONS.includes(savedSection) ? "dashboard" : savedSection,
  );
}

// Setup all event listeners
function setupEventListeners() {
  // Handle refresh button
  document.getElementById("refreshUsersBtn")?.addEventListener("click", () => {
    AdminUsers.loadUsers();
  });

  // Handle sidebar navigation (via throttle pour éviter le flood)
  document.querySelectorAll("[data-section]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-section");
      _throttledNavigate(target);
    });
  });

  // Images section handlers
  document.getElementById("addImageBtn")?.addEventListener("click", () => {
    AdminImages.openImageModal();
  });

  document.getElementById("saveImageBtn")?.addEventListener("click", () => {
    AdminImages.saveImage();
  });

  // Image URL preview
  document.getElementById("imageUrl")?.addEventListener("input", (e) => {
    AdminImages.updateImagePreview(e.target.value);
  });

  // Categories section handlers
  document.getElementById("addCategoryBtn")?.addEventListener("click", () => {
    AdminCategories.openCategoryModal();
  });

  document.getElementById("saveCategoryBtn")?.addEventListener("click", () => {
    AdminCategories.saveCategory();
  });

  // Products section handlers
  document
    .getElementById("addCategoryFromProductBtn")
    ?.addEventListener("click", () => {
      AdminCategories.openCategoryModal();
    });

  document
    .getElementById("addProductToCategoryBtn")
    ?.addEventListener("click", () => {
      AdminProducts.openProductModal(null, currentCategoryId);
    });

  document.getElementById("saveProductBtn")?.addEventListener("click", () => {
    AdminProducts.saveProduct();
  });

  // Newsletter section handlers
  document
    .getElementById("createNewsletterBtn")
    ?.addEventListener("click", () => {
      window.AdminNewsletter?.createCampaign();
    });

  // Roles section handlers
  document.getElementById("createRoleBtn")?.addEventListener("click", () => {
    window.AdminRoles?.createRole();
  });

  // Handle logout
  document.getElementById("logoutAdminBtn")?.addEventListener("click", () => {
    AdminAuth.handleLogout();
  });
}

// Renommer l'ancienne fonction en _doNavigate (appelée uniquement via _throttledNavigate)
function _doNavigate(sectionBase) {
  const sectionId = `${sectionBase}-section`;
  const targetSection = document.getElementById(sectionId);
  const fallbackSection = document.getElementById("dashboard-section");

  // Hide all sections
  document.querySelectorAll(".section-content").forEach((section) => {
    section.classList.add("d-none");
  });

  // Stopper l'auto-refresh des logs si on quitte la section
  if (typeof AdminLogs !== "undefined") AdminLogs.destroy();

  // Remove active class from all links
  document.querySelectorAll(".nav-link").forEach((navLink) => {
    navLink.classList.remove("active");
  });

  // Show selected section or fallback
  if (targetSection) {
    targetSection.classList.remove("d-none");
  } else if (fallbackSection) {
    fallbackSection.classList.remove("d-none");
  }

  // Add active class to matching links
  document
    .querySelectorAll(`[data-section="${sectionBase}"]`)
    .forEach((navLink) => {
      navLink.classList.add("active");
    });

  // ── Section loads (chaque chargeur est protégé par son propre guard isFetching) ──
  if (sectionId === "dashboard-section") {
    AdminDashboard.load();
  } else if (sectionId === "users-section") {
    AdminUsers.loadUsers();
  } else if (sectionId === "images-section") {
    AdminImages.loadImages();
  } else if (sectionId === "categories-section") {
    AdminCategories.loadCategories();
    AdminCategories.loadCategoriesForProducts();
  } else if (sectionId === "api-docs-section") {
    initSwaggerUI();
  } else if (sectionId === "orders-section") {
    AdminOrders.loadOrders();
  } else if (sectionId === "quotes-section") {
    AdminQuotes.loadQuotes();
  } else if (sectionId === "discounts-section") {
    AdminDiscounts.loadDiscounts();
  } else if (sectionId === "logs-section") {
    AdminLogs.init();
  } else if (sectionId === "backup-section") {
    if (typeof AdminBackup !== "undefined") {
      AdminBackup.load();
    } else {
      console.warn("AdminBackup module not loaded");
    }
  } else if (sectionId === "newsletter-section") {
    const newsletter = window.AdminNewsletter;
    if (newsletter) {
      newsletter.loadSubscribers();
      newsletter.loadCampaigns();
    } else {
      console.error("Module newsletter indisponible");
    }
  } else if (sectionId === "roles-section") {
    const roles = window.AdminRoles;
    if (roles) {
      roles.loadRoles();
      roles.loadPermissions();
    } else {
      console.error("Module rôles indisponible");
    }
  }

  // Persist selection
  if (sectionBase) {
    localStorage.setItem(SECTION_STORAGE_KEY, sectionBase);
  }
}

// Garder l'ancien nom pour compatibilité (utilise maintenant le throttle)
function navigateToSection(sectionBase) {
  _throttledNavigate(sectionBase);
}

// Navigation functions
function showCategoryProducts(categoryId, categoryName) {
  currentCategoryId = categoryId;
  currentCategoryName = categoryName;
  if (window.AdminProducts) {
    AdminProducts.currentCategoryId = categoryId;
  }

  // Update titles
  document.getElementById("categoryProductsTitle").textContent =
    `Produits de ${categoryName}`;
  document.getElementById("categoryProductsSubtitle").textContent =
    `Gérer les produits de la catégorie ${categoryName}`;

  // Hide all sections and show category products section
  document.querySelectorAll(".section-content").forEach((section) => {
    section.classList.add("d-none");
  });
  document
    .getElementById("category-products-section")
    .classList.remove("d-none");

  // Update nav
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
  });

  // Load products for this category
  AdminProducts.loadCategoryProducts();
}

function backToCategories() {
  currentCategoryId = null;
  currentCategoryName = "";
  if (window.AdminProducts) {
    AdminProducts.currentCategoryId = null;
  }

  // Hide category products section and show categories
  document.querySelectorAll(".section-content").forEach((section) => {
    section.classList.add("d-none");
  });
  document.getElementById("categories-section").classList.remove("d-none");

  // Update nav
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
  });
  document.querySelector('[data-section="categories"]').classList.add("active");
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initializeAdmin);

// ── Guard Swagger global : intercepter les getElementById vides ──────
// L'erreur "Empty string passed to getElementById()" vient du fait que
// swagger-ui-bundle.js auto-initialise des composants avant que le conteneur
// ne soit présent dans le DOM. On remplace temporairement la fonction
// pour ne pas planter quand l'id est vide.
(function patchGetElementById() {
  const _orig = document.getElementById.bind(document);
  document.getElementById = function (id) {
    if (!id) {
      // Retourner null au lieu de planter
      return null;
    }
    return _orig(id);
  };
})();

// ── SwaggerUI — flags anti-réinitialisation ────────────────────────────────
// swaggerInitialized   : mis à true après un rendu réussi (pas de nouveau rendu)
// swaggerInitializing  : verrou pendant le fetch (évite les appels concurrents)
// swaggerLastFailTime  : timestamp du dernier échec (cooldown de 15 s entre retries)
let swaggerInitialized = false;
let swaggerInitializing = false;
let swaggerLastFailTime = 0;
const SWAGGER_RETRY_COOLDOWN_MS = 15000; // 15 secondes entre deux tentatives

// Initialize Swagger UI
function initSwaggerUI() {
  // Guard 1 : déjà rendu avec succès → rien à faire
  if (swaggerInitialized) return;

  // Guard 2 : fetch en cours → évite les appels parallèles
  if (swaggerInitializing) return;

  // Guard 3 : cooldown après échec → évite le flood 429 sur navigations rapides
  if (Date.now() - swaggerLastFailTime < SWAGGER_RETRY_COOLDOWN_MS) return;

  // Check if SwaggerUIBundle is available
  if (typeof SwaggerUIBundle === "undefined") {
    console.error("SwaggerUIBundle not loaded");
    return;
  }

  // Sécurité DOM : vérifier que le conteneur swagger-ui existe avant d'initialiser
  // Evite l'erreur "Empty string passed to getElementById()" dans swagger-ui-bundle.js
  const swaggerContainer = document.getElementById("swagger-ui");
  if (!swaggerContainer) {
    console.warn(
      "initSwaggerUI: conteneur #swagger-ui absent du DOM, initialisation annulée",
    );
    return;
  }

  swaggerInitializing = true;

  // Fetch the dynamic OpenAPI spec generated by the Go API (paths rewritten via admin proxy)
  fetch("/admin/api/swagger.json")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((spec) => {
      swaggerInitializing = false;
      swaggerInitialized = true; // Verrouillage définitif après succès

      // Initialize Swagger UI with the live spec
      try {
        const ui = SwaggerUIBundle({
          spec: spec,
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          plugins: [SwaggerUIBundle.plugins.DownloadUrl],
          layout: "StandaloneLayout",
          // Les requêtes passent par /admin/api/* → proxy Node → API Go
          // L'auth est gérée automatiquement via le cookie httpOnly côté serveur
          withCredentials: true,
          requestInterceptor: (request) => {
            // Le proxy Node.js lit le cookie authToken et ajoute Bearer automatiquement
            return request;
          },
        });

        window.ui = ui;
      } catch (swaggerInitErr) {
        console.warn("SwaggerUI init error (non-bloquant):", swaggerInitErr);
        swaggerInitializing = false;
        swaggerLastFailTime = Date.now();
      }
    })
    .catch((error) => {
      // Libérer le verrou et mémoriser l'heure d'échec (cooldown de 15 s)
      swaggerInitializing = false;
      swaggerLastFailTime = Date.now();

      console.error("Failed to load OpenAPI spec:", error);
      // Null-guard : le conteneur peut avoir été retiré du DOM entre-temps
      const el = document.getElementById("swagger-ui");
      if (el)
        el.innerHTML =
          '<div class="alert alert-danger">Erreur de chargement de la documentation API</div>';
    });
}

// Export functions
window.AdminMain = {
  currentCategoryId: () => currentCategoryId,
  currentCategoryName: () => currentCategoryName,
  showCategoryProducts,
  backToCategories,
  initSwaggerUI,
};
