// Load categories from API
async function loadCategories() {
  try {
    const response = await fetch('/api/public/categories');
    if (!response.ok) {
      throw new Error('Erreur lors du chargement des catégories');
    }

    const categories = await response.json();
    if (!categories || categories.length === 0) {
      console.warn('Aucune catégorie disponible');
      document.getElementById('categoriesGrid').innerHTML = 
        '<p class="text-muted text-center col-12">Aucune catégorie disponible pour le moment</p>';
      return;
    }

    renderCategories(categories);
  } catch (error) {
    console.error('Error loading categories:', error);
    document.getElementById('categoriesGrid').innerHTML = 
      '<p class="text-danger text-center col-12">Erreur lors du chargement des catégories</p>';
  }
}

// Render categories grid
function renderCategories(categories) {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;

  grid.innerHTML = categories.map(cat => `
    <a href="/categories.html?cat=${encodeURIComponent(cat.slug)}" class="category-card" style="border-color: ${cat.couleur || '#5610C0'}">
      <span class="category-card-icon">
        <i class="${cat.icone || 'bi bi-package'}"></i>
      </span>
      <h3 class="category-card-title">${escapeHtml(cat.nom)}</h3>
      <p class="category-card-description">${escapeHtml(cat.description || 'Découvrez nos produits')}</p>
    </a>
  `).join('');
}

// Load top products (by priority or order)
async function loadTopProducts() {
  try {
    // Fetch all categories first
    const categoriesResponse = await fetch('/api/public/categories');
    if (!categoriesResponse.ok) {
      throw new Error('Erreur lors du chargement des catégories');
    }

    const categories = await categoriesResponse.json();
    if (!categories || categories.length === 0) {
      console.warn('Aucune catégorie disponible');
      return;
    }

    let allProducts = [];

    // Fetch products from each category
    for (const category of categories) {
      try {
        const productsResponse = await fetch(`/api/public/products/${encodeURIComponent(category.slug)}`);
        if (productsResponse.ok) {
          const products = await productsResponse.json();
          if (products && Array.isArray(products)) {
            allProducts = allProducts.concat(products);
          }
        }
      } catch (err) {
        console.warn(`Could not fetch products for category ${category.slug}:`, err);
      }
    }

    if (allProducts.length === 0) {
      console.warn('Aucun produit disponible');
      document.getElementById('topProductsGrid').innerHTML = 
        '<p class="text-muted text-center col-12">Aucun produit disponible pour le moment</p>';
      return;
    }

    // Filter and sort top products
    // Priority: products with tag "Prioritaire" or top by ordre_affichage
    const topProducts = allProducts
      .filter(p => p.actif)
      .sort((a, b) => {
        // Prioritize items with "Prioritaire" tag
        if (a.tag === 'Prioritaire' && b.tag !== 'Prioritaire') return -1;
        if (a.tag !== 'Prioritaire' && b.tag === 'Prioritaire') return 1;
        // Then sort by order_affichage
        return (a.ordre_affichage || 0) - (b.ordre_affichage || 0);
      })
      .slice(0, 6); // Limit to 6 top products

    if (topProducts.length > 0) {
      renderTopProducts(topProducts);
    } else {
      document.getElementById('topProductsGrid').innerHTML = 
        '<p class="text-muted text-center col-12">Aucun produit vedette disponible</p>';
    }
  } catch (error) {
    console.error('Error loading top products:', error);
    document.getElementById('topProductsGrid').innerHTML = 
      '<p class="text-danger text-center col-12">Erreur lors du chargement des produits</p>';
  }
}

// Render top products grid
function renderTopProducts(products) {
  const grid = document.getElementById('topProductsGrid');
  if (!grid) return;

  grid.innerHTML = products.map(product => `
    <a href="/produit.html?id=${product.id_produit}" class="product-card">
      <div class="product-card-header">
        ${product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : ''}
      </div>
      <div class="product-card-body">
        <h3 class="product-card-title">${escapeHtml(product.nom)}</h3>
        <p class="product-card-description">${escapeHtml(product.description_courte || 'Produit de qualité')}</p>
        ${product.prix ? `<div class="product-card-price">${product.prix}€<span style="font-size: 12px; color: #999; margin-left: 8px;">/ ${escapeHtml(product.duree || 'mois')}</span></div>` : ''}
        <button class="product-card-link">Voir les détails</button>
      </div>
    </a>
  `).join('');
}

// Load fixed text (hardcoded for now, can be replaced with API call)
function loadFixedText() {
  const title = document.getElementById('fixedTextTitle');
  const content = document.getElementById('fixedTextContent');

  if (title && content) {
    // For now, use default text
    // Future: Replace with API call to /api/public/fixed-content
    title.textContent = 'Bienvenue sur CYNA';
    content.textContent = 'Découvrez nos solutions de sécurité innovantes et fiables. Nous proposons une large gamme de produits et services pour protéger votre entreprise. Nos experts sont à votre écoute pour vous accompagner dans votre transformation digitale.';
  }
}

// Helper function to escape HTML characters
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadFixedText();
  loadCategories();
  loadTopProducts();
});
