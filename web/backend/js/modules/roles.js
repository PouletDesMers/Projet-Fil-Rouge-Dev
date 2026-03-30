// Role & Permission Management

let currentRoleId = null;
let currentPermissions = new Set();

async function loadRoles() {
  try {
    const token = localStorage.getItem('token');
    const container = document.getElementById('rolesContainer');

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/roles', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
    const token = localStorage.getItem('token');
    const container = document.getElementById('permissionsContainer');

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/permissions', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
    const token = localStorage.getItem('token');
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/admin/api/roles/${id}` : '/admin/api/roles';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
    const token = localStorage.getItem('token');
    const response = await fetch(`/admin/api/roles/${roleId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
    const token = localStorage.getItem('token');
    const response = await fetch(`/admin/api/roles/${roleId}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
    const token = localStorage.getItem('token');
    const response = await fetch(`/admin/api/roles/${roleId}/permissions/${permissionCode}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Erreur');

    showToast('Permission supprimée', 'success');
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'danger');
  }
}

const AdminRoles = {
  loadRoles,
  loadPermissions,
  createRole,
  editRole,
  deleteRole,
  assignPermissionToRole,
  removePermissionFromRole
};
