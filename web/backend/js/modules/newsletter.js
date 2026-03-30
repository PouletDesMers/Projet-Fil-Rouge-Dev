// Newsletter Management

async function loadNewsletterSubscribers() {
  try {
    const token = localStorage.getItem('token');
    const container = document.getElementById('newsletterContainer');

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/newsletter/subscribers', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des abonnés');
    }

    const subscribers = await response.json();

    if (!subscribers || subscribers.length === 0) {
      container.innerHTML = '<div class="alert alert-info">Aucun abonné trouvé</div>';
      return;
    }

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th>Email</th>
              <th>Abonné depuis</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${subscribers.map(sub => `
              <tr>
                <td>${sub.email}</td>
                <td>${new Date(sub.subscribedAt).toLocaleDateString('fr-FR')}</td>
                <td>
                  <button class="btn btn-sm btn-danger" onclick="AdminNewsletter.unsubscribeUser('${sub.email}')">
                    <i class="bi bi-trash"></i> Désabonner
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('newsletterContainer').innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

async function loadNewsletterCampaigns() {
  try {
    const token = localStorage.getItem('token');
    const container = document.getElementById('campaignsContainer');

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/newsletter/campaigns', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des campagnes');
    }

    const campaigns = await response.json();

    if (!campaigns || campaigns.length === 0) {
      container.innerHTML = '<div class="alert alert-info">Aucune campagne trouvée</div>';
      return;
    }

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th>Titre</th>
              <th>Créée le</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns.map(campaign => `
              <tr>
                <td><strong>${campaign.title}</strong></td>
                <td>${new Date(campaign.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                  ${campaign.sent_at ?
                    `<span class="badge bg-success">Envoyée</span>` :
                    `<span class="badge bg-warning">Brouillon</span>`
                  }
                </td>
                <td>
                  ${!campaign.sent_at ?
                    `<button class="btn btn-sm btn-primary" onclick="AdminNewsletter.sendCampaign(${campaign.id})">
                      <i class="bi bi-send"></i> Envoyer
                    </button>` :
                    `<span class="text-muted text-sm">Envoyée</span>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('campaignsContainer').innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

async function unsubscribeUser(email) {
  if (!confirm(`Désabonner ${email}?`)) return;

  try {
    const response = await fetch('/api/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) throw new Error('Erreur');

    showToast('Utilisateur désabonné', 'success');
    loadNewsletterSubscribers();
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

async function createNewsletter() {
  const title = prompt('Titre de la campagne:');
  if (!title) return;

  let contentText = prompt('Contenu:');
  if (!contentText) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/admin/api/newsletter/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        content: contentText
      })
    });

    if (!response.ok) throw new Error('Erreur');

    showToast('Campagne créée', 'success');
    loadNewslettterCampaigns();
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

async function sendNewsletter(campaignId) {
  if (!confirm('Envoyer cette campagne à tous les abonnés?')) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/admin/api/newsletter/campaigns/${campaignId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Erreur');

    const data = await response.json();
    showToast(`Campagne envoyée à ${data.sentCount} abonnés`, 'success');
    loadNewslettterCampaigns();
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

const AdminNewsletter = {
  loadSubscribers: loadNewsletterSubscribers,
  loadCampaigns: loadNewslettterCampaigns,
  unsubscribeUser,
  createCampaign: createNewsletter,
  sendCampaign: sendNewsletter
};
