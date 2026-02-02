/**
 * Users Module - Recodé proprement
 * Handles user management in admin panel
 */

// Load users from API
async function loadUsers() {
  try {
    const token = AdminAuth.getAuthToken();
    const usersContainer = document.getElementById('usersContainer');

    usersContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';

    const response = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Erreur lors de la récupération des utilisateurs');

    const users = await response.json();

    if (!users || users.length === 0) {
      usersContainer.innerHTML = '<div class="alert alert-info">Aucun utilisateur trouvé</div>';
      return;
    }

    // Build table
    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th>ID</th>
              <th>Nom complet</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>2FA</th>
              <th>Dernière connexion</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => `
              <tr>
                <td><code>${user.id_utilisateur}</code></td>
                <td>
                  <strong>${user.lastName} ${user.firstName || ''}</strong><br>
                  <small class="text-muted">${user.status === 'actif' ? '<span class="badge bg-success">Vérifié</span>' : '<span class="badge bg-warning">Non vérifié</span>'}</small>
                </td>
                <td>${user.email}</td>
                <td>
                  <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}">
                    ${user.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </td>
                <td>
                  <span class="badge ${user.est_actif ? 'bg-success' : 'bg-secondary'}">
                    ${user.est_actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  ${user.totp_enabled ? '<i class="bi bi-shield-check text-success"></i>' : '<i class="bi bi-shield-x text-secondary"></i>'}
                </td>
                <td>
                  <small>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}</small>
                </td>
                <td>
                  <button class="btn btn-sm btn-outline-primary" onclick="AdminUsers.editUser(${user.id_utilisateur})">
                    <i class="bi bi-pencil"></i>
                  </button>
                  ${user.role !== 'admin' ? 
                    `<button class="btn btn-sm btn-outline-warning" onclick="AdminUsers.promoteUser(${user.id_utilisateur})"><i class="bi bi-arrow-up-circle"></i></button>` :
                    `<button class="btn btn-sm btn-outline-secondary" onclick="AdminUsers.demoteUser(${user.id_utilisateur})"><i class="bi bi-arrow-down-circle"></i></button>`
                  }
                  <button class="btn btn-sm btn-outline-${user.est_actif ? 'danger' : 'success'}" onclick="AdminUsers.toggleUserStatus(${user.id_utilisateur}, ${!user.est_actif})">
                    <i class="bi bi-${user.est_actif ? 'pause' : 'play'}"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    usersContainer.innerHTML = tableHTML;

    // Update stats
    document.getElementById('totalUsersCount').textContent = users.length;
    document.getElementById('totalAdminsCount').textContent = users.filter(u => u.role === 'admin').length;

  } catch (error) {
    console.error('Erreur loadUsers:', error);
    document.getElementById('usersContainer').innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>';
  }
}

// View user details - SIMPLE ET DIRECT
async function viewUser(userId) {
  try {
    console.log('=== viewUser START ===');
    console.log('User ID:', userId);
    console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
    
    const token = AdminAuth.getAuthToken();
    
    const response = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Utilisateur introuvable');

    const user = await response.json();
    console.log('User data:', user);
    console.log('User totp_enabled:', user.totp_enabled, typeof user.totp_enabled);
    
    // Build modal content
    const content = `
      <div class="text-center mb-3">
        <h4>${user.lastName} ${user.firstName || ''}</h4>
        <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'} me-2">
          ${user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
        </span>
        <span class="badge ${user.est_actif ? 'bg-success' : 'bg-secondary'}">
          ${user.est_actif ? 'Actif' : 'Inactif'}
        </span>
      </div>
      <table class="table table-borderless">
        <tr><th width="40%">Email:</th><td>${user.email}</td></tr>
        <tr><th>ID:</th><td><code>${user.id_utilisateur}</code></td></tr>
        <tr><th>Téléphone:</th><td>${user.phone || 'Non renseigné'}</td></tr>
        <tr><th>Date de création:</th><td>${new Date(user.createdAt || user.date_creation).toLocaleString('fr-FR')}</td></tr>
        <tr><th>Dernière connexion:</th><td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</td></tr>
        <tr>
          <th>Authentification 2FA:</th>
          <td>
            ${user.totp_enabled ? 
              '<span class="badge bg-success"><i class="bi bi-shield-check"></i> Activée</span>' : 
              '<span class="badge bg-secondary"><i class="bi bi-shield-x"></i> Désactivée</span>'}
          </td>
        </tr>
      </table>
    `;
    
    console.log('Content built, length:', content.length);
    
    // Insert content
    const contentEl = document.getElementById('userDetailsContent');
    console.log('Content element found:', contentEl !== null);
    
    if (!contentEl) {
      throw new Error('Element userDetailsContent not found');
    }
    
    contentEl.innerHTML = content;
    console.log('Content inserted');
    
    // Show modal THE SIMPLE WAY
    const modalEl = document.getElementById('userDetailsModal');
    console.log('Modal element found:', modalEl !== null);
    
    if (!modalEl) {
      throw new Error('Element userDetailsModal not found');
    }
    
    console.log('Getting modal instance...');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    console.log('Modal instance created:', modal !== null);
    console.log('Calling modal.show()...');
    modal.show();
    console.log('=== viewUser END ===');
    
  } catch (error) {
    console.error('=== viewUser ERROR ===', error);
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Edit user
async function editUser(userId) {
  try {
    const token = AdminAuth.getAuthToken();
    
    const response = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Utilisateur introuvable');

    const user = await response.json();
    
    // Fill form
    document.getElementById('editUserId').value = user.id_utilisateur;
    document.getElementById('editUserFirstName').value = user.firstName || '';
    document.getElementById('editUserLastName').value = user.lastName || '';
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserRole').value = user.role;
    document.getElementById('editUserStatus').checked = user.est_actif;
    
    // Display 2FA status (read-only)
    const twoFAStatusEl = document.getElementById('edit2FAStatus');
    const remove2FABtn = document.getElementById('remove2FABtn');
    if (twoFAStatusEl) {
      if (user.totp_enabled) {
        twoFAStatusEl.className = 'badge bg-success';
        twoFAStatusEl.innerHTML = '<i class="bi bi-shield-check"></i> 2FA Activée';
        if (remove2FABtn) remove2FABtn.style.display = 'inline-block';
      } else {
        twoFAStatusEl.className = 'badge bg-secondary';
        twoFAStatusEl.innerHTML = '<i class="bi bi-shield-x"></i> 2FA Désactivée';
        if (remove2FABtn) remove2FABtn.style.display = 'none';
      }
    }
    
    // Attach 2FA reset handler
    if (remove2FABtn) {
      remove2FABtn.onclick = () => AdminUsers.reset2FA(user.id_utilisateur);
    }
    
    // Show modal
    const modalEl = document.getElementById('editUserModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    
    // Attach save handler ONCE when modal is shown
    modalEl.addEventListener('shown.bs.modal', function attachSave() {
      const saveBtn = document.getElementById('saveUserBtn');
      if (saveBtn) {
        saveBtn.onclick = function() {
          saveUser();
        };
      }
      // Remove this listener so it doesn't stack
      modalEl.removeEventListener('shown.bs.modal', attachSave);
    });
    
  } catch (error) {
    console.error('Erreur editUser:', error);
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Save user
async function saveUser() {
  try {
    const token = AdminAuth.getAuthToken();
    const userId = document.getElementById('editUserId').value;
    
    const userData = {
      firstName: document.getElementById('editUserFirstName').value.trim(),
      lastName: document.getElementById('editUserLastName').value.trim(),
      email: document.getElementById('editUserEmail').value.trim(),
      role: document.getElementById('editUserRole').value,
      est_actif: document.getElementById('editUserStatus').checked
    };
    
    if (!userData.lastName || !userData.email) {
      throw new Error('Nom et email requis');
    }
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur ${response.status}: ${errorText}`);
    }

    AdminUtils.showAlert('Utilisateur modifié avec succès', 'success');
    
    // Close modal
    const modalEl = document.getElementById('editUserModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    
    // Reload list
    loadUsers();
    
  } catch (error) {
    console.error('Erreur saveUser:', error);
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Promote user to admin
async function promoteUser(userId) {
  if (!confirm('Promouvoir cet utilisateur en administrateur ?')) return;

  try {
    const token = AdminAuth.getAuthToken();
    const userResponse = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!userResponse.ok) throw new Error('Utilisateur introuvable');
    const user = await userResponse.json();
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ...user, role: 'admin' })
    });

    if (!response.ok) throw new Error('Erreur lors de la promotion');

    AdminUtils.showAlert('Utilisateur promu administrateur', 'success');
    loadUsers();
  } catch (error) {
    console.error('Erreur promoteUser:', error);
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Demote admin to user
async function demoteUser(userId) {
  if (!confirm('Rétrograder cet administrateur en utilisateur ?')) return;

  try {
    const token = AdminAuth.getAuthToken();
    const userResponse = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!userResponse.ok) throw new Error('Utilisateur introuvable');
    const user = await userResponse.json();
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ...user, role: 'utilisateur' })
    });

    if (!response.ok) throw new Error('Erreur lors de la rétrogradation');

    AdminUtils.showAlert('Administrateur rétrogradé', 'success');
    loadUsers();
  } catch (error) {
    console.error('Erreur demoteUser:', error);
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Toggle user active status
async function toggleUserStatus(userId, activate) {
  const action = activate ? 'activer' : 'désactiver';
  if (!confirm(`Voulez-vous ${action} cet utilisateur ?`)) return;

  try {
    const token = AdminAuth.getAuthToken();
    const userResponse = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!userResponse.ok) throw new Error('Utilisateur introuvable');
    const user = await userResponse.json();
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ...user, est_actif: activate })
    });

    if (!response.ok) throw new Error(`Erreur lors de l'${action}tion`);

    AdminUtils.showAlert(`Utilisateur ${activate ? 'activé' : 'désactivé'}`, 'success');
    loadUsers();
  } catch (error) {
    console.error('Erreur toggleUserStatus:', error);
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Reset 2FA for user
async function reset2FA(userId) {
  if (!confirm('Voulez-vous vraiment réinitialiser le 2FA de cet utilisateur ? L\'utilisateur devra reconfigurer son authentification à deux facteurs.')) return;

  try {
    const token = AdminAuth.getAuthToken();
    const response = await fetch(`/api/users/${userId}/reset-2fa`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMessage = 'Erreur lors de la réinitialisation du 2FA';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (e) {
        // Si la réponse n'est pas du JSON, utiliser le texte brut
        const text = await response.text();
        errorMessage = text || `Erreur ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    AdminUtils.showAlert('2FA réinitialisé avec succès', 'success');
    
    // Close modal and reload users
    const modalEl = document.getElementById('editUserModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
    
    loadUsers();
  } catch (error) {
    console.error('Erreur reset2FA:', error);
    AdminUtils.showAlert(`Erreur lors de la réinitialisation du 2FA: ${error.message}`, 'danger');
  }
}

// Export functions
window.AdminUsers = {
  loadUsers,
  viewUser,
  editUser,
  saveUser,
  promoteUser,
  demoteUser,
  toggleUserStatus,
  reset2FA
};
