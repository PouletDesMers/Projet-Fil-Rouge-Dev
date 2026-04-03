// Dynamic categories loading
async function loadCategories() {
  try {
    const response = await fetch('/api/public/categories');
    const categories = await response.json();
    
    renderCategories(categories);
  } catch (error) {
    console.error('Error loading categories:', error);
    renderErrorState();
  }
}

function renderCategories(categories) {
  const grid = document.getElementById('categoriesGrid');
  
  if (categories.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center">
        <p class="text-muted">Aucune catégorie disponible pour le moment.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = categories.map(category => `
    <a class="cat-card" href="/catalogue.html?category=${category.slug}" aria-label="Voir ${category.nom}">
      <div class="cat-cover" style="background:
        ${getCategoryImage(category) ? `url('${getCategoryImage(category)}') center/cover no-repeat,` : ''}
        radial-gradient(520px 160px at 20% 30%, ${category.couleur}55, transparent 55%),
        radial-gradient(420px 140px at 80% 20%, ${category.couleur}55, transparent 55%),
        linear-gradient(135deg, ${category.couleur}92, ${category.couleur}80);">
        <i class="${category.icone} cat-icon"></i>
        <div class="badge">Actif</div>
      </div>
      <div class="cat-body">
        <h3 class="cat-title">${category.nom}</h3>
        <p class="cat-desc">${category.description}</p>
      </div>
    </a>
  `).join('');
}

function getCategoryImage(category) {
  const placeholder = 'https://via.placeholder.com/640x360?text=Category';
  let url = category.image || '';
  if (url && url.startsWith('/')) {
    url = `${window.location.origin}${url}`;
  }
  return url || placeholder;
}

function renderErrorState() {
  const grid = document.getElementById('categoriesGrid');
  grid.innerHTML = `
    <div class="col-12 text-center">
      <div class="alert alert-warning" role="alert">
        <i class="bi bi-exclamation-triangle"></i>
        Une erreur s'est produite lors du chargement des catégories.
      </div>
      <button class="btn btn-outline-primary" onclick="loadCategories()">
        <i class="bi bi-arrow-clockwise"></i> Réessayer
      </button>
    </div>
  `;
}

// Load categories when page loads
document.addEventListener('DOMContentLoaded', loadCategories);
