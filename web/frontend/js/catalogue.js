// Dynamic catalogue loading
let currentCategory = '';

async function loadCatalogue() {
  // Get category from URL parameter or filename
  currentCategory = getCategoryFromURL();
  
  if (!currentCategory) {
    renderErrorState('Catégorie non spécifiée');
    return;
  }

  try {
    // Load category info first
    await loadCategoryInfo();
    
    // Then load products
    await loadProducts();
  } catch (error) {
    console.error('Error loading catalogue:', error);
    renderErrorState('Erreur lors du chargement du catalogue');
  }
}

function getCategoryFromURL() {
  // First, try URL parameters (preferred method)
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category');
  if (categoryParam) {
    return categoryParam;
  }

  // Fallback: Extract category from legacy URL patterns like /catalogue-soc.html
  const path = window.location.pathname;
  const match = path.match(/catalogue-([^.]+)\.html/);
  if (match) {
    return match[1];
  }
  
  return '';
}

async function loadCategoryInfo() {
  try {
    const response = await fetch('/api/public/categories');
    const categories = await response.json();
    
    const category = categories.find(cat => cat.slug === currentCategory);
    if (!category) {
      throw new Error('Catégorie non trouvée');
    }
    
    updateCategoryUI(category);
  } catch (error) {
    console.error('Error loading category info:', error);
    // Set default values
    document.getElementById('categoryName').textContent = currentCategory.toUpperCase();
    document.getElementById('categoryTitle').textContent = `Catalogue ${currentCategory.toUpperCase()}`;
    document.getElementById('categoryDescription').textContent = 'Services de cybersécurité.';
    document.getElementById('pageTitle').textContent = `Catalogue ${currentCategory.toUpperCase()} | CYNA`;
  }
}

function updateCategoryUI(category) {
  document.getElementById('categoryName').textContent = category.nom;
  document.getElementById('categoryTitle').textContent = `Catalogue ${category.nom}`;
  document.getElementById('categoryDescription').textContent = category.description;
  document.getElementById('pageTitle').textContent = `Catalogue ${category.nom} | CYNA`;
  document.title = `Catalogue ${category.nom} | CYNA`;
}

async function loadProducts() {
  try {
    const response = await fetch(`/api/public/products/${currentCategory}`);
    const products = await response.json();
    
    renderProducts(products);
  } catch (error) {
    console.error('Error loading products:', error);
    renderErrorState('Erreur lors du chargement des produits');
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  
  if (products.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center">
        <div class="alert alert-info" role="alert">
          <i class="bi bi-info-circle"></i>
          Aucun produit disponible dans cette catégorie pour le moment.
        </div>
        <a class="btn btn-outline-primary" href="/categories.html">
          <i class="bi bi-arrow-left"></i> Retour aux catégories
        </a>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(product => renderProductCard(product)).join('');
}

function renderProductCard(product) {
  const img = getFirstImage(product.images);
  const priceDisplay = product.prix ? 
    `<span class="price">${product.prix}€ / ${product.duree}</span>` : 
    `<span class="price">Sur devis</span>`;

  const categorySlug = getCategoryFromURL();
  const productUrl = `/produit.html?category=${categorySlug}&product=${product.slug}`;
  const coverStyle = `background-image:url('${img}');background-size:cover;background-position:center;background-color:#f5f5f5;`;

  const actionButton = product.type_achat === 'devis' ?
    `<div class="d-grid gap-2">
      <a href="${productUrl}" class="btn btn-outline-secondary">
        <i class="bi bi-eye"></i> Voir le produit
      </a>
      <button class="btn btn-outline-primary btn-action" onclick="requestQuote('${product.nom}')">
        <i class="bi bi-file-earmark"></i> Demander un devis
      </button>
    </div>` :
    `<div class="d-grid gap-2">
      <a href="${productUrl}" class="btn btn-outline-secondary">
        <i class="bi bi-eye"></i> Voir le produit
      </a>
      <button class="btn btn-cyna btn-action" onclick="addProductToCart('${product.slug}', '${product.nom}', ${product.prix || 0}, '${product.duree}')">
        <i class="bi bi-cart-plus"></i> Ajouter au panier
      </button>
    </div>`;

  return `
    <div class="card">
      <div class="cover" style="${coverStyle}">
        <span class="tag">${product.tag}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">
          <a href="${productUrl}" style="text-decoration: none; color: inherit;">
            ${product.nom}
          </a>
        </h3>
        <p class="card-desc">${product.description_courte}</p>
        <div class="card-meta">
          ${priceDisplay}
          <span class="status">${product.statut}</span>
        </div>
        <div class="mt-3">
          ${actionButton}
        </div>
      </div>
    </div>
  `;
}

function getFirstImage(raw) {
  let images = [];
  try {
    if (Array.isArray(raw)) {
      images = raw;
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) images = parsed;
      else if (typeof parsed === 'string') images = [parsed];
    }
  } catch (_) { images = []; }
  const origin = window.location.origin;
  for (const img of images) {
    let url = '';
    if (typeof img === 'string') url = img;
    else if (img && typeof img === 'object') url = img.url || img.url_image || img.src || '';
    if (url && url.startsWith('/')) url = `${origin}${url}`;
    if (url) return url;
  }
  return 'https://via.placeholder.com/640x360?text=Produit';
}

function renderErrorState(message) {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = `
    <div class="col-12 text-center">
      <div class="alert alert-warning" role="alert">
        <i class="bi bi-exclamation-triangle"></i>
        ${message}
      </div>
      <div class="btn-group" role="group">
        <button class="btn btn-outline-primary" onclick="loadCatalogue()">
          <i class="bi bi-arrow-clockwise"></i> Réessayer
        </button>
        <a class="btn btn-outline-secondary" href="/categories.html">
          <i class="bi bi-arrow-left"></i> Retour aux catégories
        </a>
      </div>
    </div>
  `;
}

function addProductToCart(id, name, price, duration) {
  addToCart({ id, slug: id, name, price, qty: 1, duration });
  showToast('success', `✓ ${name} ajouté au panier`);
}

function requestQuote(productName) {
  showToast('info', `Demande de devis pour ${productName} en cours de traitement...\\n\\nUn email sera envoyé pour confirmer.`);
}

function showToast(type, message) {
  // Simple toast implementation
  const toast = document.createElement('div');
  toast.className = `alert alert-${type === 'success' ? 'success' : 'info'} position-fixed`;
  toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  toast.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi bi-${type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
      ${message.replace('\\n\\n', '<br><br>')}
    </div>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Load catalogue when page loads
document.addEventListener('DOMContentLoaded', loadCatalogue);
