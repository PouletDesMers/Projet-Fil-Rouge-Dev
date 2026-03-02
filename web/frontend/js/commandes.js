/**
 * commandes.js — Page "Mes commandes"
 * Affiche les commandes de l'utilisateur connecté.
 */

(function () {
  'use strict';

  const STATUS_CONFIG = {
    en_attente:  { label: 'En attente',  cls: 'badge-en_attente' },
    confirmee:   { label: 'Confirmée',   cls: 'badge-confirmee' },
    en_cours:    { label: 'En cours',    cls: 'badge-en_cours' },
    livree:      { label: 'Livrée',      cls: 'badge-livree' },
    annulee:     { label: 'Annulée',     cls: 'badge-annulee' },
    remboursee:  { label: 'Remboursée',  cls: 'badge-remboursee' },
  };

  function statusBadge(s) {
    const cfg = STATUS_CONFIG[s] || { label: s || 'Inconnu', cls: 'bg-secondary text-white' };
    return `<span class="badge ${cfg.cls} px-2 py-1 rounded-pill">${cfg.label}</span>`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  function showOrderDetail(order) {
    const totalTTC   = Number(order.totalAmount || 0);
    const totalHT    = totalTTC / 1.2;
    const tva        = totalTTC - totalHT;
    const promoLine  = order.promoCode
      ? `<tr><td class="text-muted"><i class="bi bi-tag-fill me-1 text-success"></i>Code promo</td>
             <td class="text-end fw-semibold text-success">${order.promoCode}</td></tr>`
      : '';

    document.getElementById('orderDetailBody').innerHTML = `
      <table class="table table-borderless mb-0">
        <tbody>
          <tr><td class="text-muted">N° commande</td>        <td class="text-end fw-semibold">#${order.id}</td></tr>
          <tr><td class="text-muted">Date</td>               <td class="text-end">${formatDate(order.orderDate)}</td></tr>
          <tr><td class="text-muted">Statut</td>             <td class="text-end">${statusBadge(order.status)}</td></tr>
          ${promoLine}
          <tr><td colspan="2"><hr class="my-2"></td></tr>
          <tr><td class="text-muted">Montant HT</td>         <td class="text-end">${totalHT.toFixed(2)} €</td></tr>
          <tr><td class="text-muted">TVA (20%)</td>          <td class="text-end">${tva.toFixed(2)} €</td></tr>
          <tr class="fw-bold fs-5">
            <td>Total TTC</td>
            <td class="text-end text-primary">${totalTTC.toFixed(2)} €</td>
          </tr>
        </tbody>
      </table>`;

    const modal = new bootstrap.Modal(document.getElementById('orderDetailModal'));
    modal.show();
  }

  function renderOrders(container, commandes) {
    if (!commandes || commandes.length === 0) {
      container.innerHTML = `
        <div class="text-center empty-state">
          <i class="bi bi-bag-x d-block text-muted"></i>
          <h5 class="mt-4 fw-semibold">Aucune commande pour l'instant</h5>
          <p class="text-muted mb-4">Découvrez nos services de cybersécurité et passez votre première commande.</p>
          <a href="/catalogue.html" class="btn btn-cyna px-4">
            <i class="bi bi-grid me-2"></i>Voir le catalogue
          </a>
        </div>`;
      return;
    }

    const rows = commandes.map((c) => `
      <tr style="cursor:pointer" onclick="window._showOrderDetail(${c.id})">
        <td class="fw-semibold text-muted ps-4">#${c.id}</td>
        <td>${formatDate(c.orderDate)}</td>
        <td class="fw-semibold">${Number(c.totalAmount || 0).toFixed(2)} €</td>
        <td>${statusBadge(c.status)}</td>
        <td>${c.promoCode ? `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-tag-fill me-1"></i>${c.promoCode}</span>` : '<span class="text-muted">—</span>'}</td>
        <td><button class="btn btn-outline-secondary btn-sm" onclick="event.stopPropagation();window._showOrderDetail(${c.id})"><i class="bi bi-eye me-1"></i>Détail</button></td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="card shadow-sm border-0 order-card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th class="ps-4">N° commande</th>
                  <th>Date</th>
                  <th>Montant TTC</th>
                  <th>Statut</th>
                  <th>Code promo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
      <p class="text-muted small mt-3 text-end">${commandes.length} commande${commandes.length > 1 ? 's' : ''}</p>`;

    // Expose showOrderDetail globally with the orders data
    const ordersMap = Object.fromEntries(commandes.map(o => [o.id, o]));
    window._showOrderDetail = (id) => showOrderDetail(ordersMap[id]);
  }

  async function loadCommandes() {
    const container = document.getElementById('ordersContainer');
    try {
      const res = await fetch('/api/mes-commandes', { credentials: 'include' });

      if (res.status === 401) {
        window.location.href = '/auth.html?redirect=/mes-commandes.html';
        return;
      }

      if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);

      const commandes = await res.json();
      renderOrders(container, Array.isArray(commandes) ? commandes : []);
    } catch (err) {
      console.error('[Commandes]', err);
      container.innerHTML = `
        <div class="alert alert-warning d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <span>Impossible de charger vos commandes. <a href="#" onclick="location.reload()">Réessayer</a></span>
        </div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Détecter le retour depuis Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      document.getElementById('checkoutSuccessBanner')?.classList.remove('d-none');

      // Confirmer la commande en DB (une seule fois)
      const pending = JSON.parse(sessionStorage.getItem('pendingOrder') || '{}');
      sessionStorage.removeItem('pendingOrder');

      fetch('/api/confirm-order', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: params.get('session_id') || null,
          totalAmount: pending.totalAmount || 0,
          demo: pending.demo || params.get('demo') === '1',
          promoCode: pending.promoCode || null,
        }),
      }).catch(e => console.warn('[confirm-order]', e.message));

      // Vider le panier local
      try { localStorage.removeItem('cartItems'); } catch (_) {}

      // Nettoyer l'URL (sans recharger)
      history.replaceState({}, '', '/mes-commandes.html');
    }

    loadCommandes();
  });
})();
