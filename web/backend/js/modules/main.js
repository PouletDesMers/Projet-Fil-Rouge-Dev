/**
 * Main Module
 * Handles admin panel initialization and navigation
 */

// Global variables
let currentCategoryId = null;
let currentCategoryName = '';
const SECTION_STORAGE_KEY = 'admin-active-section';

// Initialize admin panel
async function initializeAdmin() {
  // Check auth before anything
  await AdminAuth.checkAdminStatus();

  // Set today's date on dashboard
  const el = document.getElementById('dash-date');
  if (el) el.textContent = 'Mis à jour le ' + new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  // Setup event listeners
  setupEventListeners();

  // Restore last visited section or default to dashboard
  const savedSection = localStorage.getItem(SECTION_STORAGE_KEY) || 'dashboard';
  navigateToSection(savedSection);
}

// Setup all event listeners
function setupEventListeners() {
  // Handle refresh button
  document.getElementById('refreshUsersBtn')?.addEventListener('click', () => {
    AdminUsers.loadUsers();
  });

  // Handle sidebar navigation
  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-section');
      navigateToSection(target);
    });
  });

  // Images section handlers
  document.getElementById('addImageBtn')?.addEventListener('click', () => {
    AdminImages.openImageModal();
  });

  document.getElementById('saveImageBtn')?.addEventListener('click', () => {
    AdminImages.saveImage();
  });

  // Image URL preview
  document.getElementById('imageUrl')?.addEventListener('input', (e) => {
    AdminImages.updateImagePreview(e.target.value);
  });

  // Categories section handlers
  document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
    AdminCategories.openCategoryModal();
  });

  document.getElementById('saveCategoryBtn')?.addEventListener('click', () => {
    AdminCategories.saveCategory();
  });

  // Products section handlers  
  document.getElementById('addCategoryFromProductBtn')?.addEventListener('click', () => {
    AdminCategories.openCategoryModal();
  });

  document.getElementById('addProductToCategoryBtn')?.addEventListener('click', () => {
    AdminProducts.openProductModal(null, currentCategoryId);
  });

  document.getElementById('saveProductBtn')?.addEventListener('click', () => {
    AdminProducts.saveProduct();
  });

  // Newsletter section handlers
  document.getElementById('createNewsletterBtn')?.addEventListener('click', () => {
    window.AdminNewsletter?.createCampaign();
  });

  // Roles section handlers
  document.getElementById('createRoleBtn')?.addEventListener('click', () => {
    window.AdminRoles?.createRole();
  });

  // Handle logout
  document.getElementById('logoutAdminBtn')?.addEventListener('click', () => {
    AdminAuth.handleLogout();
  });
}

function navigateToSection(sectionBase) {
  const sectionId = `${sectionBase}-section`;
  const targetSection = document.getElementById(sectionId);
  const fallbackSection = document.getElementById('dashboard-section');

  // Hide all sections
  document.querySelectorAll('.section-content').forEach(section => {
    section.classList.add('d-none');
  });

  // Stopper l'auto-refresh des logs si on quitte la section
  if (typeof AdminLogs !== 'undefined') AdminLogs.destroy();

  // Remove active class from all links
  document.querySelectorAll('.nav-link').forEach(navLink => {
    navLink.classList.remove('active');
  });

  // Show selected section or fallback
  if (targetSection) {
    targetSection.classList.remove('d-none');
  } else if (fallbackSection) {
    fallbackSection.classList.remove('d-none');
  }

  // Add active class to matching links
  document.querySelectorAll(`[data-section="${sectionBase}"]`).forEach(navLink => {
    navLink.classList.add('active');
  });

  // Load section-specific data
  if (sectionId === 'dashboard-section') {
    AdminDashboard.load();
  } else if (sectionId === 'users-section') {
    AdminUsers.loadUsers();
  } else if (sectionId === 'images-section') {
    AdminImages.loadImages();
  } else if (sectionId === 'categories-section') {
    AdminCategories.loadCategories();
    AdminCategories.loadCategoriesForProducts();
  } else if (sectionId === 'api-docs-section') {
    initSwaggerUI();
  } else if (sectionId === 'api-keys-section') {
    AdminAPIKeys.loadAPIKeys();
  } else if (sectionId === 'orders-section') {
    AdminOrders.loadOrders();
  } else if (sectionId === 'quotes-section') {
    AdminQuotes.loadQuotes();
  } else if (sectionId === 'discounts-section') {
    AdminDiscounts.loadDiscounts();
  } else if (sectionId === 'logs-section') {
    AdminLogs.init();
  } else if (sectionId === 'backup-section') {
    AdminBackup.load();
  } else if (sectionId === 'newsletter-section') {
    const newsletter = window.AdminNewsletter;
    if (newsletter) {
      newsletter.loadSubscribers();
      newsletter.loadCampaigns();
    } else {
      console.error('Module newsletter indisponible');
    }
  } else if (sectionId === 'roles-section') {
    const roles = window.AdminRoles;
    if (roles) {
      roles.loadRoles();
      roles.loadPermissions();
    } else {
      console.error('Module rôles indisponible');
    }
  }

  // Persist selection
  if (sectionBase) {
    localStorage.setItem(SECTION_STORAGE_KEY, sectionBase);
  }
}

// Navigation functions
function showCategoryProducts(categoryId, categoryName) {
  currentCategoryId = categoryId;
  currentCategoryName = categoryName;
  
  // Update titles
  document.getElementById('categoryProductsTitle').textContent = `Produits de ${categoryName}`;
  document.getElementById('categoryProductsSubtitle').textContent = `Gérer les produits de la catégorie ${categoryName}`;
  
  // Hide all sections and show category products section
  document.querySelectorAll('.section-content').forEach(section => {
    section.classList.add('d-none');
  });
  document.getElementById('category-products-section').classList.remove('d-none');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Load products for this category
  AdminProducts.loadCategoryProducts();
}

function backToCategories() {
  currentCategoryId = null;
  currentCategoryName = '';
  
  // Hide category products section and show categories
  document.querySelectorAll('.section-content').forEach(section => {
    section.classList.add('d-none');
  });
  document.getElementById('categories-section').classList.remove('d-none');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelector('[data-section="categories"]').classList.add('active');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAdmin);

// Initialize Swagger UI
function initSwaggerUI() {
  // Check if SwaggerUIBundle is available
  if (typeof SwaggerUIBundle === 'undefined') {
    console.error('SwaggerUIBundle not loaded');
    return;
  }

  // Fetch the dynamic OpenAPI spec generated by the Go API (paths rewritten via admin proxy)
  fetch('/admin/api/swagger.json')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(spec => {
      // Initialize Swagger UI with the live spec
      const ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        // Les requêtes passent par /admin/api/* → proxy Node → API Go
        // L'auth est gérée automatiquement via le cookie httpOnly côté serveur
        withCredentials: true,
        requestInterceptor: (request) => {
          // Le proxy Node.js lit le cookie authToken et ajoute Bearer automatiquement
          return request;
        }
      });

      window.ui = ui;
    })
    .catch(error => {
      console.error('Failed to load OpenAPI spec:', error);
      document.getElementById('swagger-ui').innerHTML = 
        '<div class="alert alert-danger">Erreur de chargement de la documentation API</div>';
    });
}

// Export functions
window.AdminMain = {
  currentCategoryId: () => currentCategoryId,
  currentCategoryName: () => currentCategoryName,
  showCategoryProducts,
  backToCategories,
  initSwaggerUI
};
