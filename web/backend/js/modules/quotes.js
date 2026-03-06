/**
 * AdminQuotes — Gestion des devis clients (DB + Stripe)
 */
window.AdminQuotes = (() => {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────────
  // Auth via httpOnly cookie — pas besoin d'Authorization header (identique aux autres modules admin)

  async function apiGet(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function apiPost(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  function money(v) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (_) { return iso; }
  }

  // Parse le JSON compact stocké dans promo_code
  function parseMeta(raw) {
    if (!raw) return {};
    // Si c'est déjà un ID Stripe Quote (qt_xxx), on ne parse pas
    if (raw.startsWith('qt_')) return {};
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  // ── Statuts DB ─────────────────────────────────────────────────────────────

  const DB_STATUS = {
    devis_demande: { label: 'Demandé',  cls: 'bg-info text-dark', icon: 'bi-file-earmark-text' },
    devis_envoye:  { label: 'Envoyé',   cls: 'bg-primary',        icon: 'bi-send' },
    devis_accepte: { label: 'Accepté',  cls: 'bg-success',        icon: 'bi-check2-all' },
    devis_refuse:  { label: 'Refusé',   cls: 'bg-danger',         icon: 'bi-x-circle-fill' },
  };

  // ── Statuts Stripe ─────────────────────────────────────────────────────────

  const STRIPE_STATUS = {
    draft:    { label: 'Brouillon', cls: 'bg-secondary',      icon: 'bi-pencil' },
    open:     { label: 'Envoyé',    cls: 'bg-primary',        icon: 'bi-send' },
    accepted: { label: 'Accepté',   cls: 'bg-success',        icon: 'bi-check-circle-fill' },
    canceled: { label: 'Annulé',    cls: 'bg-danger',         icon: 'bi-x-circle' },
  };

  function dbBadge(status) {
    const s = DB_STATUS[status] || { label: status || '?', cls: 'bg-secondary', icon: 'bi-question-circle' };
    return `<span class="badge ${s.cls}"><i class="bi ${s.icon} me-1"></i>${s.label}</span>`;
  }

  function stripeBadge(sq) {
    if (!sq) return '<span class="text-muted small">—</span>';
    const s = STRIPE_STATUS[sq.status] || { label: sq.status, cls: 'bg-secondary', icon: 'bi-stripe' };
    return `<span class="badge ${s.cls}"><i class="bi ${s.icon} me-1"></i>${s.label}</span>`;
  }

  // ── State ──────────────────────────────────────────────────────────────────

  let allQuotes = [];

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderTable(quotes) {
    const container = document.getElementById('quotesContainer');
    if (!container) return;

    if (!quotes.length) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>Aucun devis trouvé.
        </div>`;
      return;
    }

    const rows = quotes.map(q => {
      const sq   = q.stripeQuote;
      const meta = parseMeta(q.stripeId);

      const clientName  = sq?.customer_name  || meta.n || `User #${q.userId}`;
      const clientEmail = sq?.customer_email || meta.e || '';
      const company     = sq?.company || meta.c || '';
      const productName = sq?.product || meta.pr || '—';
      const qty         = meta.q || Number(sq?.metadata?.quantity) || 1;
      const clientPhone = sq?.phone || meta.p || '';
      const message     = sq?.message || meta.m || '';

      const companyHtml = company ? `<br><small class="text-muted"><i class="bi bi-building me-1"></i>${company}</small>` : '';
      const phoneHtml   = clientPhone ? `<br><small class="text-muted"><i class="bi bi-telephone me-1"></i>${clientPhone}</small>` : '';
      const amount      = (q.amount && q.amount > 0) ? money(q.amount) : '<span class="badge bg-secondary-subtle text-secondary border">À définir</span>';

      const pdfBtn = sq?.hosted_url
        ? `<a href="${sq.hosted_url}" target="_blank" class="btn btn-sm btn-outline-primary" title="Voir le devis Stripe">
             <i class="bi bi-file-earmark-pdf me-1"></i>PDF
           </a>`
        : '';

      const sendBtn = (q.status === 'devis_demande' || q.status === 'devis_envoye')
        ? `<button class="btn btn-sm btn-primary" title="Créer et envoyer un devis Stripe"
             onclick="AdminQuotes.openSendModal(${q.id}, '${(clientEmail).replace(/'/g,"\\'")}', '${productName.replace(/'/g,"\\'")}', ${qty})">
             <i class="bi bi-send me-1"></i>Envoyer
           </button>`
        : '';

      const msgHtml = message
        ? `<div class="mt-1 p-2 rounded small text-muted" style="background:#f8f9fa;border-left:3px solid #dee2e6;max-width:260px;word-break:break-word">
             <i class="bi bi-chat-left-text me-1"></i><em>${message}</em>
           </div>`
        : '<span class="text-muted small">—</span>';

      return `
        <tr>
          <td class="ps-3 fw-semibold">#${q.id}<br><small class="text-muted fw-normal">${fmtDate(q.date)}</small></td>
          <td>
            <span class="fw-semibold">${clientName}</span>${companyHtml}
            ${clientEmail ? `<br><small class="text-muted">${clientEmail}</small>` : ''}
            ${phoneHtml}
          </td>
          <td class="small"><span class="fw-semibold">${productName}</span><br><span class="text-muted">×${qty}</span></td>
          <td>${msgHtml}</td>
          <td class="fw-semibold">${amount}</td>
          <td>${dbBadge(q.status)}<br>${sq ? stripeBadge(sq) : ''}</td>
          <td class="d-flex gap-1 flex-wrap">${pdfBtn}${sendBtn}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th class="ps-3">Réf. / Date</th>
                  <th>Client</th>
                  <th>Produit / Qté</th>
                  <th>Message client</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th style="width:120px">Actions</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
        <div class="card-footer text-muted small">
          ${quotes.length} devis
        </div>
      </div>`;
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  async function loadQuotes() {
    const container = document.getElementById('quotesContainer');
    if (container) {
      container.innerHTML = `
        <div class="d-flex justify-content-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>`;
    }

    try {
      const data = await apiGet('/admin/api/quotes');
      allQuotes = Array.isArray(data.devis) ? data.devis : [];

      // Afficher badge Stripe
      const badge = document.getElementById('quotesStripeStatus');
      if (badge) {
        badge.innerHTML = data.stripeActive
          ? `<span class="badge bg-success-subtle text-success border border-success-subtle">
               <i class="bi bi-stripe me-1"></i>Stripe connecté — vous pouvez créer et envoyer des devis PDF
             </span>`
          : `<span class="badge bg-warning-subtle text-warning border border-warning-subtle">
               <i class="bi bi-exclamation-triangle me-1"></i>Stripe non configuré — impossible d'envoyer des devis PDF
             </span>`;
      }

      renderTable(allQuotes);
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-info-circle me-2"></i>
            Impossible de charger les devis : ${err.message}
          </div>`;
      }
    }
  }

  // ── Filtre ─────────────────────────────────────────────────────────────────

  function filterQuotes() {
    const statusVal = document.getElementById('quotesStatusFilter')?.value || '';
    const stripeVal = document.getElementById('quotesStripeFilter')?.value  || '';
    const search    = (document.getElementById('quotesSearchInput')?.value  || '').toLowerCase();

    const filtered = allQuotes.filter(q => {
      const meta = parseMeta(q.stripeId);
      const matchStatus = !statusVal || q.status === statusVal;
      const matchStripe = !stripeVal || q.stripeQuote?.status === stripeVal;
      const matchSearch = !search ||
        String(q.id).includes(search) ||
        (q.stripeQuote?.customer_name  || meta.n || '').toLowerCase().includes(search) ||
        (q.stripeQuote?.customer_email || meta.e || '').toLowerCase().includes(search) ||
        (q.stripeId || '').toLowerCase().includes(search) ||
        (meta.pr || '').toLowerCase().includes(search);
      return matchStatus && matchStripe && matchSearch;
    });

    renderTable(filtered);
  }

  // ── Modal "Envoyer devis Stripe" ──────────────────────────────────────────

  let _sendModal = null;
  let _sendQuoteId = null;

  function ensureModal() {
    if (document.getElementById('quoteSendModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal fade" id="quoteSendModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow">
            <div class="modal-header" style="background:linear-gradient(135deg,#5610c0,#7602f9);color:#fff">
              <h5 class="modal-title fw-semibold">
                <i class="bi bi-send me-2"></i>Créer et envoyer un devis Stripe
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-muted small mb-3">
                Le client recevra par email un devis PDF généré automatiquement par Stripe.<br>
                Il pourra l'accepter, le refuser ou vous contacter pour négocier.
              </p>
              <div class="mb-3">
                <label class="form-label small fw-semibold">Email client *</label>
                <input type="email" class="form-control" id="sendQuoteEmail" required placeholder="client@entreprise.com">
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold">Description du service *</label>
                <input type="text" class="form-control" id="sendQuoteProduct" required placeholder="Ex : Audit de sécurité SOC2 — 3 mois">
              </div>
              <div class="row g-2 mb-3">
                <div class="col-7">
                  <label class="form-label small fw-semibold">Prix unitaire HT (€) *</label>
                  <input type="number" class="form-control" id="sendQuotePrice" min="1" step="0.01" placeholder="1500.00">
                </div>
                <div class="col-5">
                  <label class="form-label small fw-semibold">Quantité</label>
                  <input type="number" class="form-control" id="sendQuoteQty" value="1" min="1">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold">Notes internes (facultatif)</label>
                <textarea class="form-control" id="sendQuoteNotes" rows="2" placeholder="Remarques visibles sur le devis..."></textarea>
              </div>
              <div id="sendQuoteError" class="alert alert-danger d-none small"></div>
              <div id="sendQuoteSuccess" class="alert alert-success d-none small"></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
              <button class="btn btn-primary" id="sendQuoteBtn" onclick="AdminQuotes.sendQuote()">
                <i class="bi bi-send me-1"></i>Envoyer le devis
              </button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  function openSendModal(quoteId, email, product, qty) {
    ensureModal();
    _sendQuoteId = quoteId;

    document.getElementById('sendQuoteEmail').value   = email   || '';
    document.getElementById('sendQuoteProduct').value = product || '';
    document.getElementById('sendQuoteQty').value     = qty     || 1;
    document.getElementById('sendQuotePrice').value   = '';
    document.getElementById('sendQuoteNotes').value   = '';
    document.getElementById('sendQuoteError').classList.add('d-none');
    document.getElementById('sendQuoteSuccess').classList.add('d-none');
    document.getElementById('sendQuoteBtn').disabled = false;
    document.getElementById('sendQuoteBtn').innerHTML = '<i class="bi bi-send me-1"></i>Envoyer le devis';

    if (!_sendModal) _sendModal = new bootstrap.Modal(document.getElementById('quoteSendModal'));
    _sendModal.show();
  }

  async function sendQuote() {
    const btn     = document.getElementById('sendQuoteBtn');
    const errEl   = document.getElementById('sendQuoteError');
    const succEl  = document.getElementById('sendQuoteSuccess');
    const email   = document.getElementById('sendQuoteEmail').value.trim();
    const product = document.getElementById('sendQuoteProduct').value.trim();
    const price   = parseFloat(document.getElementById('sendQuotePrice').value);
    const qty     = parseInt(document.getElementById('sendQuoteQty').value) || 1;
    const notes   = document.getElementById('sendQuoteNotes').value.trim();

    errEl.classList.add('d-none');
    succEl.classList.add('d-none');

    if (!email || !product || !price || price <= 0) {
      errEl.textContent = 'Email, description et prix sont requis.';
      errEl.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Envoi…';

    try {
      const data = await apiPost(`/admin/api/quotes/${_sendQuoteId}/send-stripe`, {
        email, productName: product, unitPrice: price, quantity: qty, notes
      });

      succEl.innerHTML = `
        <i class="bi bi-check-circle me-1"></i>Devis envoyé !
        ${data.hostedUrl ? `<a href="${data.hostedUrl}" target="_blank" class="ms-2">Voir le devis <i class="bi bi-box-arrow-up-right"></i></a>` : ''}`;
      succEl.classList.remove('d-none');
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-check2 me-1"></i>Envoyé';

      // Recharger la liste après 2s
      setTimeout(() => { loadQuotes(); _sendModal?.hide(); }, 2000);

    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send me-1"></i>Envoyer le devis';
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  return { loadQuotes, filterQuotes, openSendModal, sendQuote };
})();
