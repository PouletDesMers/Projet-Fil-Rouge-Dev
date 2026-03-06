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

  const DEVIS_STATUTS = ['devis_demande', 'devis_envoye', 'devis_accepte', 'devis_refuse'];

  const DEVIS_STATUS_CONFIG = {
    devis_demande: {
      cls:    'devis-status-demande',
      icon:   'bi-hourglass-split',
      label:  'En attente de notre équipe',
      detail: 'Votre demande a bien été reçue. Notre équipe étudie votre besoin et vous enverra un devis personnalisé sous 24–48h.',
    },
    devis_envoye: {
      cls:    'devis-status-envoye status-envoye',
      icon:   'bi-envelope-check-fill',
      label:  'Devis envoyé — en attente de votre réponse',
      detail: 'Vous avez reçu notre devis par email. Consultez-le, acceptez-le ou contactez-nous pour négocier.',
    },
    devis_accepte: {
      cls:    'devis-status-accepte status-accepte',
      icon:   'bi-check-circle-fill',
      label:  'Devis accepté',
      detail: 'Merci ! Votre accord a bien été enregistré. Notre équipe vous contactera pour les prochaines étapes.',
    },
    devis_refuse: {
      cls:    'devis-status-refuse status-refuse',
      icon:   'bi-x-circle-fill',
      label:  'Devis refusé',
      detail: 'Vous avez refusé ce devis. N’hésitez pas à nous contacter pour discuter d’une autre solution.',
    },
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
    // Exclure les devis — ils ont leur propre onglet
    const orders = commandes.filter(c => !DEVIS_STATUTS.includes(c.status));

    if (!orders || orders.length === 0) {
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

    const rows = orders.map((c) => `
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
      <p class="text-muted small mt-3 text-end">${orders.length} commande${orders.length > 1 ? 's' : ''}</p>`;

    // Expose showOrderDetail globally with the orders data
    const ordersMap = Object.fromEntries(orders.map(o => [o.id, o]));
    window._showOrderDetail = (id) => showOrderDetail(ordersMap[id]);
  }

  // ── Devis ──────────────────────────────────────────────────────────────────

  function renderDevis(container, devis) {
    if (!devis || devis.length === 0) {
      container.innerHTML = `
        <div class="text-center empty-state">
          <i class="bi bi-file-earmark-text d-block text-muted"></i>
          <h5 class="mt-4 fw-semibold">Aucun devis pour l'instant</h5>
          <p class="text-muted mb-4">Vous pouvez demander un devis personnalisé depuis la page d'un produit.</p>
          <a href="/catalogue.html" class="btn btn-cyna px-4">
            <i class="bi bi-grid me-2"></i>Voir le catalogue
          </a>
        </div>`;
      // Update badge
      const badge = document.getElementById('devisBadgeCount');
      if (badge) { badge.textContent = '0'; badge.classList.add('d-none'); }
      return;
    }

    // Update badge
    const badge = document.getElementById('devisBadgeCount');
    if (badge) { badge.textContent = devis.length; badge.classList.remove('d-none'); }

    const cards = devis.map(d => {
      const cfg     = DEVIS_STATUS_CONFIG[d.status] || { cls: 'bg-secondary text-white', icon: 'bi-question-circle', label: d.status, detail: '' };
      const statusCls = cfg.cls.split(' ').find(c => c.startsWith('status-')) || '';
      const amount  = d.amount > 0
        ? `<span class="fw-bold fs-5">${Number(d.amount).toFixed(2)} €</span> <span class="text-muted small">TTC</span>`
        : `<span class="text-muted fst-italic">Prix en cours de définition</span>`;

      const ctaBtn = d.hostedUrl
        ? `<a href="${d.hostedUrl}" target="_blank" class="quote-cta mt-3">
             <i class="bi bi-file-earmark-pdf-fill"></i>Voir et répondre au devis
           </a>`
        : '';

      const msgLine = d.message
        ? `<p class="text-muted small mb-0 mt-2"><i class="bi bi-chat-left-text me-1"></i><em>${d.message}</em></p>`
        : '';

      return `
        <div class="card border-0 shadow-sm devis-card ${statusCls} mb-3">
          <div class="card-body p-4">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div class="flex-fill">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <span class="text-muted small">#${d.id}</span>
                  <span class="text-muted small">·</span>
                  <span class="text-muted small">${formatDate(d.date)}</span>
                </div>
                <h6 class="fw-bold mb-1 fs-5">${d.productName}<span class="text-muted fw-normal fs-6 ms-2">&times;${d.quantity}</span></h6>
                <div class="d-flex align-items-center gap-2 mt-2">
                  <span class="badge rounded-3 px-3 py-2 ${cfg.cls}">
                    <i class="bi ${cfg.icon} me-1"></i>${cfg.label}
                  </span>
                </div>
                <p class="text-muted small mb-0 mt-2">${cfg.detail}</p>
                ${msgLine}
              </div>
              <div class="text-end">
                ${amount}
                ${ctaBtn}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = cards +
      `<p class="text-muted small text-end mt-1">${devis.length} devis</p>`;
  }

  window.loadDevis = async function() {
    window._devisLoaded = true;
    const container = document.getElementById('devisContainer');
    if (!container) return;
    try {
      const res = await fetch('/api/mes-devis', { credentials: 'include' });
      if (res.status === 401) { window.location.href = '/auth.html?redirect=/mes-commandes.html?tab=devis'; return; }
      if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
      const devis = await res.json();
      renderDevis(container, Array.isArray(devis) ? devis : []);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle-fill me-2"></i>Impossible de charger vos devis. <a href="#" onclick="location.reload()">Réessayer</a></div>`;
    }
  };

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
