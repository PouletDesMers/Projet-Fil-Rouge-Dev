// Abonnements Management

function buildSubHeaders(includeJson) {
  var headers = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  var token =
    AdminAuth && AdminAuth.getAuthToken ? AdminAuth.getAuthToken() : null;
  if (token) headers["Authorization"] = "Bearer " + token;
  return headers;
}

var STATUS_SUB = {
  actif: { label: "Actif", cls: "bg-success" },
  suspendu: { label: "Suspendu", cls: "bg-warning text-dark" },
  resilie: { label: "Résilié", cls: "bg-danger" },
  expire: { label: "Expiré", cls: "bg-secondary" },
};

function subBadge(s) {
  var cfg = STATUS_SUB[s] || { label: s || "—", cls: "bg-light text-dark" };
  return '<span class="badge ' + cfg.cls + '">' + cfg.label + "</span>";
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtPrice(p, unit) {
  if (p == null) return "—";
  return (
    parseFloat(p).toFixed(2).replace(".", ",") +
    " €" +
    (unit ? " / " + unit : "")
  );
}

async function loadAbonnements() {
  try {
    var container = document.getElementById("abonnementsContainer");
    if (!container) return;
    container.innerHTML =
      '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    var res = await fetch("/admin/api/abonnements", {
      headers: buildSubHeaders(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Erreur lors du chargement");
    var subs = await res.json();

    if (!subs || !subs.length) {
      container.innerHTML =
        '<div class="alert alert-info">Aucun abonnement trouvé</div>';
      return;
    }

    var rows = subs
      .map(function (a) {
        return (
          "<tr>" +
          "<td><strong>#" +
          a.id +
          "</strong></td>" +
          "<td>" +
          (a.companyName || "Entreprise #" + a.companyId) +
          "</td>" +
          "<td>" +
          (a.productName || "Produit #" + a.productId) +
          "</td>" +
          '<td><span class="fw-semibold">' +
          fmtPrice(a.price, a.periodicity) +
          "</span></td>" +
          "<td>" +
          (a.quantity != null ? a.quantity : "—") +
          "</td>" +
          "<td>" +
          fmtDate(a.startDate) +
          "</td>" +
          "<td>" +
          fmtDate(a.endDate) +
          "</td>" +
          "<td>" +
          subBadge(a.status) +
          "</td>" +
          "<td>" +
          (a.autoRenewal
            ? '<span class="badge bg-info"><i class="bi bi-arrow-repeat me-1"></i>Auto</span>'
            : '<span class="badge bg-light text-dark">Manuel</span>') +
          "</td>" +
          "<td>" +
          '<button class="btn btn-sm btn-outline-primary me-1" onclick="AdminSubscriptions.editSubscription(' +
          a.id +
          ')" title="Éditer"><i class="bi bi-pencil"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="AdminSubscriptions.deleteSubscription(' +
          a.id +
          ')" title="Supprimer"><i class="bi bi-trash"></i></button>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    container.innerHTML =
      '<div class="table-responsive">' +
      '<table class="table table-hover table-sm align-middle" aria-label="Liste des abonnements">' +
      '<caption class="visually-hidden">Abonnements actifs et historiques</caption>' +
      '<thead class="table-light"><tr>' +
      '<th scope="col">#</th><th scope="col">Entreprise</th><th scope="col">Produit</th><th scope="col">Prix</th>' +
      '<th scope="col">Qté</th><th scope="col">Début</th><th scope="col">Fin</th>' +
      '<th scope="col">Statut</th><th scope="col">Renouvellement</th><th scope="col">Actions</th>' +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>" +
      "</div>";
  } catch (e) {
    var c = document.getElementById("abonnementsContainer");
    if (c)
      c.innerHTML =
        '<div class="alert alert-danger">Erreur : ' + e.message + "</div>";
  }
}

async function saveSubscription(id) {
  var isNew = !id;
  var body = {
    startDate: document.getElementById("subStartDate").value,
    endDate: document.getElementById("subEndDate").value || null,
    quantity: parseInt(document.getElementById("subQuantity").value) || null,
    status: document.getElementById("subStatus").value,
    autoRenewal: document.getElementById("subAutoRenewal").checked,
    companyId: parseInt(document.getElementById("subCompany").value),
    productId: parseInt(document.getElementById("subProduct").value),
    pricingId: parseInt(document.getElementById("subPricing").value),
  };
  if (!body.startDate || !body.companyId || !body.productId) {
    showToast("Veuillez remplir tous les champs obligatoires", "warning");
    return;
  }
  var url = isNew ? "/admin/api/abonnements" : "/admin/api/abonnements/" + id;
  var method = isNew ? "POST" : "PUT";
  try {
    var res = await fetch(url, {
      method: method,
      headers: buildSubHeaders(true),
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Erreur serveur");
    showToast(isNew ? "Abonnement créé" : "Abonnement modifié", "success");
    var modal = bootstrap.Modal.getInstance(
      document.getElementById("subModal"),
    );
    if (modal) modal.hide();
    loadAbonnements();
  } catch (e) {
    showToast("Erreur : " + e.message, "danger");
  }
}

function openSubModal(id) {
  var form = document.getElementById("subForm");
  if (form) form.reset();
  document.getElementById("subId").value = id || "";
  document.getElementById("subModalLabel").textContent = id
    ? "Modifier l'abonnement"
    : "Nouvel abonnement";

  if (id) {
    fetch("/admin/api/abonnements/" + id, {
      headers: buildSubHeaders(),
      credentials: "include",
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (a) {
        document.getElementById("subStartDate").value = a.startDate
          ? a.startDate.split("T")[0]
          : "";
        document.getElementById("subEndDate").value = a.endDate
          ? a.endDate.split("T")[0]
          : "";
        document.getElementById("subQuantity").value = a.quantity || "";
        document.getElementById("subStatus").value = a.status || "actif";
        document.getElementById("subAutoRenewal").checked = !!a.autoRenewal;
        document.getElementById("subCompany").value = a.companyId || "";
        document.getElementById("subProduct").value = a.productId || "";
        document.getElementById("subPricing").value = a.pricingId || "";
      })
      .catch(function () {
        showToast("Impossible de charger l'abonnement", "danger");
      });
  }

  // Load companies & products into selects
  loadSubSelects();

  var modal = new bootstrap.Modal(document.getElementById("subModal"));
  modal.show();
}

async function loadSubSelects() {
  try {
    var token =
      AdminAuth && AdminAuth.getAuthToken ? AdminAuth.getAuthToken() : null;
    var h = token ? { Authorization: "Bearer " + token } : {};
    var p1 = fetch("/api/entreprises", { headers: h, credentials: "include" });
    var p2 = fetch("/api/produits", { headers: h, credentials: "include" });
    var p3 = fetch("/api/tarifications", {
      headers: h,
      credentials: "include",
    });

    var r1 = await p1,
      r2 = await p2,
      r3 = await p3;
    var companies = r1.ok ? await r1.json() : [];
    var products = r2.ok ? await r2.json() : [];
    var pricings = r3.ok ? await r3.json() : [];

    var selCompany = document.getElementById("subCompany");
    var selProduct = document.getElementById("subProduct");
    var selPricing = document.getElementById("subPricing");

    if (selCompany)
      selCompany.innerHTML =
        '<option value="">— Sélectionner —</option>' +
        companies
          .map(function (c) {
            return (
              '<option value="' + c.id_entreprise + '">' + c.nom + "</option>"
            );
          })
          .join("");
    if (selProduct)
      selProduct.innerHTML =
        '<option value="">— Sélectionner —</option>' +
        products
          .map(function (p) {
            return (
              '<option value="' + p.id_produit + '">' + p.nom + "</option>"
            );
          })
          .join("");
    if (selPricing)
      selPricing.innerHTML =
        '<option value="">— Sélectionner —</option>' +
        pricings
          .map(function (t) {
            return (
              '<option value="' +
              t.id_tarification +
              '">' +
              (t.prix || 0) +
              " € / " +
              (t.periodicite || "mois") +
              "</option>"
            );
          })
          .join("");
  } catch (e) {
    // Silently fail — user can still type IDs manually
  }
}

async function deleteSubscription(id) {
  if (!confirm("Supprimer définitivement l'abonnement #" + id + " ?")) return;
  try {
    var res = await fetch("/admin/api/abonnements/" + id, {
      method: "DELETE",
      headers: buildSubHeaders(),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Erreur serveur");
    showToast("Abonnement supprimé", "success");
    loadAbonnements();
  } catch (e) {
    showToast("Erreur : " + e.message, "danger");
  }
}

var AdminSubscriptions = {
  load: loadAbonnements,
  openModal: openSubModal,
  save: saveSubscription,
  editSubscription: openSubModal,
  deleteSubscription: deleteSubscription,
};

window.AdminSubscriptions = AdminSubscriptions;
