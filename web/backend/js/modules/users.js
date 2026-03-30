/**
 * Users Module - Recodé proprement
 * Handles user management in admin panel
 */

// Auth helpers for API calls (support cookie-based auth + token fallback)
function getAuthHeaders(withJson = false) {
  const token = localStorage.getItem('token') || (window.AdminAuth?.getAuthToken?.());
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (withJson) headers['Content-Type'] = 'application/json';
  return headers;
}

function apiFetch(url, options = {}) {
  const withJson = options?.headers?.['Content-Type'] === 'application/json';
  return fetch(url, { credentials: 'include', headers: { ...getAuthHeaders(withJson), ...options.headers }, ...options });
}

let availableRolesCache = null;
let lastRolesFetch = 0;
const ROLES_CACHE_TTL = 60 * 1000; // 1 minute

// Load users from API
async function loadUsers() {
  try {

    const usersContainer = document.getElementById('usersContainer');

    usersContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';

    const response = await apiFetch('/admin/api/users');

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
                  <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="AdminUsers.editUser(${user.id_utilisateur})">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-secondary" onclick="AdminUsers.openUserAccessModal(${user.id_utilisateur})" title="Rôles & permissions">
                      <i class="bi bi-shield-lock"></i>
                    </button>
                    <button class="btn btn-outline-${user.est_actif ? 'danger' : 'success'}" onclick="AdminUsers.toggleUserStatus(${user.id_utilisateur}, ${!user.est_actif})">
                      <i class="bi bi-${user.est_actif ? 'pause' : 'play'}"></i>
                    </button>
                  </div>
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


    const response = await apiFetch(`/admin/api/users/${userId}`);

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


    const response = await apiFetch(`/admin/api/users/${userId}`);

    if (!response.ok) throw new Error('Utilisateur introuvable');

    const user = await response.json();
    
    // Fill form
    document.getElementById('editUserId').value = user.id_utilisateur;
    document.getElementById('editUserFirstName').value = user.firstName || '';
    document.getElementById('editUserLastName').value = user.lastName || '';
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserStatus').checked = user.est_actif;
    await refreshRoleSelects({ force: true });
    
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
    
    // Load roles section (RBAC)
    await refreshUserRolesSection(user.id_utilisateur);
    
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
    
    const userId = document.getElementById('editUserId').value;
    
  const userData = {
    firstName: document.getElementById('editUserFirstName').value.trim(),
    lastName: document.getElementById('editUserLastName').value.trim(),
    email: document.getElementById('editUserEmail').value.trim(),
    est_actif: document.getElementById('editUserStatus').checked
  };
    
    if (!userData.lastName || !userData.email) {
      throw new Error('Nom et email requis');
    }
    
    const response = await apiFetch(`/admin/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

// Toggle user active status
async function toggleUserStatus(userId, activate) {
  const action = activate ? 'activer' : 'désactiver';
  if (!confirm(`Voulez-vous ${action} cet utilisateur ?`)) return;

  try {
    const userResponse = await apiFetch(`/admin/api/users/${userId}`);

    if (!userResponse.ok) throw new Error('Utilisateur introuvable');
    const user = await userResponse.json();

    const response = await apiFetch(`/admin/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await apiFetch(`/admin/api/users/${userId}/reset-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
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

async function refreshRoleSelects({ force = false } = {}) {
  const selects = [
    document.getElementById('availableRolesSelect'),
    document.getElementById('userAccessRoleSelect')
  ].filter(Boolean);

  if (selects.length === 0) return;

  const now = Date.now();
  if (force || !availableRolesCache || now - lastRolesFetch > ROLES_CACHE_TTL) {
    const response = await apiFetch('/admin/api/roles');
    if (!response.ok) throw new Error('Erreur lors du chargement des rôles disponibles');
    availableRolesCache = await response.json();
    lastRolesFetch = now;
  }

  const roles = (availableRolesCache || []).filter(r => r.actif !== false);

  selects.forEach(select => {
    select.innerHTML = '<option value="">Sélectionner un rôle</option>';
    roles.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role.id_role;
      opt.textContent = role.nom;
      select.appendChild(opt);
    });
  });
}

async function loadUserRoles(userId) {
  const listEl = document.getElementById('userRolesList');
  if (!listEl) return;

  listEl.innerHTML = '<span class="text-muted">Chargement...</span>';

  const response = await apiFetch(`/admin/api/users/${userId}/roles`);
  if (!response.ok) {
    listEl.innerHTML = '<span class="text-danger">Impossible de charger les rôles</span>';
    return;
  }

  const roles = await response.json();
  if (!roles || roles.length === 0) {
    listEl.innerHTML = '<span class="text-muted">Aucun rôle attribué</span>';
    return;
  }

  listEl.innerHTML = roles.map(role => `
    <span class="badge bg-secondary d-inline-flex align-items-center">
      ${role.nom}
      <button type="button" class="btn-close btn-close-white ms-2 remove-user-role" data-role-id="${role.id_role}" aria-label="Retirer ${role.nom}"></button>
    </span>
  `).join('');
}

async function refreshUserRolesSection(userId) {
  try {
    await refreshRoleSelects({ force: true });
    await loadUserRoles(userId);
  } catch (error) {
    console.error('Erreur refreshUserRolesSection:', error);
    AdminUtils.showAlert('Impossible de charger les rôles: ' + error.message, 'warning');
  }
}

async function addRoleToUserFromModal() {
  try {
    const userId = document.getElementById('editUserId').value;
    const select = document.getElementById('availableRolesSelect');
    if (!userId || !select) return;

    const roleId = parseInt(select.value, 10);
    if (!roleId) {
      AdminUtils.showAlert('Choisissez un rôle à ajouter.', 'info');
      return;
    }

    const response = await apiFetch(`/admin/api/users/${userId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_role: roleId })
    });

    if (!response.ok) throw new Error('Ajout du rôle impossible');

    AdminUtils.showAlert('Rôle ajouté à l’utilisateur.', 'success');
    await loadUserRoles(userId);
  } catch (error) {
    console.error('Erreur addRoleToUserFromModal:', error);
    AdminUtils.showAlert('Erreur lors de l’ajout du rôle: ' + error.message, 'danger');
  }
}

async function handleRoleRemovalClick(event) {
  const target = event.target;
  if (!target.classList.contains('remove-user-role')) return;

  const userId = document.getElementById('editUserId').value;
  const roleId = target.getAttribute('data-role-id');
  if (!userId || !roleId) return;

  try {
      const response = await apiFetch(`/admin/api/users/${userId}/roles/${roleId}`, {
        method: 'DELETE'
      });

    if (!response.ok) throw new Error('Suppression du rôle impossible');

    AdminUtils.showAlert('Rôle retiré de l’utilisateur.', 'success');
    await loadUserRoles(userId);
  } catch (error) {
    console.error('Erreur handleRoleRemovalClick:', error);
    AdminUtils.showAlert('Erreur lors du retrait du rôle: ' + error.message, 'danger');
  }
}

function setupRoleEventHandlers() {
  const addBtn = document.getElementById('addUserRoleBtn');
  if (addBtn) addBtn.onclick = addRoleToUserFromModal;

  const rolesList = document.getElementById('userRolesList');
  if (rolesList) rolesList.onclick = handleRoleRemovalClick;
}

setupRoleEventHandlers();

// ── Rôles & Permissions (nouvelle expérience) ───────────────────────────────
async function loadUserPermissions(userId) {
  const container = document.getElementById('userAccessPermissions');
  if (!container) return;
  container.innerHTML = 'Chargement...';

  try {
    const response = await apiFetch(`/admin/api/users/${userId}/permissions`);
    if (!response.ok) throw new Error('Impossible de charger les permissions');
    const perms = await response.json();
    if (!Array.isArray(perms) || perms.length === 0) {
      container.innerHTML = '<span class="text-muted">Aucune permission</span>';
      return;
    }
    const grouped = {};
    perms.forEach(p => {
      const cat = p.categorie || 'Autre';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    container.innerHTML = Object.entries(grouped).map(([cat, items]) => `
      <div class="mb-2">
        <div class="fw-semibold small text-uppercase text-muted">${cat}</div>
        <div class="d-flex flex-wrap gap-1">
          ${items.map(it => `<span class="badge bg-light text-dark border"><code>${it.code}</code></span>`).join('')}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Erreur loadUserPermissions:', error);
    container.innerHTML = `<span class="text-danger">${error.message}</span>`;
  }
}

async function loadUserRolesForAccessModal(userId) {
  const badges = document.getElementById('userAccessRolesBadges');
  if (!badges) return;
  badges.innerHTML = '<span class="text-muted small">Chargement...</span>';

  try {
    await refreshRoleSelects({ force: true });
    const response = await apiFetch(`/admin/api/users/${userId}/roles`);
    if (!response.ok) throw new Error('Impossible de charger les rôles');
    const roles = await response.json();
    if (!roles || roles.length === 0) {
      badges.innerHTML = '<span class="text-muted">Aucun rôle attribué</span>';
    } else {
      badges.innerHTML = roles.map(r => `
        <span class="badge bg-secondary d-inline-flex align-items-center">
          ${r.nom}
          <button type="button" class="btn-close btn-close-white ms-2 user-access-remove-role" data-role-id="${r.id_role}" aria-label="Retirer ${r.nom}"></button>
        </span>
      `).join('');
    }
    loadUserPermissions(userId);
  } catch (error) {
    console.error('Erreur loadUserRolesForAccessModal:', error);
    badges.innerHTML = `<span class="text-danger">${error.message}</span>`;
  }
}

function bindUserAccessEvents(userId) {
  const addBtn = document.getElementById('userAccessAddRoleBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      const select = document.getElementById('userAccessRoleSelect');
      const roleId = parseInt(select?.value, 10);
      if (!roleId) {
        AdminUtils.showAlert('Choisissez un rôle', 'info');
        return;
      }
      apiFetch(`/admin/api/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_role: roleId })
      }).then(res => {
        if (!res.ok) throw new Error('Ajout du rôle impossible');
        AdminUtils.showAlert('Rôle ajouté', 'success');
        loadUserRolesForAccessModal(userId);
      }).catch(err => {
        console.error(err);
        AdminUtils.showAlert(err.message, 'danger');
      });
    };
  }

  const badges = document.getElementById('userAccessRolesBadges');
  if (badges) {
    badges.onclick = (e) => {
      const btn = e.target.closest('.user-access-remove-role');
      if (!btn) return;
      const roleId = btn.getAttribute('data-role-id');
      apiFetch(`/admin/api/users/${userId}/roles/${roleId}`, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) throw new Error('Suppression du rôle impossible');
          AdminUtils.showAlert('Rôle retiré', 'success');
          loadUserRolesForAccessModal(userId);
        })
        .catch(err => {
          console.error(err);
          AdminUtils.showAlert(err.message, 'danger');
        });
    };
  }
}

async function openUserAccessModal(userId) {
  const title = document.getElementById('userAccessTitle');
  const select = document.getElementById('userAccessRoleSelect');
  if (select) select.value = '';

  try {
    await refreshRoleSelects({ force: true });
    const res = await apiFetch(`/admin/api/users/${userId}`);
    if (!res.ok) throw new Error('Utilisateur introuvable');
    const user = await res.json();
    if (title) title.textContent = `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email;

    await loadUserRolesForAccessModal(userId);
    bindUserAccessEvents(userId);

    const modalEl = document.getElementById('userAccessModal');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } catch (error) {
    console.error('Erreur openUserAccessModal:', error);
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Export functions
window.AdminUsers = {
  loadUsers,
  viewUser,
  editUser,
  saveUser,
  toggleUserStatus,
  reset2FA,
  refreshUserRolesSection,
  openUserAccessModal
};
