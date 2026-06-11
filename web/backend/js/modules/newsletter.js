// Newsletter Management

function buildAuthHeaders() {
  const token = AdminAuth?.getAuthToken?.();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Pagination state ──────────────────────────────────────────────────
let _newsletterPage = 1;
const _newsletterLimit = 50;

async function loadNewsletterSubscribers(page = 1) {
  try {
    const container = document.getElementById("newsletterContainer");
    if (!container) return;

    container.innerHTML =
      '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    _newsletterPage = page;
    const response = await fetch(
      `/admin/api/newsletter/subscribers?page=${page}&limit=${_newsletterLimit}`,
      {
        headers: buildAuthHeaders(),
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des abonnés");
    }

    const data = await response.json();
    // Support both legacy (raw array) and new (paginated) format
    const subscribers = Array.isArray(data) ? data : data.subscribers || [];
    const total = data.total != null ? data.total : subscribers.length;

    if (!subscribers || subscribers.length === 0) {
      container.innerHTML =
        '<div class="alert alert-info">Aucun abonné trouvé</div>';
      return;
    }

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover" aria-label="Liste des abonnés à la newsletter">
          <thead class="table-light">
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Abonné depuis</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${subscribers
              .map(
                (sub) => `
              <tr>
                <td>${sub.email}</td>
                <td>${new Date(sub.subscribedAt).toLocaleDateString("fr-FR")}</td>
                <td>
                  <button class="btn btn-sm btn-danger" data-action="unsubscribe" data-email="${sub.email}" aria-label="Désabonner ${sub.email}">
                    <i class="bi bi-trash" aria-hidden="true"></i> Désabonner
                  </button>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${renderPagination(page, total, _newsletterLimit)}
    `;

    container.innerHTML = tableHTML;
  } catch (error) {
    console.error("Erreur:", error);
    const errContainer = document.getElementById("newsletterContainer");
    if (errContainer)
      errContainer.innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

function renderPagination(currentPage, total, limit) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return "";

  let html =
    '<nav aria-label="Pagination des abonnés"><ul class="pagination pagination-sm justify-content-center mt-3">';

  // Previous
  html += `<li class="page-item ${currentPage <= 1 ? "disabled" : ""}">
    <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Page précédente">&laquo;</a></li>`;

  // Page numbers
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= currentPage - 2 && p <= currentPage + 2)
    ) {
      html += `<li class="page-item ${p === currentPage ? "active" : ""}">
        <a class="page-link" href="#" data-page="${p}" ${p === currentPage ? 'aria-current="page"' : ""}>${p}</a></li>`;
    } else if (p === currentPage - 3 || p === currentPage + 3) {
      html +=
        '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
    }
  }

  // Next
  html += `<li class="page-item ${currentPage >= totalPages ? "disabled" : ""}">
    <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Page suivante">&raquo;</a></li>`;

  html += "</ul></nav>";
  return html;
}

// Pagination click delegation (set up once)
document.addEventListener("click", function (e) {
  const pageLink = e.target.closest("[data-page]");
  if (pageLink) {
    e.preventDefault();
    const page = parseInt(pageLink.getAttribute("data-page"));
    if (page > 0) loadNewsletterSubscribers(page);
  }
});

// Unsubscribe click delegation (replaces inline onclick)
document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-action='unsubscribe']");
  if (btn) {
    e.preventDefault();
    const email = btn.getAttribute("data-email");
    if (email) AdminNewsletter.unsubscribeUser(email);
  }
});

// Send campaign delegation
document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-action='send-campaign']");
  if (btn) {
    e.preventDefault();
    const id = parseInt(btn.getAttribute("data-id"));
    if (id) AdminNewsletter.sendCampaign(id);
  }
});

async function loadNewsletterCampaigns() {
  try {
    const container = document.getElementById("campaignsContainer");
    if (!container) return;

    container.innerHTML =
      '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch("/admin/api/newsletter/campaigns", {
      headers: buildAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des campagnes");
    }

    const campaigns = await response.json();

    if (!campaigns || campaigns.length === 0) {
      container.innerHTML =
        '<div class="alert alert-info">Aucune campagne trouvée</div>';
      return;
    }

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover" aria-label="Liste des campagnes newsletter">
          <thead class="table-light">
            <tr>
              <th scope="col">Titre</th>
              <th scope="col">Créée le</th>
              <th scope="col">Statut</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns
              .map(
                (campaign) => `
              <tr>
                <td><strong>${campaign.title}</strong></td>
                <td>${new Date(campaign.created_at).toLocaleDateString("fr-FR")}</td>
                <td>
                  ${
                    campaign.sent_at
                      ? `<span class="badge bg-success" role="status">Envoyée</span>`
                      : `<span class="badge bg-warning text-dark" role="status">Brouillon</span>`
                  }
                </td>
                <td>
                  ${
                    !campaign.sent_at
                      ? `<button class="btn btn-sm btn-primary" data-action="send-campaign" data-id="${campaign.id}" aria-label="Envoyer la campagne ${campaign.title}">
                      <i class="bi bi-send" aria-hidden="true"></i> Envoyer
                    </button>`
                      : `<span class="text-muted small">Envoyée</span>`
                  }
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  } catch (error) {
    console.error("Erreur:", error);
    const errContainer = document.getElementById("campaignsContainer");
    if (errContainer)
      errContainer.innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

async function unsubscribeUser(email) {
  if (!confirm(`Désabonner ${email} ?`)) return;

  try {
    const response = await fetch("/api/newsletter/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) throw new Error("Erreur");

    showToast("Utilisateur désabonné", "success");
    loadNewsletterSubscribers(_newsletterPage);
  } catch (error) {
    showToast(`Erreur: ${error.message}`, "danger");
  }
}

async function createNewsletter() {
  const title = await showPrompt("Titre de la campagne");
  if (!title) return;

  const contentText = await showPrompt("Contenu (HTML accepté)");
  if (!contentText) return;

  try {
    const response = await fetch("/admin/api/newsletter/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ title, content: contentText }),
    });

    if (!response.ok) throw new Error("Erreur");

    showToast("Campagne créée", "success");
    loadNewsletterCampaigns();
  } catch (error) {
    showToast(`Erreur: ${error.message}`, "danger");
  }
}

async function sendNewsletter(campaignId) {
  if (!confirm("Envoyer cette campagne à tous les abonnés ?")) return;

  try {
    const response = await fetch(
      `/admin/api/newsletter/campaigns/${campaignId}/send`,
      {
        method: "POST",
        headers: buildAuthHeaders(),
        credentials: "include",
      },
    );

    if (!response.ok) throw new Error("Erreur");

    const data = await response.json();
    showToast(`Campagne envoyée à ${data.sentCount} abonnés`, "success");
    loadNewsletterCampaigns();
  } catch (error) {
    showToast(`Erreur: ${error.message}`, "danger");
  }
}

const AdminNewsletter = {
  loadSubscribers: loadNewsletterSubscribers,
  loadCampaigns: loadNewsletterCampaigns,
  loadNewslettterCampaigns: loadNewsletterCampaigns,
  unsubscribeUser,
  createCampaign: createNewsletter,
  sendCampaign: sendNewsletter,
};

window.AdminNewsletter = AdminNewsletter;
window.loadNewslettterCampaigns = loadNewsletterCampaigns;
