/**
 * AdminOrders — Module de gestion des commandes
 * Utilisé dans le panel d'administration CYNA
 *
 * Champs API Go (JSON) : id, orderDate, totalAmount, status, userId
 */

const AdminOrders = (() => {
  let allOrders = [];
  let currentOrder = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const STATUS_CONFIG = {
    en_attente:     { label: 'En attente',     cls: 'bg-warning text-dark',  icon: 'bi-clock-history' },
    confirmee:      { label: 'Confirmée',      cls: 'bg-info text-dark',     icon: 'bi-check-circle' },
    en_cours:       { label: 'En cours',       cls: 'bg-primary',            icon: 'bi-arrow-repeat' },
    livree:         { label: 'Livrée',         cls: 'bg-success',            icon: 'bi-bag-check-fill' },
    annulee:        { label: 'Annulée',        cls: 'bg-danger',             icon: 'bi-x-circle' },
    remboursee:     { label: 'Remboursée',     cls: 'bg-secondary',          icon: 'bi-arrow-counterclockwise' },
    devis_demande:  { label: 'Devis demandé',  cls: 'bg-info text-dark',     icon: 'bi-file-earmark-text' },
    devis_envoye:   { label: 'Devis envoyé',   cls: 'bg-primary',            icon: 'bi-send' },
    devis_accepte:  { label: 'Devis accepté',  cls: 'bg-success',            icon: 'bi-check2-all' },
    devis_refuse:   { label: 'Devis refusé',   cls: 'bg-danger',             icon: 'bi-x-circle-fill' },
  };

  function statusBadge(s) {
    const cfg = STATUS_CONFIG[s] || { label: s || '—', cls: 'bg-light text-dark', icon: 'bi-question' };
    return `<span class="badge ${cfg.cls}"><i class="bi ${cfg.icon} me-1"></i>${cfg.label}</span>`;
  }

  function money(n) {
    return `${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',')} €`;
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  async function apiGet(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Render tableau ─────────────────────────────────────────────────────────

  function renderTable(orders) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="card">
          <div class="card-body text-center py-5 text-muted">
            <i class="bi bi-bag-x" style="font-size:2.5rem"></i>
            <p class="mt-2">Aucune commande trouvée.</p>
          </div>
        </div>`;
      return;
    }

    const rows = orders.map(o => `
      <tr style="cursor:pointer" onclick="AdminOrders.showOrderDetails(${o.id})">
        <td class="ps-3 fw-semibold text-muted">#${o.id}</td>
        <td>${o.userId || '—'}</td>
        <td>${fmtDate(o.orderDate)}</td>
        <td class="fw-semibold">${money(o.totalAmount)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="event.stopPropagation(); AdminOrders.showOrderDetails(${o.id})">
            <i class="bi bi-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="card">
        <div class="card-body p-0">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-3">Réf.</th>
                <th>Client (ID)</th>
                <th>Date</th>
                <th>Montant TTC</th>
                <th>Statut</th>
                <th style="width:80px">Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="card-footer text-muted small">
          ${orders.length} commande${orders.length > 1 ? 's' : ''}
        </div>
      </div>`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    if (container) {
      container.innerHTML = `
        <div class="d-flex justify-content-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>`;
    }

    try {
      const data = await apiGet('/admin/api/commandes');
      allOrders = Array.isArray(data) ? data : (data.commandes || []);
      renderTable(allOrders);
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-info-circle me-2"></i>
            Impossible de charger les commandes : ${err.message}
            <br><small class="text-muted">Vérifiez que la table <code>commandes</code> existe dans la base de données.</small>
          </div>`;
      }
    }
  }

  // ── Filtre ─────────────────────────────────────────────────────────────────

  function filterOrders() {
    const statusVal = document.getElementById('orderStatusFilter')?.value || '';
    const search    = (document.getElementById('orderSearchInput')?.value || '').toLowerCase();

    const filtered = allOrders.filter(o => {
      const matchStatus = !statusVal || o.status === statusVal;
      const matchSearch = !search ||
        String(o.id).includes(search) ||
        String(o.userId || '').toLowerCase().includes(search) ||
        (o.status || '').toLowerCase().includes(search);
      return matchStatus && matchSearch;
    });

    renderTable(filtered);
  }

  // ── Modale détails ─────────────────────────────────────────────────────────

  function showOrderDetails(id) {
    const order = allOrders.find(o => o.id === id);
    if (!order) return;

    currentOrder = order;

    // TVA simulée 20 %
    const ht  = order.totalAmount / 1.2;
    const tva = order.totalAmount - ht;

    const body = document.getElementById('orderDetailsBody');
    if (body) {
      body.innerHTML = `
        <div class="row g-3">
          <div class="col-md-6">
            <div class="card border-0 bg-light">
              <div class="card-body">
                <h6 class="card-title text-muted small text-uppercase mb-3">Informations commande</h6>
                <dl class="row mb-0 small">
                  <dt class="col-5">Référence</dt>
                  <dd class="col-7 fw-semibold">#${order.id}</dd>
                  <dt class="col-5">Date</dt>
                  <dd class="col-7">${fmtDate(order.orderDate)}</dd>
                  <dt class="col-5">Statut</dt>
                  <dd class="col-7">${statusBadge(order.status)}</dd>
                  <dt class="col-5">Code promo</dt>
                  <dd class="col-7">${order.promoCode ? `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-tag-fill me-1"></i>${order.promoCode}</span>` : '<span class="text-muted">—</span>'}</dd>
                  <dt class="col-5">Type</dt>
                  <dd class="col-7">Paiement en ligne</dd>
                </dl>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card border-0 bg-light">
              <div class="card-body">
                <h6 class="card-title text-muted small text-uppercase mb-3">Client & Montant</h6>
                <dl class="row mb-0 small">
                  <dt class="col-5">Client</dt>
                  <dd class="col-7">ID ${order.userId || '—'}</dd>
                  <dt class="col-5">Montant HT</dt>
                  <dd class="col-7">${money(ht)}</dd>
                  <dt class="col-5">TVA (20%)</dt>
                  <dd class="col-7">${money(tva)}</dd>
                  <dt class="col-5">Total TTC</dt>
                  <dd class="col-7 fw-bold text-primary fs-6">${money(order.totalAmount)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>`;
    }

    const sel = document.getElementById('orderStatusChange');
    if (sel) sel.value = order.status || 'en_attente';

    const saveBtn = document.getElementById('orderStatusSaveBtn');
    if (saveBtn) saveBtn.onclick = () => saveOrderStatus();

    new bootstrap.Modal(document.getElementById('orderDetailsModal')).show();
  }

  // ── Sauvegarder statut ─────────────────────────────────────────────────────

  async function saveOrderStatus() {
    if (!currentOrder) return;
    const newStatus = document.getElementById('orderStatusChange')?.value;
    const saveBtn   = document.getElementById('orderStatusSaveBtn');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>…';
    }

    try {
      // Envoyer tous les champs (sinon Go met totalAmount et userId à 0)
      await apiPut(`/admin/api/commandes/${currentOrder.id}`, {
        totalAmount: currentOrder.totalAmount,
        status:      newStatus,
        userId:      currentOrder.userId,
      });

      const idx = allOrders.findIndex(o => o.id === currentOrder.id);
      if (idx >= 0) allOrders[idx].status = newStatus;
      currentOrder.status = newStatus;

      bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal'))?.hide();
      filterOrders();

      if (window.AdminUtils?.showToast) AdminUtils.showToast('Statut mis à jour', 'success');
    } catch (err) {
      if (window.AdminUtils?.showToast) AdminUtils.showToast('Erreur : ' + err.message, 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check-lg"></i> Appliquer';
      }
    }
  }

  // Ajouter /admin/api/commandes dans server.js si absent
  return { loadOrders, filterOrders, showOrderDetails, saveOrderStatus };
})();
