// ─────────────────────────────────────────────────────────────────────────────
//  Admin Newsletter — Gestion complète des abonnés et campagnes
// ─────────────────────────────────────────────────────────────────────────────

function buildAuthHeaders() {
  const token = AdminAuth?.getAuthToken?.();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Quill editor instance ──────────────────────────────────────────────
let _nlQuill = null;
let _nlEditCampaignId = null;   // null = création, number = édition
let _nlAllSubscribers = [];      // cache complet des abonnés (pour filtrage local)
let _nlAllCampaigns = [];        // cache complet des campagnes
let _nlPage = 1;
const _nlLimit = 50;

// ═══════════════════════════════════════════════════════════════════════
//  INITIALISATION
// ═══════════════════════════════════════════════════════════════════════

function initNewsletter() {
  loadNewsletterSubscribers();
  loadNewsletterCampaigns();
  loadNewsletterStats();

  // Bouton "Nouvelle Campagne"
  const createBtn = document.getElementById("createNewsletterBtn");
  if (createBtn) {
    createBtn.onclick = () => openCampaignModal();
  }

  // Bouton "Ajouter un abonné"
  const addSubBtn = document.getElementById("nlAddSubscriberBtn");
  if (addSubBtn) {
    addSubBtn.onclick = () => {
      const modal = new bootstrap.Modal(document.getElementById("nlAddSubModal"));
      modal.show();
    };
  }

  // Boutons de la modal campagne
  const draftBtn = document.getElementById("nlCampaignSaveDraftBtn");
  const sendBtn = document.getElementById("nlCampaignSaveSendBtn");
  const deleteBtn = document.getElementById("nlCampaignDeleteBtn");
  if (draftBtn) draftBtn.onclick = () => saveCampaign("draft");
  if (sendBtn) sendBtn.onclick = () => saveCampaign("send");
  if (deleteBtn) deleteBtn.onclick = () => deleteCampaign();
}

// ═══════════════════════════════════════════════════════════════════════
//  STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════

async function loadNewsletterStats() {
  try {
    const [subResp, campResp] = await Promise.all([
      fetch("/admin/api/newsletter/subscribers?limit=1", { headers: buildAuthHeaders(), credentials: "include" }),
      fetch("/admin/api/newsletter/campaigns", { headers: buildAuthHeaders(), credentials: "include" }),
    ]);

    let totalSubs = 0, activeSubs = 0;
    if (subResp.ok) {
      const d = await subResp.json();
      totalSubs = d.total || 0;
      activeSubs = d.subscribers ? d.subscribers.filter(s => s.isSubscribed !== false).length : 0;
    }

    let totalCampaigns = 0, totalSent = 0;
    if (campResp.ok) {
      const campaigns = await campResp.json() || [];
      totalCampaigns = campaigns.length;
      totalSent = campaigns.filter(c => c.sent_at).length;
    }

    setStat("nl-stat-total", totalSubs);
    setStat("nl-stat-active", activeSubs);
    setStat("nl-stat-campaigns", totalCampaigns);
    setStat("nl-stat-sent", totalSent);
  } catch (e) {
    console.error("Erreur stats newsletter:", e);
  }
}

function setStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ═══════════════════════════════════════════════════════════════════════
//  ABONNÉS
// ═══════════════════════════════════════════════════════════════════════

async function loadNewsletterSubscribers(page = 1, silent = false) {
  try {
    const container = document.getElementById("newsletterContainer");
    if (!container) return;
    if (!silent) {
      container.innerHTML = `<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>`;
    }

    _nlPage = page;
    const response = await fetch(
      `/admin/api/newsletter/subscribers?page=1&limit=10000`,
      { headers: buildAuthHeaders(), credentials: "include" }
    );

    if (!response.ok) throw new Error("Erreur lors de la récupération des abonnés");

    const data = await response.json();
    _nlAllSubscribers = Array.isArray(data) ? data : (data.subscribers || []);
    renderSubscribers(_nlAllSubscribers);
  } catch (error) {
    console.error("Erreur:", error);
    const c = document.getElementById("newsletterContainer");
    if (c) c.innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

function filterSubscribers() {
  const search = (document.getElementById("nlSubSearch")?.value || "").toLowerCase();
  const status = document.getElementById("nlSubStatusFilter")?.value || "all";

  let filtered = _nlAllSubscribers;
  if (search) {
    filtered = filtered.filter(s => (s.email || "").toLowerCase().includes(search));
  }
  if (status === "active") {
    filtered = filtered.filter(s => s.isSubscribed !== false);
  } else if (status === "unsubscribed") {
    filtered = filtered.filter(s => s.isSubscribed === false);
  }
  renderSubscribers(filtered);
}

function renderSubscribers(subscribers) {
  const container = document.getElementById("newsletterContainer");
  if (!container) return;

  if (!subscribers || subscribers.length === 0) {
    container.innerHTML = `<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Aucun abonné trouvé</div>`;
    return;
  }

  const tableHTML = `
    <div class="table-responsive">
      <table class="table table-hover align-middle" aria-label="Liste des abonnés">
        <thead class="table-light">
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Nom</th>
            <th scope="col">Statut</th>
            <th scope="col">Abonné depuis</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${subscribers.map(sub => `
            <tr>
              <td><strong>${escapeHtml(sub.email)}</strong></td>
              <td>${escapeHtml(sub.name || sub.firstName || "—")}</td>
              <td>
                ${sub.isSubscribed !== false
                  ? '<span class="badge bg-success">Actif</span>'
                  : '<span class="badge bg-secondary">Désabonné</span>'}
              </td>
              <td>${sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString("fr-FR") : "—"}</td>
              <td>
                ${sub.isSubscribed !== false
                  ? `<button class="btn btn-sm btn-outline-warning" data-action="unsubscribe" data-email="${escapeHtml(sub.email)}" title="Désabonner">
                      <i class="bi bi-bell-slash"></i> Désabonner
                    </button>`
                  : `<button class="btn btn-sm btn-outline-success" data-action="resubscribe" data-email="${escapeHtml(sub.email)}" title="Réabonner">
                      <i class="bi bi-bell"></i> Réabonner
                    </button>`}
                <button class="btn btn-sm btn-outline-danger" data-action="delete-sub" data-email="${escapeHtml(sub.email)}" title="Supprimer">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="text-muted small mt-2 px-2">${subscribers.length} abonné(s) affiché(s)</div>
  `;

  container.innerHTML = tableHTML;
}

// ═══════════════════════════════════════════════════════════════════════
//  AJOUTER UN ABONNÉ
// ═══════════════════════════════════════════════════════════════════════

async function addSubscriber() {
  const email = document.getElementById("nlAddSubEmail")?.value?.trim();
  const name = document.getElementById("nlAddSubName")?.value?.trim();
  const sendWelcome = document.getElementById("nlAddSubSendWelcome")?.checked;
  const alertEl = document.getElementById("nlAddSubAlert");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert(alertEl, "Veuillez entrer une adresse email valide", "danger");
    return;
  }

  try {
    const resp = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || err.message || "Erreur lors de l'abonnement");
    }

    if (sendWelcome) {
      try {
        await fetch("/api/newsletter/send-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name }),
        });
      } catch (ignored) { /* silencieux */ }
    }

    showAlert(alertEl, `${email} abonné avec succès !`, "success");
    document.getElementById("nlAddSubEmail").value = "";
    document.getElementById("nlAddSubName").value = "";

    // Fermer la modal après 1s
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById("nlAddSubModal"))?.hide();
    }, 1000);

    loadNewsletterSubscribers(_nlPage, true);
    loadNewsletterStats();
  } catch (err) {
    showAlert(alertEl, err.message, "danger");
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  IMPORT / EXPORT CSV
// ═══════════════════════════════════════════════════════════════════════

function exportSubscribers() {
  if (_nlAllSubscribers.length === 0) {
    showToast("Aucun abonné à exporter", "warning");
    return;
  }
  const header = "email,name,status,subscribed_at";
  const rows = _nlAllSubscribers.map(s =>
    `"${s.email || ""}","${s.name || ""}","${s.isSubscribed !== false ? "active" : "unsubscribed"}","${s.subscribedAt || ""}"`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${_nlAllSubscribers.length} abonnés exportés`, "success");
}

async function importSubscribers(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const lines = text.split("\n").map(l => l.trim()).filter(l => l);
    if (lines.length < 2) throw new Error("Fichier CSV vide ou invalide");

    // Skip header
    const dataLines = lines.slice(1);
    let imported = 0, failed = 0;

    for (const line of dataLines) {
      // Simple CSV parsing: first column is email
      const match = line.match(/^"?([^",\n]+)"?/);
      if (!match) { failed++; continue; }
      const email = match[1].trim();
      if (!email.includes("@")) { failed++; continue; }

      try {
        const resp = await fetch("/api/newsletter/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (resp.ok) imported++; else failed++;
      } catch {
        failed++;
      }
    }

    showToast(`${imported} importé(s), ${failed} échec(s)`, imported > 0 ? "success" : "warning");
    loadNewsletterSubscribers(_nlPage, true);
    loadNewsletterStats();
  } catch (err) {
    showToast(`Erreur d'import: ${err.message}`, "danger");
  }
  fileInput.value = "";
}

// ═══════════════════════════════════════════════════════════════════════
//  CAMPAGNES
// ═══════════════════════════════════════════════════════════════════════

async function loadNewsletterCampaigns() {
  try {
    const container = document.getElementById("campaignsContainer");
    if (!container) return;
    container.innerHTML = `<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>`;

    const response = await fetch("/admin/api/newsletter/campaigns", {
      headers: buildAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) throw new Error("Erreur lors de la récupération des campagnes");

    _nlAllCampaigns = await response.json() || [];

    if (_nlAllCampaigns.length === 0) {
      container.innerHTML = `<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Aucune campagne. <a href="#" onclick="AdminNewsletter.openCampaignModal()" class="alert-link">Créer votre première campagne</a></div>`;
      return;
    }

    renderCampaigns(_nlAllCampaigns);
  } catch (error) {
    console.error("Erreur:", error);
    const c = document.getElementById("campaignsContainer");
    if (c) c.innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

function renderCampaigns(campaigns) {
  const container = document.getElementById("campaignsContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover align-middle" aria-label="Liste des campagnes">
        <thead class="table-light">
          <tr>
            <th scope="col">Titre</th>
            <th scope="col">Sujet</th>
            <th scope="col">Créée le</th>
            <th scope="col">Statut</th>
            <th scope="col">Envoyée le</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${campaigns.map(c => {
            const subject = extractSubject(c.content || "");
            const isSent = !!c.sent_at;
            return `
            <tr>
              <td><strong>${escapeHtml(c.title)}</strong></td>
              <td class="text-muted small">${escapeHtml(subject || "—")}</td>
              <td>${new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
              <td>
                ${isSent
                  ? '<span class="badge bg-success">Envoyée</span>'
                  : '<span class="badge bg-warning text-dark">Brouillon</span>'}
              </td>
              <td>${isSent ? new Date(c.sent_at).toLocaleDateString("fr-FR") : "—"}</td>
              <td>
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-secondary" data-action="preview-campaign" data-id="${c.id}" title="Aperçu">
                    <i class="bi bi-eye"></i>
                  </button>
                  ${!isSent ? `<button class="btn btn-outline-primary" data-action="edit-campaign" data-id="${c.id}" title="Éditer">
                    <i class="bi bi-pencil"></i>
                  </button>` : ""}
                  ${!isSent ? `<button class="btn btn-outline-success" data-action="send-campaign" data-id="${c.id}" title="Envoyer">
                    <i class="bi bi-send"></i>
                  </button>` : ""}
                </div>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function extractSubject(htmlContent) {
  if (!htmlContent) return "";
  const m = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i)
    || htmlContent.match(/<h2[^>]*>(.*?)<\/h2>/i)
    || htmlContent.match(/<title>(.*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

// ═══════════════════════════════════════════════════════════════════════
//  MODAL CAMPAGNE (Quill)
// ═══════════════════════════════════════════════════════════════════════

function openCampaignModal(campaign = null) {
  _nlEditCampaignId = campaign ? campaign.id : null;

  const label = document.getElementById("nlCampaignModalLabel");
  const deleteBtn = document.getElementById("nlCampaignDeleteBtn");
  const alertEl = document.getElementById("nlCampaignAlert");

  if (campaign) {
    label.textContent = "Éditer la campagne";
    deleteBtn.style.display = "";
    document.getElementById("nlCampaignTitle").value = campaign.title || "";
    document.getElementById("nlCampaignId").value = campaign.id;
    const subject = extractSubject(campaign.content || "");
    document.getElementById("nlCampaignSubject").value = subject || campaign.title || "";
  } else {
    label.textContent = "Nouvelle campagne";
    deleteBtn.style.display = "none";
    document.getElementById("nlCampaignTitle").value = "";
    document.getElementById("nlCampaignSubject").value = "";
    document.getElementById("nlCampaignId").value = "";
  }

  showAlert(alertEl, "", "d-none");

  // Initialiser Quill si pas déjà fait
  if (!_nlQuill) {
    _nlQuill = new Quill("#nl-quill-editor", {
      theme: "snow",
      modules: {
        toolbar: "#nl-quill-toolbar",
      },
      placeholder: "Rédigez le contenu de votre newsletter...",
    });

    // Sync Quill -> textarea HTML
    _nlQuill.on("text-change", () => {
      const html = document.getElementById("nlCampaignHtml");
      if (html) html.value = _nlQuill.root.innerHTML;
      updatePreview();
    });

    // Sync textarea HTML -> Quill
    document.getElementById("nlCampaignHtml").addEventListener("input", () => {
      const html = document.getElementById("nlCampaignHtml").value;
      _nlQuill.root.innerHTML = html;
      updatePreview();
    });

    // Onglet aperçu
    document.getElementById("nl-tab-preview").addEventListener("shown.bs.tab", updatePreview);
  }

  // Charger le contenu existant
  if (campaign && campaign.content) {
    _nlQuill.root.innerHTML = campaign.content;
    document.getElementById("nlCampaignHtml").value = campaign.content;
  } else {
    _nlQuill.root.innerHTML = "";
    document.getElementById("nlCampaignHtml").value = "";
    updatePreview();
  }

  const modal = new bootstrap.Modal(document.getElementById("nlCampaignModal"));
  modal.show();
}

function updatePreview() {
  const preview = document.getElementById("nl-preview-frame");
  if (!preview) return;
  const content = _nlQuill ? _nlQuill.root.innerHTML : "";
  if (!content || content === "<p><br></p>") {
    preview.innerHTML = `<p class="text-muted text-center">Rédigez du contenu pour voir l'aperçu</p>`;
    return;
  }
  preview.innerHTML = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      ${content}
      <hr style="border:none;border-top:1px solid #ccc;margin:30px 0;">
      <p style="font-size:12px;color:#666;">
        <a href="#" style="color:#351E90;">Se désabonner</a> de cette newsletter
      </p>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
//  SAUVEGARDER / ENVOYER UNE CAMPAGNE
// ═══════════════════════════════════════════════════════════════════════

async function saveCampaign(action = "draft") {
  const title = document.getElementById("nlCampaignTitle")?.value?.trim();
  const subject = document.getElementById("nlCampaignSubject")?.value?.trim();
  const alertEl = document.getElementById("nlCampaignAlert");

  if (!title) { showAlert(alertEl, "Le titre est requis", "danger"); return; }

  // Construire le contenu : sujet en haut + HTML Quill
  const htmlContent = _nlQuill ? _nlQuill.root.innerHTML : "";
  const fullContent = subject
    ? `<h1 style="display:none;">${escapeHtml(subject)}</h1>\n${htmlContent}`
    : htmlContent;

  if (!htmlContent || htmlContent === "<p><br></p>") {
    showAlert(alertEl, "Le contenu de l'email est requis", "danger");
    return;
  }

  try {
    const resp = await fetch("/admin/api/newsletter/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
      credentials: "include",
      body: JSON.stringify({ title, content: fullContent }),
    });

    if (!resp.ok) throw new Error("Erreur lors de la création de la campagne");

    const data = await resp.json();
    const newCampaignId = data.id_campaign || data.id || _nlEditCampaignId;

    if (action === "send") {
      // Fermer la modal avant l'envoi pour éviter le backdrop bloquant
      const modal = bootstrap.Modal.getInstance(document.getElementById("nlCampaignModal"));
      modal?.hide();
      document.body.classList.remove("modal-open");
      document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());

      showToast("Campagne créée, envoi en cours...", "info");
      await sendCampaign(newCampaignId);
      _nlQuill.root.innerHTML = "";
      loadNewsletterCampaigns();
      loadNewsletterStats();
      return;
    }

    showAlert(alertEl, "Campagne sauvegardée avec succès !", "success");
    setTimeout(() => bootstrap.Modal.getInstance(document.getElementById("nlCampaignModal"))?.hide(), 800);

    loadNewsletterCampaigns();
    loadNewsletterStats();
    _nlQuill.root.innerHTML = "";
  } catch (err) {
    showAlert(alertEl, err.message, "danger");
  }
}

async function deleteCampaign() {
  const campaignId = _nlEditCampaignId;
  if (!campaignId) return;
  if (!confirm("Supprimer définitivement cette campagne ?")) return;

  try {
    const resp = await fetch(`/admin/api/newsletter/campaigns/${campaignId}`, {
      method: "DELETE",
      headers: buildAuthHeaders(),
      credentials: "include",
    });
    if (!resp.ok) throw new Error("Erreur lors de la suppression");

    showToast("Campagne supprimée", "success");
    bootstrap.Modal.getInstance(document.getElementById("nlCampaignModal"))?.hide();
    loadNewsletterCampaigns();
    loadNewsletterStats();
  } catch (err) {
    showToast(`Erreur: ${err.message}`, "danger");
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ENVOYER UNE CAMPAGNE
// ═══════════════════════════════════════════════════════════════════════

async function sendCampaign(campaignId) {
  if (!confirm(`Envoyer cette campagne à tous les abonnés actifs ?\n\n⚠️ Cette action est irréversible.`)) return;

  try {
    const resp = await fetch(`/admin/api/newsletter/campaigns/${campaignId}/send`, {
      method: "POST",
      headers: buildAuthHeaders(),
      credentials: "include",
    });

    if (!resp.ok) throw new Error("Erreur lors de l'envoi");

    const data = await resp.json();
    showToast(`${data.sent || data.sentCount || 0} emails envoyés sur ${data.total || "?"} abonnés`, "success");
    loadNewsletterCampaigns();
    loadNewsletterStats();
  } catch (err) {
    showToast(`Erreur: ${err.message}`, "danger");
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  APERÇU CAMPAGNE (modal séparée)
// ═══════════════════════════════════════════════════════════════════════

function previewCampaign(campaignId) {
  const campaign = _nlAllCampaigns.find(c => c.id === campaignId);
  if (!campaign) return showToast("Campagne introuvable", "warning");

  const previewEl = document.getElementById("nlPreviewContent");
  previewEl.innerHTML = `
    <div style="font-family:Arial,sans-serif;">
      <h4>${escapeHtml(campaign.title)}</h4>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;background:#fafafa;">
        ${campaign.content || "<p class='text-muted'>Aucun contenu</p>"}
      </div>
      <hr style="border:none;border-top:1px solid #ccc;margin:30px 0;">
      <p style="font-size:12px;color:#666;">
        <a href="#" style="color:#351E90;">Se désabonner</a> de cette newsletter
      </p>
    </div>
  `;
  new bootstrap.Modal(document.getElementById("nlPreviewModal")).show();
}

// ═══════════════════════════════════════════════════════════════════════
//  DÉSABONNER / RÉABONNER / SUPPRIMER
// ═══════════════════════════════════════════════════════════════════════

async function unsubscribeUser(email) {
  if (!confirm(`Désabonner ${email} de la newsletter ?`)) return;

  try {
    const resp = await fetch("/api/newsletter/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!resp.ok) throw new Error("Erreur");
    showToast(`${email} désabonné(e)`, "success");
    loadNewsletterSubscribers(_nlPage, true);
    loadNewsletterStats();
  } catch (err) {
    showToast(`Erreur: ${err.message}`, "danger");
  }
}

async function resubscribeUser(email) {
  try {
    const resp = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!resp.ok) throw new Error("Erreur");
    showToast(`${email} réabonné(e)`, "success");
    loadNewsletterSubscribers(_nlPage, true);
    loadNewsletterStats();
  } catch (err) {
    showToast(`Erreur: ${err.message}`, "danger");
  }
}

async function deleteSubscriber(email) {
  if (!confirm(`Supprimer définitivement ${email} ?`)) return;

  try {
    const resp = await fetch(`/admin/api/newsletter/subscribers/${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers: buildAuthHeaders(),
      credentials: "include",
    });
    if (!resp.ok) throw new Error("Erreur");
    showToast(`${email} supprimé(e)`, "success");
    loadNewsletterSubscribers(_nlPage, true);
    loadNewsletterStats();
  } catch (err) {
    showToast(`Erreur: ${err.message}`, "danger");
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  EVENT DELEGATION GLOBALE
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = parseInt(btn.getAttribute("data-id"));
  const email = btn.getAttribute("data-email");

  switch (action) {
    case "unsubscribe":
      e.preventDefault();
      if (email) unsubscribeUser(email);
      break;
    case "resubscribe":
      e.preventDefault();
      if (email) resubscribeUser(email);
      break;
    case "delete-sub":
      e.preventDefault();
      if (email) deleteSubscriber(email);
      break;
    case "send-campaign":
      e.preventDefault();
      if (id) sendCampaign(id);
      break;
    case "edit-campaign":
      e.preventDefault();
      { const camp = _nlAllCampaigns.find(c => c.id === id);
      if (camp) openCampaignModal(camp); }
      break;
    case "preview-campaign":
      e.preventDefault();
      if (id) previewCampaign(id);
      break;
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toastId = `toast-${Date.now()}`;
  const bgClass =
    type === "success" ? "bg-success text-white" :
    type === "danger" ? "bg-danger text-white" :
    type === "warning" ? "bg-warning text-dark" :
    "bg-info text-dark";

  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="4000">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fermer"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", toastHTML);
  const toastEl = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

function showAlert(el, message, type) {
  if (!el) return;
  if (type === "d-none") {
    el.className = "alert d-none";
    el.textContent = "";
    return;
  }
  el.className = `alert alert-${type}`;
  el.textContent = message;
}

function escapeHtml(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ── Exports globaux ────────────────────────────────────────────────────
const AdminNewsletter = {
  init: initNewsletter,
  loadSubscribers: loadNewsletterSubscribers,
  loadCampaigns: loadNewsletterCampaigns,
  filterSubscribers,
  addSubscriber,
  exportSubscribers,
  importSubscribers,
  openCampaignModal,
  unsubscribeUser,
  resubscribeUser,
  deleteSubscriber,
  sendCampaign,
  saveCampaign,
  previewCampaign,
};

window.AdminNewsletter = AdminNewsletter;
// Legacy compat
window.loadNewslettterCampaigns = loadNewsletterCampaigns;
