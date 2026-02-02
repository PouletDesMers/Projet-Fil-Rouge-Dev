/**
 * Users Module
 * Handles user management in admin panel
 */

// Check if Bootstrap is loaded
console.log('Bootstrap loaded:', typeof bootstrap !== 'undefined');
if (typeof bootstrap !== 'undefined') {
  console.log('Bootstrap Modal available:', typeof bootstrap.Modal !== 'undefined');
}

// Load users from API
async function loadUsers() {
  try {
    
    const usersContainer = document.getElementById('usersContainer');

    usersContainer.innerHTML =
      '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des utilisateurs');
    }

    const users = await response.json();

    if (!users || users.length === 0) {
      usersContainer.innerHTML =
        '<div class="alert alert-info">Aucun utilisateur trouvé</div>';
      return;
    }

    // Display users in a table
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
              <th>Dernière connexion</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map(
                user => `
              <tr>
                <td><code>${user.id_utilisateur}</code></td>
                <td>
                  <div class="fw-bold">${user.lastName} ${user.firstName || ''}</div>
                  <small class="text-muted">${user.status === 'actif' ? '<span class="badge bg-success">Vérifié</span>' : '<span class="badge bg-warning">Non vérifié</span>'}</small>
                </td>
                <td>
                  <div>${user.email}</div>
                </td>
                <td>
                  <span class="badge ${
                    user.role === 'admin' ? 'bg-danger' : 'bg-primary'
                  }">
                    ${user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                  </span>
                </td>
                <td>
                  <span class="badge ${
                    user.est_actif ? 'bg-success' : 'bg-secondary'
                  }">
                    ${user.est_actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  <small class="text-muted">
                    ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Jamais'}
                  </small>
                </td>
                <td class="table-actions">
                  <div class="btn-group" role="group">
                    <button class="btn btn-outline-info btn-sm" onclick="AdminUsers.viewUser(${user.id_utilisateur})" title="Voir les détails">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-primary btn-sm" onclick="AdminUsers.editUser(${user.id_utilisateur})" title="Modifier">
                      <i class="bi bi-pencil"></i>
                    </button>
                    ${user.role !== 'admin' ? `
                      <button class="btn btn-outline-warning btn-sm" onclick="AdminUsers.promoteUser(${user.id_utilisateur})" title="Promouvoir admin">
                        <i class="bi bi-arrow-up-circle"></i>
                      </button>
                    ` : `
                      <button class="btn btn-outline-secondary btn-sm" onclick="AdminUsers.demoteUser(${user.id_utilisateur})" title="Rétrograder">
                        <i class="bi bi-arrow-down-circle"></i>
                      </button>
                    `}
                    <button class="btn btn-outline-${user.est_actif ? 'warning' : 'success'} btn-sm" onclick="AdminUsers.toggleUserStatus(${user.id_utilisateur}, ${!user.est_actif})" title="${
                  user.est_actif ? 'Désactiver' : 'Activer'
                }">
                      <i class="bi bi-${user.est_actif ? 'pause' : 'play'}"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    usersContainer.innerHTML = tableHTML;

    // Update statistics
    const totalUsers = users.length;
    const totalAdmins = users.filter(u => u.role === 'admin').length;
    const activeUsers = users.filter(u => u.est_actif).length;
    const verifiedUsers = users.filter(u => u.status === 'actif').length;

    document.getElementById('totalUsersCount').textContent = totalUsers;
    document.getElementById('totalAdminsCount').textContent = totalAdmins;
  } catch (error) {
    console.error('Erreur:', error);
    const usersContainer = document.getElementById('usersContainer');
    usersContainer.innerHTML =
      '<div class="alert alert-danger">Erreur lors du chargement des utilisateurs</div>';
  }
}

// View user details
async function viewUser(userId) {
  try {
    console.log('viewUser called with ID:', userId); // Debug
    
    // Close any open modals first
    const editModal = document.getElementById('editUserModal');
    if (editModal) {
      const editModalInstance = bootstrap.Modal.getInstance(editModal);
      if (editModalInstance) {
        console.log('Closing edit modal first...'); // Debug
        editModalInstance.hide();
        // Wait for modal to close
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    
    
    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Utilisateur introuvable');
    }

    const user = await response.json();
    console.log('User data received:', user); // Debug
    
    const modalContent = `
      <div class="row">
        <div class="col-md-12">
          <div class="mb-3 text-center">
            <h5>${user.lastName || 'N/A'} ${user.firstName || ''}</h5>
            <span class="badge ${
              user.role === 'admin' ? 'bg-danger' : 'bg-primary'
            } mb-2 me-2">
              ${user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
            </span>
            <span class="badge ${
              user.est_actif ? 'bg-success' : 'bg-secondary'
            }">
              ${user.est_actif ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <table class="table table-borderless">
            <tr>
              <th width="30%">Email:</th>
              <td>${user.email || 'N/A'} ${user.status === 'actif' ? '<span class="badge bg-success ms-1">Vérifié</span>' : '<span class="badge bg-warning ms-1">Non vérifié</span>'}</td>
            </tr>
            <tr>
              <th>ID:</th>
              <td><code>${user.id_utilisateur || 'N/A'}</code></td>
            </tr>
            <tr>
              <th>Date de création:</th>
              <td>${user.createdAt ? new Date(user.createdAt).toLocaleString('fr-FR') : (user.date_creation ? new Date(user.date_creation).toLocaleString('fr-FR') : 'Non disponible')}</td>
            </tr>
            <tr>
              <th>Dernière connexion:</th>
              <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString('fr-FR') : (user.derniere_connexion ? new Date(user.derniere_connexion).toLocaleString('fr-FR') : 'Jamais')}</td>
            </tr>
            <tr>
              <th>Authentification 2FA:</th>
              <td>
                ${user.totp_enabled === true ? '<span class="badge bg-success"><i class="bi bi-shield-check"></i> Activée</span>' : '<span class="badge bg-secondary"><i class="bi bi-shield-x"></i> Désactivée</span>'}
                <small class="text-muted ms-2">(totp_enabled: ${user.totp_enabled})</small>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
    
    console.log('Modal content created, length:', modalContent.length); // Debug
    console.log('User totp_enabled value:', user.totp_enabled, 'Type:', typeof user.totp_enabled); // Debug
    
    // Show in modal
    const modalElement = document.getElementById('userDetailsContent');
    console.log('Modal element found:', modalElement ? 'Yes' : 'No'); // Debug
    
    if (modalElement) {
      console.log('Setting modal innerHTML...'); // Debug
      modalElement.innerHTML = modalContent;
      console.log('innerHTML set, showing modal...'); // Debug
      
      const modalContainer = document.getElementById('userDetailsModal');
      console.log('Modal container found:', modalContainer ? 'Yes' : 'No'); // Debug
      
      if (modalContainer) {
        // Complete cleanup
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        document.querySelectorAll('.modal').forEach(m => {
          m.classList.remove('show');
          m.style.display = 'none';
          m.removeAttribute('aria-modal');
          m.setAttribute('aria-hidden', 'true');
        });
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
        
        console.log('Cleanup complete, attempting show...'); // Debug
        
        // Direct DOM manipulation approach
        setTimeout(() => {
          modalContainer.classList.add('show', 'fade');
          modalContainer.style.display = 'block';
          modalContainer.setAttribute('aria-modal', 'true');
          modalContainer.removeAttribute('aria-hidden');
          
          const backdrop = document.createElement('div');
          backdrop.className = 'modal-backdrop fade show';
          backdrop.style.zIndex = '1040';
          document.body.appendChild(backdrop);
          
          modalContainer.style.zIndex = '1050';
          document.body.classList.add('modal-open');
          
          console.log('Modal displayed manually'); // Debug
        }, 50);
      } else {
        console.error('Modal container (userDetailsModal) not found!');
        throw new Error('Conteneur de modale introuvable');
      }
    } else {
      console.error('Modal element (userDetailsContent) not found');
      throw new Error('Élément modal introuvable');
    }
    
  } catch (error) {
    console.error('View user error:', error); // Debug
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Edit user
async function editUser(userId) {
  try {
    
    
    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Utilisateur introuvable');
    }

    const user = await response.json();
    
    // Fill the edit form
    document.getElementById('editUserId').value = user.id_utilisateur;
    document.getElementById('editUserFirstName').value = user.firstName || '';
    document.getElementById('editUserLastName').value = user.lastName || '';
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserRole').value = user.role;
    document.getElementById('editUserStatus').checked = user.est_actif;
    
    // Show the edit modal
    const modalElement = document.getElementById('editUserModal');
    const modal = new bootstrap.Modal(modalElement);
    
    // Attach event listener to save button (after modal exists in DOM)
    const saveBtn = document.getElementById('saveUserBtn');
    if (saveBtn) {
      console.log('Attaching click event to save button'); // Debug
      // Remove previous event listeners by cloning
      const newSaveBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
      
      // Add new event listener
      newSaveBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Save button clicked!'); // Debug
        saveUser();
      });
    } else {
      console.error('Save button not found!'); // Debug
    }
    
    modal.show();
    
  } catch (error) {
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Save user changes
async function saveUser() {
  try {
    console.log('saveUser called'); // Debug
    
    const userId = document.getElementById('editUserId').value;
    
    console.log('User ID:', userId); // Debug
    
    const userData = {
      firstName: document.getElementById('editUserFirstName').value.trim(),
      lastName: document.getElementById('editUserLastName').value.trim(),
      email: document.getElementById('editUserEmail').value.trim(),
      role: document.getElementById('editUserRole').value,
      est_actif: document.getElementById('editUserStatus').checked
    };
    
    console.log('User data to send:', userData); // Debug
    
    // Validate
    if (!userData.lastName) {
      throw new Error('Le nom est requis');
    }
    if (!userData.email) {
      throw new Error('L\'email est requis');
    }
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });

    console.log('Response status:', response.status); // Debug
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Response error:', errorData); // Debug
      throw new Error(`Erreur lors de la sauvegarde: ${response.status} - ${errorData}`);
    }

    AdminUtils.showAlert('Utilisateur modifié avec succès', 'success');
    const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
    if (modal) {
      modal.hide();
    }
    loadUsers();
  } catch (error) {
    console.error('Save user error:', error); // Debug
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Promote user to admin
async function promoteUser(userId) {
  if (!confirm('Êtes-vous sûr de vouloir promouvoir cet utilisateur en tant qu\'administrateur ?')) {
    return;
  }

  try {
    
    
    // First get current user data
    const userResponse = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Erreur lors de la récupération de l\'utilisateur');
    }
    
    const user = await userResponse.json();
    
    // Update user role to admin
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...user,
        role: 'admin'
      })
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la promotion');
    }

    AdminUtils.showAlert('Utilisateur promu administrateur avec succès', 'success');
    loadUsers();
  } catch (error) {
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Demote admin to user
async function demoteUser(userId) {
  if (!confirm('Êtes-vous sûr de vouloir rétrograder cet administrateur en utilisateur standard ?')) {
    return;
  }

  try {
    
    
    // First get current user data
    const userResponse = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Erreur lors de la récupération de l\'utilisateur');
    }
    
    const user = await userResponse.json();
    
    // Update user role to standard user
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...user,
        role: 'utilisateur'
      })
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la rétrogradation');
    }

    AdminUtils.showAlert('Administrateur rétrogradé avec succès', 'success');
    loadUsers();
  } catch (error) {
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
  }
}

// Toggle user status (active/inactive)
async function toggleUserStatus(userId, activate) {
  const action = activate ? 'activer' : 'désactiver';
  
  if (!confirm(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) {
    return;
  }

  try {
    
    
    // First get current user data
    const userResponse = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Erreur lors de la récupération de l\'utilisateur');
    }
    
    const user = await userResponse.json();
    
    // Update user status
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...user,
        est_actif: activate
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de ${action}`);
    }

    AdminUtils.showAlert(`Utilisateur ${activate ? 'activé' : 'désactivé'} avec succès`, 'success');
    loadUsers();
  } catch (error) {
    AdminUtils.showAlert('Erreur: ' + error.message, 'danger');
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
  toggleUserStatus
};