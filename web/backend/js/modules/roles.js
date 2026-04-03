// Role & Permission Management

let currentRoleId = null;
let currentPermissions = new Set();

function buildRoleHeaders(includeJson = false) {
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  const token = AdminAuth?.getAuthToken?.();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function loadRoles() {
  try {
    const container = document.getElementById('rolesContainer');

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/roles', {
      headers: buildRoleHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des rôles');
    }

    const roles = await response.json();

    if (!roles || roles.length === 0) {
      container.innerHTML = '<div class="alert alert-info">Aucun rôle trouvé</div>';
      return;
    }

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th>Nom</th>
              <th>Description</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${roles.map(role => `
              <tr>
                 <td><strong>${role.nom}</strong></td>
                 <td>${role.description || '-'}</td>
                 <td><span class="badge bg-info">${role.permission_count || 0} permissions</span></td>
                 <td>
                  <button class="btn btn-sm btn-outline-secondary" onclick="AdminRoles.openPermissions(${role.id_role}, '${role.nom.replace(/'/g, "\\'")}')">
                    <i class="bi bi-shield-check"></i> Permissions
                  </button>
                  <button class="btn btn-sm btn-outline-primary" onclick="AdminRoles.editRole(${role.id_role})">
                    <i class="bi bi-pencil"></i> Éditer
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="AdminRoles.deleteRole(${role.id_role})">
                    <i class="bi bi-trash"></i> Supprimer
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
    document.getElementById('rolesContainer').innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

async function loadPermissions() {
  try {
    const container = document.getElementById('permissionsContainer');

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/permissions', {
      headers: buildRoleHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des permissions');
    }

    const permissions = await response.json();

    if (!permissions || permissions.length === 0) {
      container.innerHTML = '<div class="alert alert-info">Aucune permission disponible</div>';
      return;
    }

    // Group permissions by category
    const grouped = {};
    permissions.forEach(perm => {
      const category = perm.categorie || 'Autre';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(perm);
    });

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover table-sm">
          <thead class="table-light">
            <tr>
              <th>Catégorie</th>
              <th>Code</th>
              <th>Description</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(grouped).map(([category, perms]) =>
              perms.map((perm, idx) => `
                <tr>
                  ${idx === 0 ? `<td rowspan="${perms.length}"><strong>${category}</strong></td>` : ''}
                  <td><code>${perm.code}</code></td>
                  <td>${perm.description || '-'}</td>
                  <td>${perm.actif ? '<span class="badge bg-success">Actif</span>' : '<span class="badge bg-secondary">Inactif</span>'}</td>
                </tr>
              `).join('')
            ).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('permissionsContainer').innerHTML = `<div class="alert alert-danger">Erreur: ${error.message}</div>`;
  }
}

function createRole() {
  const nom = prompt('Nom du rôle:');
  if (!nom) return;

  const description = prompt('Description (optionnel):');

  saveRole(null, nom, description);
}

async function saveRole(id, nom, description) {
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/admin/api/roles/${id}` : '/admin/api/roles';

    const response = await fetch(url, {
      method,
      headers: {
        ...buildRoleHeaders(true)
      },
      credentials: 'include',
      body: JSON.stringify({ nom, description })
    });

    if (!response.ok) throw new Error('Erreur lors de la sauvegarde');

    showToast(id ? 'Rôle mise à jour' : 'Rôle créé', 'success');
    loadRoles();
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

function editRole(roleId) {
  // Could implement inline editing or a modal
  const newNom = prompt('Nouveau nom du rôle:');
  if (!newNom) return;

  const newDesc = prompt('Description (optionnel):');
  saveRole(roleId, newNom, newDesc);
}

async function deleteRole(roleId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce rôle?')) return;

  try {
    const response = await fetch(`/admin/api/roles/${roleId}`, {
      method: 'DELETE',
      headers: buildRoleHeaders(),
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Erreur');

    showToast('Rôle supprimé', 'success');
    loadRoles();
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

async function assignPermissionToRole(roleId, permissionCode) {
  try {
    const response = await fetch(`/admin/api/roles/${roleId}/permissions`, {
      method: 'POST',
      headers: {
        ...buildRoleHeaders(true)
      },
      credentials: 'include',
      body: JSON.stringify({ code: permissionCode })
    });

    if (!response.ok) throw new Error('Erreur');

    showToast('Permission assignée', 'success');
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

async function removePermissionFromRole(roleId, permissionCode) {
  try {
    const response = await fetch(`/admin/api/roles/${roleId}/permissions/${permissionCode}`, {
      method: 'DELETE',
      headers: buildRoleHeaders(),
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Erreur');

    showToast('Permission supprimée', 'success');
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

async function openPermissions(roleId, roleName) {
  currentRoleId = roleId;
  const titleEl = document.getElementById('rolePermissionsTitle');
  const bodyEl = document.getElementById('rolePermissionsBody');
  if (titleEl) titleEl.textContent = roleName || '';
  if (bodyEl) bodyEl.innerHTML = '<div class="text-muted small">Chargement des permissions...</div>';

  const modalEl = document.getElementById('rolePermissionsModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  try {
    const [allPermsRes, rolePermsRes] = await Promise.all([
      fetch('/admin/api/permissions', { headers: buildRoleHeaders(), credentials: 'include' }),
      fetch(`/admin/api/roles/${roleId}/permissions`, { headers: buildRoleHeaders(), credentials: 'include' })
    ]);

    if (!allPermsRes.ok || !rolePermsRes.ok) throw new Error('Chargement des permissions impossible');

    const allPerms = await allPermsRes.json();
    const rolePermsJson = await rolePermsRes.json();
    const rolePerms = Array.isArray(rolePermsJson) ? rolePermsJson : [];
    currentPermissions = new Set(rolePerms.map(p => p.code));

    const grouped = {};
    allPerms.forEach(perm => {
      const category = perm.categorie || 'Autre';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(perm);
    });

    const html = Object.entries(grouped).map(([cat, perms]) => `
      <div class="col-md-6">
        <div class="border rounded p-3 h-100">
          <h6 class="fw-semibold mb-2">${cat}</h6>
          ${perms.map(perm => `
            <div class="form-check form-switch">
              <input class="form-check-input role-perm-toggle" type="checkbox" data-code="${perm.code}" ${currentPermissions.has(perm.code) ? 'checked' : ''}>
              <label class="form-check-label">
                <code>${perm.code}</code> — ${perm.description || ''}
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    if (bodyEl) bodyEl.innerHTML = html || '<div class="text-muted">Aucune permission</div>';
    modal.show();
  } catch (error) {
    console.error('Erreur openPermissions:', error);
    if (bodyEl) bodyEl.innerHTML = `<div class="text-danger">Erreur: ${error.message}</div>`;
    modal.show();
  }
}

function handlePermissionToggle(event) {
  const target = event.target;
  if (!target.classList.contains('role-perm-toggle')) return;
  const code = target.getAttribute('data-code');
  if (!code || !currentRoleId) return;

  const toggle = target.checked ? assignPermissionToRole : removePermissionFromRole;
  toggle(currentRoleId, code).catch(err => {
    console.error(err);
    target.checked = !target.checked;
  });
}

document.addEventListener('change', handlePermissionToggle);

const AdminRoles = {
  loadRoles,
  loadPermissions,
  createRole,
  editRole,
  deleteRole,
  assignPermissionToRole,
  removePermissionFromRole,
  openPermissions
};

window.AdminRoles = AdminRoles;
