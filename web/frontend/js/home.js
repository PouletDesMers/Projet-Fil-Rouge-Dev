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
    const card = document.createElement('a');
    card.href = `/categories.html?category=${encodeURIComponent(category.slug)}`;
    card.className = 'category-card text-decoration-none';
    card.style.borderLeftColor = category.couleur || '#7602F9';
    
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

// Charger les top produits (max 6)
async function loadTopProducts() {
  try {
    const response = await fetch('/api/public/categories');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const categories = await response.json();
    const activeCats = categories.filter(c => c.actif);
    
    let allProducts = [];
    
    // Récupérer produits de chaque catégorie
    for (const category of activeCats) {
      try {
        const prodResponse = await fetch(`/api/public/products/${encodeURIComponent(category.slug)}`);
        if (prodResponse.ok) {
          const products = await prodResponse.json();
          if (products && Array.isArray(products)) {
            allProducts = allProducts.concat(products);
          }
        }
      } catch (e) {
        console.warn(`Erreur pour catégorie ${category.slug}:`, e);
      }
    }
    
    // Filtrer actifs et trier: "Prioritaire" en premier
    const active = allProducts.filter(p => p.actif !== false);
    active.sort((a, b) => {
      const aPrio = a.tag === 'Prioritaire' ? 0 : 1;
      const bPrio = b.tag === 'Prioritaire' ? 0 : 1;
      return aPrio - bPrio;
    });
    
    renderTopProducts(active.slice(0, 6));
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
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const price = product.prix ? `${parseFloat(product.prix).toFixed(2)}€` : 'Tarification sur devis';
    const duration = product.duree ? ` / ${product.duree}` : '';
    
    card.innerHTML = `
      <div class="product-card-header">
        ${product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : ''}
      </div>
      <h5 class="product-name">${escapeHtml(product.nom)}</h5>
      <p class="product-desc">${escapeHtml(product.description_courte || '')}</p>
      <div class="product-footer">
        <span class="product-price">${price}<small>${duration}</small></span>
        <a href="/produit.html?id=${product.id_produit}" class="btn btn-sm btn-primary">
          Détails
        </a>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// Charger le texte fixe
async function loadFixedText() {
  try {
    const response = await fetch('/api/public/fixed-text');
    if (response.ok) {
      const data = await response.json();
      document.getElementById('fixedTextTitle').textContent = escapeHtml(data.titre || 'Message Important');
      document.getElementById('fixedTextContent').innerHTML = escapeHtml(data.contenu || '');
    } else {
      // Valeur par défaut si pas d'API
      document.getElementById('fixedTextTitle').textContent = 'Bienvenue chez CYNA';
      document.getElementById('fixedTextContent').innerHTML = 'Découvrez nos solutions de sécurité innovantes';
    }
  } catch (error) {
    console.warn('Texte fixe non disponible:', error);
    document.getElementById('fixedTextTitle').textContent = 'Bienvenue chez CYNA';
    document.getElementById('fixedTextContent').innerHTML = 'Découvrez nos solutions de sécurité innovantes';
  }
}

// Fonction utilitaire: échapper HTML (prévention XSS)
function escapeHtml(text) {
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
