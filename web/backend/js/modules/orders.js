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
    en_attente: {
      label: "En attente",
      cls: "bg-warning text-dark",
      icon: "bi-clock-history",
    },
    confirmee: {
      label: "Confirmée",
      cls: "bg-info text-dark",
      icon: "bi-check-circle",
    },
    en_cours: { label: "En cours", cls: "bg-primary", icon: "bi-arrow-repeat" },
    livree: { label: "Livrée", cls: "bg-success", icon: "bi-bag-check-fill" },
    annulee: { label: "Annulée", cls: "bg-danger", icon: "bi-x-circle" },
    remboursee: {
      label: "Remboursée",
      cls: "bg-secondary",
      icon: "bi-arrow-counterclockwise",
    },
    devis_demande: {
      label: "Devis demandé",
      cls: "bg-info text-dark",
      icon: "bi-file-earmark-text",
    },
    devis_envoye: { label: "Devis envoyé", cls: "bg-primary", icon: "bi-send" },
    devis_accepte: {
      label: "Devis accepté",
      cls: "bg-success",
      icon: "bi-check2-all",
    },
    devis_refuse: {
      label: "Devis refusé",
      cls: "bg-danger",
      icon: "bi-x-circle-fill",
    },
  };

  function statusBadge(s) {
    const cfg = STATUS_CONFIG[s] || {
      label: s || "—",
      cls: "bg-light text-dark",
      icon: "bi-question",
    };
    return `<span class="badge ${cfg.cls}"><i class="bi ${cfg.icon} me-1"></i>${cfg.label}</span>`;
  }

  function money(n) {
    return `${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",")} €`;
  }

  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  async function apiGet(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Render tableau ─────────────────────────────────────────────────────────

  function renderTable(orders) {
    const container = document.getElementById("ordersContainer");
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

    const rows = orders
      .map(
        (o) => `
      <tr style="cursor:pointer" onclick="AdminOrders.showOrderDetails(${o.id})">
        <td class="ps-3 fw-semibold text-muted">#${o.id}</td>
        <td>${o.userId || "—"}</td>
        <td>${fmtDate(o.orderDate)}</td>
        <td class="fw-semibold">${money(o.totalAmount)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="event.stopPropagation(); AdminOrders.showOrderDetails(${o.id})">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); AdminOrders.generateInvoice(${o.id})" title="Générer la facture">
            <i class="bi bi-file-earmark-pdf"></i>
          </button>
        </td>
      </tr>
    `,
      )
      .join("");

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
          ${orders.length} commande${orders.length > 1 ? "s" : ""}
        </div>
      </div>`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function loadOrders() {
    const container = document.getElementById("ordersContainer");
    if (container) {
      container.innerHTML = `
        <div class="d-flex justify-content-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>`;
    }

    try {
      const data = await apiGet("/admin/api/commandes");
      allOrders = Array.isArray(data) ? data : data.commandes || [];
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
    const statusVal = document.getElementById("orderStatusFilter")?.value || "";
    const search = (
      document.getElementById("orderSearchInput")?.value || ""
    ).toLowerCase();

    const filtered = allOrders.filter((o) => {
      const matchStatus = !statusVal || o.status === statusVal;
      const matchSearch =
        !search ||
        String(o.id).includes(search) ||
        String(o.userId || "")
          .toLowerCase()
          .includes(search) ||
        (o.status || "").toLowerCase().includes(search);
      return matchStatus && matchSearch;
    });

    renderTable(filtered);
  }

  // ── Modale détails ─────────────────────────────────────────────────────────

  function showOrderDetails(id) {
    const order = allOrders.find((o) => o.id === id);
    if (!order) return;

    currentOrder = order;

    // TVA simulée 20 %
    const ht = order.totalAmount / 1.2;
    const tva = order.totalAmount - ht;
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsRows = items.length
      ? items
          .map((it) => {
            const qty = Number(it.quantity || it.qty || 1);
            const price = Number(it.price || 0);
            const name = it.product_name || it.productName || "Produit";
            const dur = it.duration
              ? `<div class="text-muted small">${it.duration}</div>`
              : "";
            return `<tr>
        <td><div class="fw-semibold">${name}</div>${dur}</td>
        <td class="text-center">${qty}</td>
        <td class="text-end">${price.toFixed(2)} €</td>
        <td class="text-end fw-semibold">${(price * qty).toFixed(2)} €</td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="4" class="text-muted text-center">Aucun article enregistré</td></tr>`;

    const body = document.getElementById("orderDetailsBody");
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
                  <dd class="col-7">ID ${order.userId || "—"}</dd>
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
      body.innerHTML += `
        <div class="card border-0 shadow-sm mt-3">
          <div class="card-body">
            <h6 class="card-title text-muted small text-uppercase mb-3">Articles</h6>
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Produit</th>
                    <th class="text-center">Qté</th>
                    <th class="text-end">Prix</th>
                    <th class="text-end">Sous-total</th>
                  </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }

    const sel = document.getElementById("orderStatusChange");
    if (sel) sel.value = order.status || "en_attente";

    const saveBtn = document.getElementById("orderStatusSaveBtn");
    if (saveBtn) saveBtn.onclick = () => saveOrderStatus();

    new bootstrap.Modal(document.getElementById("orderDetailsModal")).show();
  }

  // ── Sauvegarder statut ─────────────────────────────────────────────────────

  async function saveOrderStatus() {
    if (!currentOrder) return;
    const newStatus = document.getElementById("orderStatusChange")?.value;
    const saveBtn = document.getElementById("orderStatusSaveBtn");

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1"></span>…';
    }

    try {
      // Envoyer tous les champs (sinon Go met totalAmount et userId à 0)
      await apiPut(`/admin/api/commandes/${currentOrder.id}`, {
        totalAmount: currentOrder.totalAmount,
        status: newStatus,
        userId: currentOrder.userId,
      });

      const idx = allOrders.findIndex((o) => o.id === currentOrder.id);
      if (idx >= 0) allOrders[idx].status = newStatus;
      currentOrder.status = newStatus;

      bootstrap.Modal.getInstance(
        document.getElementById("orderDetailsModal"),
      )?.hide();
      filterOrders();

      if (window.AdminUtils?.showToast)
        AdminUtils.showToast("Statut mis à jour", "success");
    } catch (err) {
      if (window.AdminUtils?.showToast)
        AdminUtils.showToast("Erreur : " + err.message, "danger");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check-lg"></i> Appliquer';
      }
    }
  }

  // ── Facture HTML ───────────────────────────────────────────────────
  function generateInvoice(id) {
    const order = allOrders.find((o) => o.id === id);
    if (!order) return;

    const ht = order.totalAmount / 1.2;
    const tva = order.totalAmount - ht;
    const items = Array.isArray(order.items) ? order.items : [];
    const today = new Date().toLocaleDateString("fr-FR");
    const ref = `F-${String(id).padStart(6, "0")}`;

    const itemsRows = items.length
      ? items
          .map((it) => {
            const q = Number(it.quantity || it.qty || 1);
            const p = Number(it.price || 0);
            return `<tr><td>${it.product_name || it.productName || "Produit"}</td><td class="text-center">${q}</td><td class="text-end">${p.toFixed(2)} €</td><td class="text-end">${(p * q).toFixed(2)} €</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="4">Aucun article</td></tr>`;

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Facture ${ref} | CYNA</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;padding:40px 50px;color:#1a1a2e;max-width:800px;margin:0 auto}
      h1{color:#7602F9;font-size:1.8em}.header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #7602F9}
      .header .logo{color:#7602F9;font-weight:700;font-size:1.5em}.header .ref{text-align:right}
      .ref .num{font-size:1.4em;font-weight:700;color:#5610C0}.ref .date{color:#888;font-size:.85em}
      .info{margin:25px 0;display:flex;gap:30px}.info>div{flex:1}.info h3{color:#5610C0;font-size:.9em;margin-bottom:8px;text-transform:uppercase}.info p{font-size:.85em;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin:25px 0}th{background:#0a1628;color:#00d4aa;padding:10px 12px;text-align:left;font-size:.85em}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:.85em}.totals{float:right;width:300px;margin-top:20px}
      .totals tr td:last-child{text-align:right;font-weight:600}.totals .grand{font-size:1.2em;color:#7602F9}
      .footer{margin-top:60px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:.75em;color:#888}
      @media print{.print-btn{display:none}}
    </style></head><body>

    <div class="header">
      <div class="logo">🛡️ CYNA</div>
      <div class="ref"><div class="num">${ref}</div><div class="date">${today}</div></div>
    </div>
    <div class="info">
      <div><h3>Émetteur</h3><p>CYNA SAS<br>123 Rue de la Cybersécurité<br>75000 Paris<br>SIRET: 123 456 789 00010</p></div>
      <div><h3>Client</h3><p>Client ID: ${order.userId || "—"}<br>Commande N° ${order.id}<br>Date: ${fmtDate(order.orderDate)}</p></div>
    </div>
    <table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unit.</th><th>Sous-total</th></tr></thead><tbody>${itemsRows}</tbody></table>
    <div class="totals"><table><tr><td>Sous-total HT</td><td>${money(ht)}</td></tr><tr><td>TVA (20%)</td><td>${money(tva)}</td></tr><tr class="grand"><td>Total TTC</td><td>${money(order.totalAmount)}</td></tr></table></div>
    <div class="footer">CYNA SAS — Capital social 50 000€ — RCS Paris — TVA FR12345678900<br>Facture générée le ${today}</div>
  </body></html>`;

    const w = window.open("", `Facture-${ref}`, "width=900,height=700");
    w.document.write(html);
    w.document.close();
  }

  return {
    loadOrders,
    filterOrders,
    showOrderDetails,
    saveOrderStatus,
    generateInvoice,
  };
})();
