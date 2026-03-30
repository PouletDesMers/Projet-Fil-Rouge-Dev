/**
 * recherche.js — Page de résultats de recherche CYNA
 * Lit le paramètre ?q= de l'URL, interroge /api/public/search, affiche les produits.
 */

(function () {
  'use strict';

  const grid = document.getElementById('resultsGrid');
  const header = document.getElementById('resultsHeader');
  const input = document.getElementById('searchInput');
  const form = document.getElementById('searchForm');

  // Lire le paramètre q de l'URL
  function getQuery() {
    return new URLSearchParams(window.location.search).get('q') || '';
  }

  // Formatter le prix
  function formatPrice(prix, devise, duree, typeAchat) {
    if (!prix || prix === 0) return 'Sur devis';
    const currency = devise || 'EUR';
    const symbol = currency === 'EUR' ? '€' : currency;
    let label = `${prix.toFixed(2)} ${symbol}`;
    if (duree) label += ` / ${duree}`;
    return label;
  }

  // Formater le statut
  function formatStatut(statut) {
    const map = {
      disponible: 'Disponible',
      indisponible: 'Indisponible',
      bientot: 'Bientôt disponible',
    };
    return map[statut] || statut || 'Disponible';
  }

  // Construire une card produit
  function buildCard(p) {
    const card = document.createElement('article');
    card.className = 'card';

    const tag = p.tag || p.categorie_nom || '';
    const catLabel = p.categorie_nom || '';
    const prix = formatPrice(p.prix, p.devise, p.duree, p.type_achat);
    const statut = formatStatut(p.statut);
    const desc = p.description_courte || '';
    const slug = p.slug || '';
    const catSlug = p.categorie_slug || '';

    card.innerHTML = `
      <div class="cover">
        ${tag ? `<span class="tag-badge"><i class="bi bi-shield-check me-1"></i>${escapeHtml(tag)}</span>` : ''}
        ${catLabel ? `<span class="cat-badge">${escapeHtml(catLabel)}</span>` : ''}
      </div>
      <div class="card-body">
        <h2 class="card-title">${escapeHtml(p.nom)}</h2>
        <p class="card-desc">${escapeHtml(desc)}</p>
        <div class="card-meta">
          <span class="price">${escapeHtml(prix)}</span>
          <span class="status"><i class="bi bi-circle-fill me-1" style="font-size:8px;color:#16a34a;"></i>${escapeHtml(statut)}</span>
        </div>
        <a href="/produit.html?slug=${encodeURIComponent(slug)}" class="btn btn-cyna btn-action w-100">
          Voir le produit
        </a>
      </div>
    `;
    return card;
  }

  // Échapper les caractères HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Afficher l'état vide
  function showEmpty(q) {
    grid.innerHTML = `
      <div class="state-box">
        <i class="bi bi-search"></i>
        <p>Aucun résultat pour <strong>« ${escapeHtml(q)} »</strong></p>
        <p class="hint">Essayez avec d'autres mots-clés ou consultez nos <a href="/categories.html">catégories</a>.</p>
      </div>
    `;
    header.textContent = '';
  }

  // Afficher l'état initial (aucune recherche)
  function showIdle() {
    grid.innerHTML = `
      <div class="state-box">
        <i class="bi bi-search"></i>
        <p>Entrez un terme de recherche pour trouver nos solutions de cybersécurité.</p>
      </div>
    `;
    header.textContent = '';
  }

  // Afficher l'état chargement
  function showLoading() {
    grid.innerHTML = `
      <div class="state-box">
        <div class="spinner-border text-primary" role="status" style="width:48px;height:48px;">
          <span class="visually-hidden">Chargement...</span>
        </div>
        <p class="mt-3">Recherche en cours...</p>
      </div>
    `;
    header.textContent = '';
  }

  // Afficher l'état erreur
  function showError(message) {
    grid.innerHTML = `
      <div class="state-box">
        <i class="bi bi-exclamation-circle text-danger"></i>
        <p class="text-danger">${escapeHtml(message)}</p>
        <p class="hint">Vérifiez votre connexion et réessayez.</p>
      </div>
    `;
    header.textContent = '';
  }

  // Lancer la recherche
  async function doSearch(q) {
    if (!q.trim()) {
      showIdle();
      return;
    }

    showLoading();

    try {
      const res = await fetch(`/api/public/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        throw new Error(`Erreur serveur ${res.status}`);
      }
      const products = await res.json();

      if (!Array.isArray(products) || products.length === 0) {
        showEmpty(q);
        return;
      }

      // Afficher les résultats
      grid.innerHTML = '';
      header.textContent = `${products.length} résultat${products.length > 1 ? 's' : ''} pour « ${q} »`;
      products.forEach(p => grid.appendChild(buildCard(p)));

    } catch (err) {
      console.error('Erreur de recherche:', err);
      showError('Une erreur est survenue lors de la recherche. Veuillez réessayer.');
    }
  }

  // Initialisation
  function init() {
    const q = getQuery();

    // Pré-remplir le champ
    if (input && q) {
      input.value = q;
    }

    // Mettre à jour le titre de la page
    if (q) {
      document.title = `Recherche : ${q} | CYNA`;
    }

    // Lancer la recherche initiale
    doSearch(q);

    // Gérer le formulaire de recherche
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newQ = input ? input.value.trim() : '';
        // Mettre à jour l'URL sans recharger la page
        const url = new URL(window.location.href);
        url.searchParams.set('q', newQ);
        window.history.pushState({}, '', url.toString());
        document.title = newQ ? `Recherche : ${newQ} | CYNA` : 'Recherche | CYNA';
        doSearch(newQ);
      });
    }
  }

  // Attendre le DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
