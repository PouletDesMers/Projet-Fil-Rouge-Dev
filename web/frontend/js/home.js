/**
 * home.js - Gestion de la page d'accueil
 * Charge les catégories, produits vedettes et texte fixe
 */

// Charger les catégories
async function loadCategories() {
  try {
    const response = await fetch('/api/public/categories');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const categories = await response.json();
    
    if (!categories || categories.length === 0) {
      document.getElementById('categoriesGrid').innerHTML = 
        '<p class="text-muted">Aucune catégorie disponible</p>';
      return;
    }
    
    renderCategories(categories.filter(c => c.actif));
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error);
    document.getElementById('categoriesGrid').innerHTML = 
      '<p class="text-danger">Erreur lors du chargement des catégories</p>';
  }
}

// Afficher les catégories dans la grille
function renderCategories(categories) {
  const grid = document.getElementById('categoriesGrid');
  grid.innerHTML = '';
  
  categories.forEach(category => {
    const img = getCategoryImage(category);
    const card = document.createElement('a');
    card.href = `/catalogue.html?category=${encodeURIComponent(category.slug)}`;
    card.className = 'category-card text-decoration-none';
    card.style.borderLeftColor = category.couleur || '#7602F9';
    const bg = category.couleur || '#f3f3f3';
    card.style.background = img
      ? `url('${img}') center/cover no-repeat, linear-gradient(135deg, ${bg}66, #ffffff 80%)`
      : `linear-gradient(135deg, ${bg}1a, #ffffff 65%)`;
    
    const iconClass = category.icone || 'bi-shield';
    card.innerHTML = `
      <div class="category-card-inner">
        <i class="bi ${iconClass} category-icon" style="color: ${category.couleur}"></i>
        <h5 class="category-name">${escapeHtml(category.nom)}</h5>
        <p class="category-desc">${escapeHtml(category.description || '')}</p>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

function getCategoryImage(category) {
  const placeholder = 'https://via.placeholder.com/640x360?text=Category';
  let url = category.image || '';
  if (url && url.startsWith('/')) {
    url = `${window.location.origin}${url}`;
  }
  return url || placeholder;
}

function getFirstImage(raw, allowPlaceholder = true) {
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
  return allowPlaceholder ? 'https://via.placeholder.com/640x360?text=Produit' : '';
}

// Charger les top produits (max 6)
async function loadTopProducts() {
  try {
    const response = await fetch('/api/public/top-products');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const top = Array.isArray(data.top_products) ? data.top_products : [];
    renderTopProducts(top);
  } catch (error) {
    console.error('Erreur lors du chargement des top produits:', error);
    document.getElementById('topProductsGrid').innerHTML = 
      '<p class="text-danger">Erreur lors du chargement des produits</p>';
  }
}

// Afficher les top produits
function renderTopProducts(products) {
  const grid = document.getElementById('topProductsGrid');
  grid.innerHTML = '';
  
  if (products.length === 0) {
    grid.innerHTML = '<p class="text-muted">Aucun produit disponible</p>';
    return;
  }
  
  products.forEach(product => {
    const name = product.nom || product.product_name || product.name || 'Produit';
    const qtyVal = product.total_quantity || product.total_sales || 0;
    const unitFromTotal = product.total_amount && qtyVal > 0 ? (product.total_amount / qtyVal) : null;
    const priceBase = product.prix !== undefined && product.prix !== null ? Number(product.prix) : null;
    const priceVal = Number.isFinite(priceBase) ? priceBase : unitFromTotal;
    const price = priceVal ? `${parseFloat(priceVal).toFixed(2)}€` : 'Tarification sur devis';
    const qty   = qtyVal || '';
    const slug  = product.slug || product.product_slug || product.id_produit || '';
    const link  = slug ? `/produit.html?product=${encodeURIComponent(slug)}` : '#';
    const img   = getFirstImage(product.images, false);
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const duration = product.duree ? ` / ${product.duree}` : '';
    
    card.innerHTML = `
      ${img ? `<div class="product-thumb"><img src="${img}" alt="${escapeHtml(name)}" loading="lazy"></div>` : ''}
      <h5 class="product-name">${escapeHtml(name)}</h5>
      <p class="product-desc text-muted">${product.tag ? escapeHtml(product.tag) : ''}</p>
      <div class="product-footer">
        <span class="product-price">${price}<small>${duration}</small></span>
        <a href="${link}" class="btn btn-sm btn-primary">
          Détails
        </a>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// Charger le texte fixe
function loadFixedText() {
  try {
    const titleEl = document.getElementById('fixedTextTitle');
    const contentEl = document.getElementById('fixedTextContent');
    
    if (titleEl) titleEl.textContent = 'Bienvenue chez CYNA';
    if (contentEl) contentEl.textContent = 'Découvrez nos solutions de sécurité innovantes';
  } catch (error) {
    console.warn('Erreur texte fixe:', error);
  }
}

// Fonction utilitaire: échapper HTML (prévention XSS)
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  loadFixedText();
  loadCategories();
  loadTopProducts();
});
