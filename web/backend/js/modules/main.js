/**
 * Main Module
 * Handles admin panel initialization and navigation
 */

// Global variables
let currentCategoryId = null;
let currentCategoryName = '';

// Initialize admin panel
async function initializeAdmin() {
  // Check auth before anything
  await AdminAuth.checkAdminStatus();

  // Load initial users
  AdminUsers.loadUsers();

  // Setup event listeners
  setupEventListeners();
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
      const sectionId = link.getAttribute('data-section') + '-section';
      
      // Hide all sections
      document.querySelectorAll('.section-content').forEach(section => {
        section.classList.add('d-none');
      });
      
      // Remove active class from all links
      document.querySelectorAll('.nav-link').forEach(navLink => {
        navLink.classList.remove('active');
      });
      
      // Show selected section
      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        targetSection.classList.remove('d-none');
      }
      
      // Add active class to clicked link
      link.classList.add('active');
      
      // Load section-specific data
      if (sectionId === 'users-section') {
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
      }
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

  // Handle logout
  document.getElementById('logoutAdminBtn')?.addEventListener('click', () => {
    AdminAuth.handleLogout();
  });
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

  // Fetch the OpenAPI spec and initialize Swagger
  fetch('/backend/openapi.json')
    .then(response => response.json())
    .then(spec => {
      // Initialize Swagger UI with the spec object
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
        requestInterceptor: (request) => {
          // Requests will use cookies automatically for authentication
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