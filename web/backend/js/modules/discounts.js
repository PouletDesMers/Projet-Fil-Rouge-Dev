/**
 * AdminDiscounts — Gestion des codes promo
 * Panel d'administration CYNA
 */

const AdminDiscounts = (() => {
  let stripeActive = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function typeBadge(type) {
    return type === 'percent'
      ? '<span class="badge bg-info text-dark">%</span>'
      : '<span class="badge bg-warning text-dark">€</span>';
  }

  function sourceBadge(source) {
    if (!source || source === 'local') return '<span class="badge bg-secondary">Local</span>';
    if (source === 'stripe') return '<span class="badge" style="background:#635bff">Stripe</span>';
    return '<span class="badge bg-primary">Local + Stripe</span>';
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderTable(codes) {
    const container = document.getElementById('discountsContainer');
    if (!container) return;

    if (!codes || !codes.length) {
      container.innerHTML = `
        <div class="card">
          <div class="card-body text-center py-5 text-muted">
            <i class="bi bi-percent" style="font-size:2.5rem"></i>
            <p class="mt-2 mb-0">Aucun code promo configuré.</p>
          </div>
        </div>`;
      return;
    }

    const rows = codes.map(c => `
      <tr>
        <td class="ps-3">
          <code class="fw-bold text-dark fs-6">${c.code}</code>
        </td>
        <td>${typeBadge(c.type)}</td>
        <td class="fw-semibold">
          ${c.type === 'percent'
            ? `${c.discount}%`
            : `${Number(c.discount).toFixed(2).replace('.', ',')} €`}
        </td>
        <td>${sourceBadge(c.source)}</td>
        <td>
          ${c.timesRedeemed != null
            ? `<span class="text-muted small">${c.timesRedeemed} utilisation${c.timesRedeemed !== 1 ? 's' : ''}</span>`
            : '<span class="text-muted small">—</span>'}
        </td>
        <td>
          <span class="badge ${c.active !== false ? 'bg-success' : 'bg-secondary'}">
            ${c.active !== false ? 'Actif' : 'Inactif'}
          </span>
        </td>
        <td>
          ${c.source !== 'stripe'
            ? `<button class="btn btn-sm btn-outline-danger"
                 onclick="AdminDiscounts.deleteCode('${c.code}')"
                 title="Supprimer">
                 <i class="bi bi-trash"></i>
               </button>`
            : `<span class="text-muted small">Gérer via <a href="https://dashboard.stripe.com/coupons" target="_blank">Stripe</a></span>`}
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="card">
        <div class="card-body p-0">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-3">Code</th>
                <th>Type</th>
                <th>Valeur</th>
                <th>Source</th>
                <th>Utilisations</th>
                <th>Statut</th>
                <th style="width:120px">Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="card-footer text-muted small">
          ${codes.length} code${codes.length > 1 ? 's' : ''} configuré${codes.length > 1 ? 's' : ''}
        </div>
      </div>`;
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  async function loadDiscounts() {
    const container    = document.getElementById('discountsContainer');
    const statusBadge  = document.getElementById('stripeStatusBadge');

    if (container) {
      container.innerHTML = `
        <div class="d-flex justify-content-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>`;
    }

    try {
      const res = await fetch('/admin/api/discounts', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      stripeActive = data.stripeActive;

      // Afficher l'indicateur Stripe
      if (statusBadge) {
        if (data.stripeActive) {
          statusBadge.innerHTML = `
            <span class="badge text-white px-3 py-2" style="background:#635bff;font-size:.85rem">
              <i class="bi bi-check-circle me-1"></i>Stripe connecté — les codes Stripe sont chargés automatiquement
            </span>`;
        } else {
          statusBadge.innerHTML = `
            <div class="alert alert-info alert-sm py-2 mb-0">
              <i class="bi bi-info-circle me-2"></i>
              Stripe non actif — seuls les codes locaux sont disponibles.
              <a href="https://dashboard.stripe.com" target="_blank" class="alert-link ms-1">Configurer Stripe</a>
            </div>`;
        }
      }

      // Masquer/afficher l'option "Créer dans Stripe" dans la modal
      const stripeCheck = document.getElementById('stripeCreateCheck');
      if (stripeCheck) stripeCheck.style.display = data.stripeActive ? '' : 'none';

      renderTable(data.codes || []);
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            Impossible de charger les remises : ${err.message}
          </div>`;
      }
    }
  }

  // ── Changement type (% / €) ────────────────────────────────────────────────

  function onTypeChange() {
    const type = document.getElementById('discountType')?.value;
    const unitEl = document.getElementById('discountUnit');
    const valEl  = document.getElementById('discountValue');
    if (unitEl) unitEl.textContent = type === 'percent' ? '%' : '€';
    if (valEl) {
      valEl.max = type === 'percent' ? '100' : '9999';
      valEl.placeholder = type === 'percent' ? '20' : '10.00';
    }
  }

  // ── Créer un code ──────────────────────────────────────────────────────────

  async function createDiscount() {
    const code          = (document.getElementById('discountCode')?.value || '').toUpperCase().trim();
    const type          = document.getElementById('discountType')?.value;
    const discount      = Number(document.getElementById('discountValue')?.value);
    const createStripe  = document.getElementById('discountCreateStripe')?.checked;
    const saveBtn       = document.getElementById('discountSaveBtn');

    if (!code || !type || !discount) {
      if (window.AdminUtils?.showToast) AdminUtils.showToast('Remplissez tous les champs', 'warning');
      return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>…'; }

    try {
      const res = await fetch('/admin/api/discounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, type, discount, createInStripe: createStripe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // Fermer la modal et recharger
      bootstrap.Modal.getInstance(document.getElementById('discountCreateModal'))?.hide();
      document.getElementById('discountCreateForm')?.reset();

      await loadDiscounts();

      if (window.AdminUtils?.showToast) AdminUtils.showToast(`Code "${code}" créé avec succès`, 'success');
    } catch (err) {
      if (window.AdminUtils?.showToast) AdminUtils.showToast('Erreur : ' + err.message, 'danger');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Créer'; }
    }
  }

  // ── Supprimer un code local ────────────────────────────────────────────────

  async function deleteCode(code) {
    if (!confirm(`Supprimer le code "${code}" ?`)) return;

    try {
      const res = await fetch(`/admin/api/discounts/${encodeURIComponent(code)}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      await loadDiscounts();
      if (window.AdminUtils?.showToast) AdminUtils.showToast(`Code "${code}" supprimé`, 'success');
    } catch (err) {
      if (window.AdminUtils?.showToast) AdminUtils.showToast('Erreur : ' + err.message, 'danger');
    }
  }

  return { loadDiscounts, onTypeChange, createDiscount, deleteCode };
})();
