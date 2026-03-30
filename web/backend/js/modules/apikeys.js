/**
 * API Keys Module
 * Handles API key management in admin panel
 */

const AdminAPIKeys = {
  async loadAPIKeys() {
    try {
      
      const container = document.getElementById('apiKeysContainer');
      
      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
      
      const response = await fetch('/admin/api/api-tokens');
      
      if (!response.ok) throw new Error('Erreur lors de la récupération des clés API');
      
      const keys = await response.json();
      
      if (!keys || keys.length === 0) {
        container.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle"></i> Aucune clé API trouvée</div>';
        return;
      }
      
      const tableHTML = `
        <div class="table-responsive">
          <table class="table table-hover">
            <thead class="table-light">
              <tr>
                <th>Nom</th>
                <th>Clé API (tronquée)</th>
                <th>Permissions</th>
                <th>Créée le</th>
                <th>Dernier usage</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${keys.map(key => `
                <tr>
                  <td><strong>${key.nom}</strong></td>
                  <td><code>${key.cle_api.substring(0, 8)}...${key.cle_api.substring(key.cle_api.length - 4)}</code></td>
                  <td><span class="badge bg-info">${key.permissions || 'all'}</span></td>
                  <td><small>${new Date(key.date_creation).toLocaleString('fr-FR')}</small></td>
                  <td><small>${key.dernier_usage ? new Date(key.dernier_usage).toLocaleString('fr-FR') : 'Jamais'}</small></td>
                  <td>
                    <span class="badge ${key.est_actif ? 'bg-success' : 'bg-secondary'}">
                      ${key.est_actif ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline-${key.est_actif ? 'warning' : 'success'}" 
                            onclick="AdminAPIKeys.toggleKeyStatus(${key.id_token}, ${!key.est_actif})"
                            title="${key.est_actif ? 'Désactiver' : 'Activer'}">
                      <i class="bi bi-${key.est_actif ? 'pause' : 'play'}-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" 
                            onclick="AdminAPIKeys.deleteKey(${key.id_token})"
                            title="Supprimer">
                      <i class="bi bi-trash"></i>
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
      console.error('Erreur loadAPIKeys:', error);
      document.getElementById('apiKeysContainer').innerHTML = 
        '<div class="alert alert-danger">Erreur de chargement des clés API</div>';
    }
  },

  openCreateModal() {
    document.getElementById('apiKeyName').value = '';
    document.getElementById('apiKeyPermissions').value = 'read,write';
    
    const modal = new bootstrap.Modal(document.getElementById('createAPIKeyModal'));
    modal.show();
  },

  async createKey() {
    try {
      
      const nom = document.getElementById('apiKeyName').value.trim();
      const permissions = document.getElementById('apiKeyPermissions').value.trim();
      
      if (!nom) {
        AdminUtils.showAlert('Le nom de la clé est requis', 'warning');
        return;
      }
      
      const response = await fetch('/admin/api/api-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nom, permissions })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création de la clé');
      }
      
      const result = await response.json();
      
      // Close create modal
      bootstrap.Modal.getInstance(document.getElementById('createAPIKeyModal')).hide();
      
      // Show result modal with generated key
      document.getElementById('generatedAPIKey').value = result.cle_api;
      const resultModal = new bootstrap.Modal(document.getElementById('apiKeyResultModal'));
      resultModal.show();
      
      // Reload list
      this.loadAPIKeys();
      
    } catch (error) {
      console.error('Erreur createKey:', error);
      AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
    }
  },

  async deleteKey(keyId) {
    if (!confirm('Voulez-vous vraiment supprimer cette clé API ? Cette action est irréversible.')) return;
    
    try {
      
      const response = await fetch(`/admin/api/api-tokens/${keyId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Erreur lors de la suppression');
      
      AdminUtils.showAlert('Clé API supprimée avec succès', 'success');
      this.loadAPIKeys();
      
    } catch (error) {
      console.error('Erreur deleteKey:', error);
      AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
    }
  },

  async toggleKeyStatus(keyId, newStatus) {
    try {
      
      const response = await fetch(`/admin/api/api-tokens/${keyId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ est_actif: newStatus })
      });
      
      if (!response.ok) throw new Error('Erreur lors du changement de statut');
      
      AdminUtils.showAlert(`Clé ${newStatus ? 'activée' : 'désactivée'} avec succès`, 'success');
      this.loadAPIKeys();
      
    } catch (error) {
      console.error('Erreur toggleKeyStatus:', error);
      AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
    }
  },

  copyAPIKey() {
    const input = document.getElementById('generatedAPIKey');
    input.select();
    document.execCommand('copy');
    AdminUtils.showAlert('Clé API copiée dans le presse-papier', 'success');
  }
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createAPIKeyBtn')?.addEventListener('click', () => {
    AdminAPIKeys.openCreateModal();
  });
  
  document.getElementById('saveAPIKeyBtn')?.addEventListener('click', () => {
    AdminAPIKeys.createKey();
  });
  
  document.getElementById('copyAPIKeyBtn')?.addEventListener('click', () => {
    AdminAPIKeys.copyAPIKey();
  });
});

window.AdminAPIKeys = AdminAPIKeys;
