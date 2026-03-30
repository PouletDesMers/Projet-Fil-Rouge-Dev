/**
 * search-suggestions.js - Suggestions de recherche en temps réel
 * Affiche des propositions de produits au fur et à mesure de la saisie
 */

let debounceTimer;
let abortController;

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('input[name="q"]');
  if (!searchInput) return;

  // Créer le conteneur de suggestions
  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.id = 'searchSuggestions';
  suggestionsContainer.className = 'search-suggestions-dropdown';
  suggestionsContainer.style.display = 'none';
  searchInput.parentElement.appendChild(suggestionsContainer);

  // Écouter les changements de texte
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(debounceTimer);
    if (abortController) abortController.abort();
    
    if (!query) {
      suggestionsContainer.style.display = 'none';
      return;
    }

    // Débounce de 300ms avant requête API
    debounceTimer = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);
  });

  // Fermer suggestions au clic en dehors
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap') && !e.target.closest('#searchSuggestions')) {
      suggestionsContainer.style.display = 'none';
    }
  });
});

async function fetchSuggestions(query) {
  try {
    abortController = new AbortController();
    
    const response = await fetch(`/api/public/search?q=${encodeURIComponent(query)}`, {
      signal: abortController.signal
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const results = await response.json();
    const suggestions = Array.isArray(results) ? results.slice(0, 5) : [];
    
    renderSuggestions(suggestions, query);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Erreur suggestions:', error);
    }
  }
}

function renderSuggestions(suggestions, query) {
  const container = document.getElementById('searchSuggestions');
  
  if (suggestions.length === 0) {
    container.style.display = 'none';
    return;
  }

  let html = '<div class="suggestions-list">';
  
  suggestions.forEach(product => {
    const isCategory = product.type === 'category' || product.type === 'service';
    const categoryName = isCategory ? (product.nom || (product.type === 'service' ? 'Service' : 'Catégorie')) : (product.categorie_nom || 'Autres');
    const price = isCategory
      ? 'Voir les offres'
      : (product.prix ? `${parseFloat(product.prix).toFixed(2)}€` : 'Sur devis');
    const slug = product.slug || '';
    const catSlug = product.categorie_slug || slug || '';
    const productUrl = isCategory
      ? `/catalogue.html?category=${encodeURIComponent(slug)}`
      : (slug
         ? `/produit.html?category=${encodeURIComponent(catSlug)}&product=${encodeURIComponent(slug)}`
         : `/produit.html?id=${product.id_produit || product.id}`);
    
    html += `
      <a href="${productUrl}" class="suggestion-item">
        <div class="suggestion-product">${escapeHtml(product.nom)}</div>
        <div class="suggestion-meta">
          <span class="suggestion-category">${escapeHtml(categoryName)}</span>
          <span class="suggestion-price">${escapeHtml(price)}</span>
        </div>
      </a>
    `;
  });
  
  html += '</div>';
  html += `<a href="/recherche.html?q=${encodeURIComponent(query)}" class="suggestions-footer">
    Voir tous les résultats →
  </a>`;
  
  container.innerHTML = html;
  container.style.display = 'block';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
