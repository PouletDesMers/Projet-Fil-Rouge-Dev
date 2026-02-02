// Global variables for category products management
let currentCategoryId = null;
let currentCategoryName = '';

// Get auth token from localStorage
function getAuthToken() {
  return localStorage.getItem('token');
}

// Redirect to login if not authenticated
function checkAuth() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = '/auth.html';
  }
}

// Check if user is admin
async function checkAdminStatus() {
  try {
    const token = getAuthToken();
    if (!token) {
      window.location.href = '/auth.html';
      return;
    }

    const response = await fetch('/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      window.location.href = '/auth.html';
      return;
    }

    const user = await response.json();

    if (user.role !== 'admin') {
      alert('Accès refusé : vous n\'avez pas les permissions administrateur');
      window.location.href = '/';
      return;
    }

    return user;
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    window.location.href = '/auth.html';
  }
}

// Load users from API
async function loadUsers() {
  try {
    const token = getAuthToken();
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
              <th>2FA</th>
              <th>Date d'inscription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map(
                (user) => `
              <tr>
                <td><code>${user.id_utilisateur || '-'}</code></td>
                <td>${[user.firstName, user.lastName].filter(Boolean).join(' ') || '-'}</td>
                <td><a href="mailto:${user.email}">${user.email || '-'}</a></td>
                <td>
                  ${
                    user.role === 'admin'
                      ? '<span class="badge badge-admin">Admin</span>'
                      : '<span class="badge bg-secondary">Client</span>'
                  }
                </td>
                <td>
                  ${
                    user.est_actif
                      ? '<span class="badge bg-success">Actif</span>'
                      : '<span class="badge bg-danger">Inactif</span>'
                  }
                </td>
                <td>
                  ${
                    user.totp_enabled
                      ? '<i class="bi bi-shield-check text-success" title="2FA activé"></i>'
                      : '<i class="bi bi-shield-x text-muted" title="2FA désactivé"></i>'
                  }
                </td>
                <td>${
                  user.date_inscription
                    ? new Date(user.date_inscription).toLocaleDateString('fr-FR')
                    : '-'
                }</td>
                <td class="table-actions">
                  <button class="btn btn-sm btn-outline-primary" onclick="viewUser(${user.id_utilisateur})" title="Voir le profil">
                    <i class="bi bi-eye"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-warning" onclick="editUser(${user.id_utilisateur})" title="Éditer">
                    <i class="bi bi-pencil"></i>
                  </button>
                  ${
                    user.role !== 'admin'
                      ? `<button class="btn btn-sm btn-outline-success" onclick="promoteUser(${user.id_utilisateur})" title="Promouvoir admin">
                           <i class="bi bi-arrow-up-circle"></i>
                         </button>`
                      : `<button class="btn btn-sm btn-outline-secondary" onclick="demoteUser(${user.id_utilisateur})" title="Rétrograder">
                           <i class="bi bi-arrow-down-circle"></i>
                         </button>`
                  }
                  ${
                    user.est_actif
                      ? `<button class="btn btn-sm btn-outline-danger" onclick="toggleUserStatus(${user.id_utilisateur}, false)" title="Désactiver">
                           <i class="bi bi-x-circle"></i>
                         </button>`
                      : `<button class="btn btn-sm btn-outline-success" onclick="toggleUserStatus(${user.id_utilisateur}, true)" title="Activer">
                           <i class="bi bi-check-circle"></i>
                         </button>`
                  }
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="card mt-4">
        <div class="card-body">
          <h6 class="card-title">Résumé</h6>
          <p class="mb-0">
            Total: <strong>${users.length}</strong> utilisateur(s)
            <br />
            Admins: <strong>${users.filter((u) => u.role === 'admin').length}</strong>
            <br />
            Actifs: <strong>${users.filter((u) => u.est_actif).length}</strong>
            <br />
            2FA activé: <strong>${users.filter((u) => u.totp_enabled).length}</strong>
          </p>
        </div>
      </div>
    `;

    usersContainer.innerHTML = tableHTML;

    // Update statistics
    document.getElementById('totalUsersCount').textContent = users.length;
    document.getElementById('totalAdminsCount').textContent = users.filter(
      (u) => u.role === 'admin'
    ).length;
    document.getElementById('totalActiveCount').textContent = users.filter(
      (u) => u.est_actif
    ).length;
  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('usersContainer').innerHTML =
      '<div class="alert alert-danger">' +
      error.message +
      '</div>';
  }
}

// Handle section navigation
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth before anything
  await checkAdminStatus();

  // Load initial users
  loadUsers();

  // Handle refresh button
  document
    .getElementById('refreshUsersBtn')
    ?.addEventListener('click', loadUsers);

  // Handle sidebar navigation
  document.querySelectorAll('[data-section]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // Hide all sections
      document.querySelectorAll('.section-content').forEach((section) => {
        section.classList.add('d-none');
      });

      // Remove active class from all links
      document.querySelectorAll('[data-section]').forEach((link) => {
        link.classList.remove('active');
      });

      // Show selected section
      const section = e.target.closest('[data-section]');
      const sectionId = section.getAttribute('data-section') + '-section';
      document.getElementById(sectionId)?.classList.remove('d-none');

      // Add active class to clicked link
      section.classList.add('active');

      // Reload users if navigating to users section
      if (sectionId === 'users-section') {
        loadUsers();
      } else if (sectionId === 'images-section') {
        loadImages();
      } else if (sectionId === 'categories-section') {
        loadCategories();
      } else if (sectionId === 'products-section') {
        loadCategoriesForProducts().then(() => {
          loadProducts();
        });
      }
    });
  });

  // Images section handlers
  document.getElementById('addImageBtn')?.addEventListener('click', () => {
    openImageModal();
  });

  document.getElementById('saveImageBtn')?.addEventListener('click', () => {
    saveImage();
  });

  // Image URL preview
  document.getElementById('imageUrl')?.addEventListener('input', (e) => {
    previewImage(e.target.value);
  });

  // Categories section handlers
  document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
    openCategoryModal();
  });

  document.getElementById('saveCategoryBtn')?.addEventListener('click', () => {
    saveCategory();
  });

  // Products section handlers
  document.getElementById('addProductBtn')?.addEventListener('click', () => {
    loadCategoriesForProducts().then(() => {
      openProductModal();
    });
  });

  document.getElementById('saveProductBtn')?.addEventListener('click', () => {
    saveProduct();
  });

  // Category filter for products
  document.getElementById('categoryFilter')?.addEventListener('change', () => {
    loadProducts();
  });

  // Add category from product modal
  document.getElementById('addCategoryFromProductBtn')?.addEventListener('click', () => {
    openCategoryModal();
  });

  // Add product to category button
  document.getElementById('addProductToCategoryBtn')?.addEventListener('click', () => {
    openProductModal(null, currentCategoryId);
  });

  // Handle logout
  document.getElementById('logoutAdminBtn')?.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = '/auth.html';
  });
});
// View user details
async function viewUser(userId) {
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des détails');
    }

    const user = await response.json();
    
    const detailsHTML = `
      <div class="row">
        <div class="col-md-6">
          <h6 class="text-muted">Informations personnelles</h6>
          <p><strong>ID:</strong> ${user.id_utilisateur}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Nom:</strong> ${user.lastName || '-'}</p>
          <p><strong>Prénom:</strong> ${user.firstName || '-'}</p>
          <p><strong>Téléphone:</strong> ${user.phone || '-'}</p>
        </div>
        <div class="col-md-6">
          <h6 class="text-muted">Informations du compte</h6>
          <p><strong>Rôle:</strong> <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'bg-secondary'}">${user.role}</span></p>
          <p><strong>Statut:</strong> ${user.status || '-'}</p>
          <p><strong>Actif:</strong> ${user.est_actif ? '✅ Oui' : '❌ Non'}</p>
          <p><strong>2FA:</strong> ${user.totp_enabled ? '✅ Activé' : '❌ Désactivé'}</p>
          <p><strong>Date d'inscription:</strong> ${user.date_inscription ? new Date(user.date_inscription).toLocaleString('fr-FR') : '-'}</p>
          <p><strong>Dernière connexion:</strong> ${user.lastLogin ? new Date(user.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</p>
        </div>
      </div>
    `;
    
    document.getElementById('userDetailsContent').innerHTML = detailsHTML;
    document.getElementById('editFromViewBtn').onclick = () => {
      const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewUserModal'));
      viewModal.hide();
      editUser(userId);
    };
    
    const viewModal = new bootstrap.Modal(document.getElementById('viewUserModal'));
    viewModal.show();
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur lors du chargement des détails: ' + error.message, 'error');
  }
}

// Edit user
async function editUser(userId) {
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des détails');
    }

    const user = await response.json();
    
    // Fill form
    document.getElementById('editUserId').value = user.id_utilisateur;
    document.getElementById('editUserEmail').value = user.email || '';
    document.getElementById('editUserRole').value = user.role || 'client';
    document.getElementById('editUserFirstName').value = user.firstName || '';
    document.getElementById('editUserLastName').value = user.lastName || '';
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserStatus').value = user.status || 'actif';
    document.getElementById('editUserActive').checked = user.est_actif || false;
    
    // Update 2FA status
    const twoFAStatus = document.getElementById('edit2FAStatus');
    const remove2FABtn = document.getElementById('remove2FABtn');
    if (user.totp_enabled) {
      twoFAStatus.textContent = 'Activé';
      twoFAStatus.className = 'badge bg-success';
      remove2FABtn.style.display = 'inline-block';
    } else {
      twoFAStatus.textContent = 'Désactivé';
      twoFAStatus.className = 'badge bg-secondary';
      remove2FABtn.style.display = 'none';
    }
    
    const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
    editModal.show();
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur lors du chargement: ' + error.message, 'error');
  }
}

// Save user changes
document.getElementById('saveUserBtn')?.addEventListener('click', async () => {
  try {
    const token = getAuthToken();
    const userId = document.getElementById('editUserId').value;
    
    const userData = {
      email: document.getElementById('editUserEmail').value,
      role: document.getElementById('editUserRole').value,
      firstName: document.getElementById('editUserFirstName').value,
      lastName: document.getElementById('editUserLastName').value,
      phone: document.getElementById('editUserPhone').value,
      status: document.getElementById('editUserStatus').value,
      est_actif: document.getElementById('editUserActive').checked
    };
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de la mise à jour');
    }
    
    showAlert('editUserAlert', 'success', 'Utilisateur mis à jour avec succès !');
    setTimeout(() => {
      const editModal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
      editModal.hide();
      loadUsers();
      showToast('Utilisateur mis à jour !', 'success');
    }, 1500);
  } catch (error) {
    console.error('Error:', error);
    showAlert('editUserAlert', 'danger', error.message);
  }
});

// Promote user to admin
async function promoteUser(userId) {
  if (!confirm('Êtes-vous sûr de vouloir promouvoir cet utilisateur en tant qu\'admin ?')) {
    return;
  }
  
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'admin' })
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de la promotion');
    }
    
    showToast('Utilisateur promu admin avec succès !', 'success');
    loadUsers();
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Demote user from admin
async function demoteUser(userId) {
  if (!confirm('Êtes-vous sûr de vouloir rétrograder cet admin en client ?')) {
    return;
  }
  
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'client' })
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de la rétrogradation');
    }
    
    showToast('Utilisateur rétrogradé en client avec succès !', 'success');
    loadUsers();
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Toggle user active status
async function toggleUserStatus(userId, activate) {
  const action = activate ? 'activer' : 'désactiver';
  if (!confirm(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) {
    return;
  }
  
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ est_actif: activate })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de ${action}`);
    }
    
    showToast(`Utilisateur ${activate ? 'activé' : 'désactivé'} avec succès !`, 'success');
    loadUsers();
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Reset password
document.getElementById('resetPasswordBtn')?.addEventListener('click', async () => {
  if (!confirm('Générer un nouveau mot de passe pour cet utilisateur ?')) {
    return;
  }
  
  const userId = document.getElementById('editUserId').value;
  const newPassword = generateRandomPassword();
  
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de la réinitialisation');
    }
    
    showAlert('editUserAlert', 'success', `Nouveau mot de passe: <strong>${newPassword}</strong><br><small>Copiez-le et envoyez-le à l'utilisateur de manière sécurisée.</small>`);
  } catch (error) {
    console.error('Error:', error);
    showAlert('editUserAlert', 'danger', error.message);
  }
});

// Remove 2FA
document.getElementById('remove2FABtn')?.addEventListener('click', async () => {
  if (!confirm('Réinitialiser l\'authentification 2FA pour cet utilisateur ?')) {
    return;
  }
  
  const userId = parseInt(document.getElementById('editUserId').value);
  
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/user/2fa/remove`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: userId })
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de la suppression 2FA');
    }
    
    showToast('2FA réinitialisé avec succès !', 'success');
    document.getElementById('edit2FAStatus').textContent = 'Désactivé';
    document.getElementById('edit2FAStatus').className = 'badge bg-secondary';
    document.getElementById('remove2FABtn').style.display = 'none';
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
});

// Delete user
document.getElementById('deleteUserBtn')?.addEventListener('click', async () => {
  if (!confirm('⚠️ ATTENTION : Supprimer définitivement cet utilisateur ? Cette action est irréversible !')) {
    return;
  }
  
  const userId = document.getElementById('editUserId').value;
  
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de la suppression');
    }
    
    showToast('Utilisateur supprimé avec succès !', 'success');
    const editModal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
    editModal.hide();
    loadUsers();
  } catch (error) {
    console.error('Error:', error);
    showAlert('editUserAlert', 'danger', error.message);
  }
});

// Utility functions
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  const toastId = 'toast-' + Date.now();
  const bgColor = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-primary';
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '💡';
  
  const toastHTML = `
    <div id="${toastId}" class="toast ${bgColor} text-white" role="alert">
      <div class="toast-header ${bgColor} text-white border-0">
        <strong class="me-auto">${icon} ${type === 'success' ? 'Succès' : type === 'error' ? 'Erreur' : 'Information'}</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHTML);
  
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 4000 });
  toast.show();
  
  // Remove toast from DOM after it's hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

function showAlert(elementId, type, message) {
  const alert = document.getElementById(elementId);
  alert.className = `alert alert-${type}`;
  alert.innerHTML = message;
  alert.classList.remove('d-none');
  
  setTimeout(() => {
    alert.classList.add('d-none');
  }, 5000);
}

function generateRandomPassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// ========== IMAGES MANAGEMENT ==========

// Load images from API
async function loadImages() {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/carousel-images', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des images');
    }

    const images = await response.json();
    renderImagesTable(images);
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('imagesContainer').innerHTML = 
      '<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ' + 
      error.message + '</div>';
  }
}

// Render images table
function renderImagesTable(images) {
  if (!images || images.length === 0) {
    document.getElementById('imagesContainer').innerHTML = 
      '<div class="alert alert-info"><i class="bi bi-info-circle"></i> Aucune image trouvée. Cliquez sur "Ajouter Image" pour commencer.</div>';
    return;
  }

  const tableHTML = `
    <div class="table-responsive">
      <table class="table table-hover">
        <thead class="table-dark">
          <tr>
            <th>Aperçu</th>
            <th>Titre</th>
            <th>Description</th>
            <th>Ordre</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${images.map(image => `
            <tr>
              <td>
                <img src="${image.url_image}" alt="${image.alt_text}" 
                     style="width: 80px; height: 45px; object-fit: cover; border-radius: 4px;">
              </td>
              <td>
                <strong>${image.titre}</strong>
                <br><small class="text-muted">${image.alt_text || 'Pas de texte alt'}</small>
              </td>
              <td>
                <div style="max-width: 200px;">
                  ${image.description ? image.description.substring(0, 100) + (image.description.length > 100 ? '...' : '') : '-'}
                </div>
              </td>
              <td>
                <span class="badge bg-secondary">#${image.ordre_affichage}</span>
              </td>
              <td>
                ${image.actif 
                  ? '<span class="badge bg-success">Actif</span>' 
                  : '<span class="badge bg-danger">Inactif</span>'}
              </td>
              <td>
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-primary" onclick="editImage(${image.id_image})" title="Éditer">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-outline-success" onclick="moveImageUp(${image.id_image})" title="Monter" ${image.ordre_affichage <= 1 ? 'disabled' : ''}>
                    <i class="bi bi-arrow-up"></i>
                  </button>
                  <button class="btn btn-outline-success" onclick="moveImageDown(${image.id_image})" title="Descendre" ${image.ordre_affichage >= images.length ? 'disabled' : ''}>
                    <i class="bi bi-arrow-down"></i>
                  </button>
                  <button class="btn btn-outline-warning" onclick="toggleImageStatus(${image.id_image}, ${!image.actif})" title="${image.actif ? 'Désactiver' : 'Activer'}">
                    <i class="bi bi-${image.actif ? 'eye-slash' : 'eye'}"></i>
                  </button>
                  <button class="btn btn-outline-danger" onclick="deleteImage(${image.id_image})" title="Supprimer">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('imagesContainer').innerHTML = tableHTML;
}

// Open image modal for add/edit
function openImageModal(imageId = null) {
  // Reset form
  document.getElementById('imageForm').reset();
  document.getElementById('imageId').value = imageId || '';
  document.getElementById('imagePreviewContainer').style.display = 'none';
  
  if (imageId) {
    // Edit mode
    document.getElementById('imageModalTitleText').textContent = 'Éditer Image';
    document.getElementById('saveImageBtnText').textContent = 'Modifier';
    loadImageForEdit(imageId);
  } else {
    // Add mode
    document.getElementById('imageModalTitleText').textContent = 'Ajouter Image';
    document.getElementById('saveImageBtnText').textContent = 'Ajouter';
    document.getElementById('imageActive').checked = true;
  }
  
  const modal = new bootstrap.Modal(document.getElementById('imageModal'));
  modal.show();
}

// Load image data for editing
async function loadImageForEdit(imageId) {
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/carousel-images/${imageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement de l\'image');
    }

    const image = await response.json();
    
    // Fill form
    document.getElementById('imageTitre').value = image.titre;
    document.getElementById('imageUrl').value = image.url_image;
    document.getElementById('imageAlt').value = image.alt_text || '';
    document.getElementById('imageDescription').value = image.description || '';
    document.getElementById('imageOrder').value = image.ordre_affichage;
    document.getElementById('imageActive').checked = image.actif;
    
    // Show preview
    previewImage(image.url_image);
  } catch (error) {
    console.error('Error:', error);
    showAlert('imageAlert', 'danger', 'Erreur: ' + error.message);
  }
}

// Save image (add or edit)
async function saveImage() {
  try {
    const token = getAuthToken();
    const imageId = document.getElementById('imageId').value;
    const isEdit = !!imageId;
    
    const imageData = {
      titre: document.getElementById('imageTitre').value,
      description: document.getElementById('imageDescription').value,
      url_image: document.getElementById('imageUrl').value,
      alt_text: document.getElementById('imageAlt').value || document.getElementById('imageTitre').value,
      ordre_affichage: parseInt(document.getElementById('imageOrder').value) || 1,
      actif: document.getElementById('imageActive').checked
    };

    // Validation
    if (!imageData.titre || !imageData.url_image) {
      showAlert('imageAlert', 'warning', 'Le titre et l\'URL sont requis.');
      return;
    }

    const url = isEdit ? `/api/carousel-images/${imageId}` : '/api/carousel-images';
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(imageData)
    });

    if (!response.ok) {
      throw new Error(isEdit ? 'Erreur lors de la modification' : 'Erreur lors de la création');
    }

    showToast(`Image ${isEdit ? 'modifiée' : 'ajoutée'} avec succès !`, 'success');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('imageModal'));
    modal.hide();
    loadImages();
  } catch (error) {
    console.error('Error:', error);
    showAlert('imageAlert', 'danger', 'Erreur: ' + error.message);
  }
}

// Preview image
function previewImage(url) {
  if (url && url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
    document.getElementById('imagePreview').src = url;
    document.getElementById('imagePreviewContainer').style.display = 'block';
  } else {
    document.getElementById('imagePreviewContainer').style.display = 'none';
  }
}

// Edit image
function editImage(imageId) {
  openImageModal(imageId);
}

// Delete image
async function deleteImage(imageId) {
  if (!confirm('⚠️ ATTENTION : Supprimer définitivement cette image ? Cette action est irréversible !')) {
    return;
  }

  try {
    const token = getAuthToken();
    const response = await fetch(`/api/carousel-images/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression');
    }

    showToast('Image supprimée avec succès !', 'success');
    loadImages();
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Toggle image status
async function toggleImageStatus(imageId, activate) {
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/carousel-images/${imageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ actif: activate })
    });

    if (!response.ok) {
      throw new Error('Erreur lors du changement de statut');
    }

    showToast(`Image ${activate ? 'activée' : 'désactivée'} avec succès !`, 'success');
    loadImages();
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Move image up in order
async function moveImageUp(imageId) {
  changeImageOrder(imageId, 'up');
}

// Move image down in order
async function moveImageDown(imageId) {
  changeImageOrder(imageId, 'down');
}

// Change image order
async function changeImageOrder(imageId, direction) {
  try {
    const token = getAuthToken();
    
    // Get current images to calculate new orders
    const response = await fetch('/api/carousel-images', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des images');
    }

    const images = await response.json();
    const currentImage = images.find(img => img.id_image === imageId);
    const currentOrder = currentImage.ordre_affichage;
    
    let targetOrder;
    if (direction === 'up' && currentOrder > 1) {
      targetOrder = currentOrder - 1;
    } else if (direction === 'down' && currentOrder < images.length) {
      targetOrder = currentOrder + 1;
    } else {
      return; // No change needed
    }

    // Find the image that needs to be swapped
    const targetImage = images.find(img => img.ordre_affichage === targetOrder);
    
    if (targetImage) {
      // Update orders
      const updateResponse = await fetch('/api/carousel-images/reorder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_orders: [
            { id: imageId, order: targetOrder },
            { id: targetImage.id_image, order: currentOrder }
          ]
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Erreur lors du changement d\'ordre');
      }

      showToast('Ordre modifié avec succès !', 'success');
      loadImages();
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// ============== CATEGORIES MANAGEMENT ==============

// Load categories from API
async function loadCategories() {
  try {
    const token = getAuthToken();
    const categoriesContainer = document.getElementById('categoriesContainer');

    categoriesContainer.innerHTML =
      '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/api/web-categories', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des catégories');
    }

    const categories = await response.json();

    if (!categories || categories.length === 0) {
      categoriesContainer.innerHTML =
        '<div class="alert alert-info">Aucune catégorie trouvée</div>';
      return;
    }

    // Display categories in a table
    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Icône</th>
              <th>Couleur</th>
              <th>Ordre</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categories
              .map(
                (cat) => `
              <tr>
                <td><code>${cat.id_categorie}</code></td>
                <td><strong>${cat.nom}</strong></td>
                <td><code>${cat.slug}</code></td>
                <td>${cat.description ? cat.description.substring(0, 50) + (cat.description.length > 50 ? '...' : '') : '-'}</td>
                <td><i class="${cat.icone}" style="color: ${cat.couleur}"></i> <small>${cat.icone}</small></td>
                <td><span class="badge" style="background-color: ${cat.couleur};">${cat.couleur}</span></td>
                <td>${cat.ordre_affichage}</td>
                <td>
                  <span class="badge ${cat.actif ? 'bg-success' : 'bg-secondary'}">
                    ${cat.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td class="table-actions">
                  <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-secondary" onclick="moveCategory(${cat.id_categorie}, 'up')" title="Déplacer vers le haut">
                      <i class="bi bi-arrow-up"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="moveCategory(${cat.id_categorie}, 'down')" title="Déplacer vers le bas">
                      <i class="bi bi-arrow-down"></i>
                    </button>
                  </div>
                  <button class="btn btn-outline-success btn-sm me-2 ms-2" onclick="showCategoryProducts(${cat.id_categorie}, '${cat.nom}')" title="Gérer les produits">
                    <i class="bi bi-box"></i>
                  </button>
                  <button class="btn btn-outline-primary btn-sm me-2" onclick="editCategory(${cat.id_categorie})">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-outline-${cat.actif ? 'warning' : 'success'} btn-sm me-2" onclick="toggleCategoryStatus(${cat.id_categorie}, ${!cat.actif})">
                    <i class="bi bi-${cat.actif ? 'eye-slash' : 'eye'}"></i>
                  </button>
                  <button class="btn btn-outline-danger btn-sm" onclick="deleteCategory(${cat.id_categorie}, '${cat.nom}')">
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    categoriesContainer.innerHTML = tableHTML;
  } catch (error) {
    console.error('Erreur:', error);
    const categoriesContainer = document.getElementById('categoriesContainer');
    categoriesContainer.innerHTML =
      '<div class="alert alert-danger">Erreur lors du chargement des catégories</div>';
  }
}

// Open category modal
function openCategoryModal(category = null) {
  const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
  const titleText = document.getElementById('categoryModalTitleText');
  const saveBtn = document.getElementById('saveCategoryBtnText');
  const form = document.getElementById('categoryForm');

  form.reset();

  if (category) {
    titleText.textContent = 'Modifier Catégorie';
    saveBtn.textContent = 'Modifier';
    
    document.getElementById('categoryId').value = category.id_categorie;
    document.getElementById('categoryNom').value = category.nom;
    document.getElementById('categorySlug').value = category.slug;
    document.getElementById('categoryDescription').value = category.description || '';
    document.getElementById('categoryIcone').value = category.icone || '';
    document.getElementById('categoryCouleur').value = category.couleur || '#7602F9';
    document.getElementById('categoryOrder').value = category.ordre_affichage || 1;
    document.getElementById('categoryActive').checked = category.actif;
  } else {
    titleText.textContent = 'Ajouter Catégorie';
    saveBtn.textContent = 'Ajouter';
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryCouleur').value = '#7602F9';
    document.getElementById('categoryOrder').value = '1';
    document.getElementById('categoryActive').checked = true;
  }

  modal.show();
}

// Save category
async function saveCategory() {
  try {
    const token = getAuthToken();
    const categoryId = document.getElementById('categoryId').value;
    const isEdit = Boolean(categoryId);

    const categoryData = {
      nom: document.getElementById('categoryNom').value,
      slug: document.getElementById('categorySlug').value,
      description: document.getElementById('categoryDescription').value,
      icone: document.getElementById('categoryIcone').value || 'bi bi-tag',
      couleur: document.getElementById('categoryCouleur').value,
      ordre_affichage: parseInt(document.getElementById('categoryOrder').value) || 1,
      actif: document.getElementById('categoryActive').checked
    };

    const url = isEdit ? `/api/web-categories/${categoryId}` : '/api/web-categories';
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoryData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
    modal.hide();

    showToast(
      isEdit ? 'Catégorie modifiée avec succès !' : 'Catégorie ajoutée avec succès !',
      'success'
    );
    loadCategories();
    
    // Also reload categories for products if we're adding from product modal
    const productModal = document.getElementById('productModal');
    if (productModal && productModal.classList.contains('show')) {
      loadCategoriesForProducts();
    }
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Edit category
async function editCategory(categoryId) {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/web-categories', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des catégories');
    }

    const categories = await response.json();
    const category = categories.find(c => c.id_categorie === categoryId);
    
    if (category) {
      openCategoryModal(category);
    }
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur lors du chargement de la catégorie', 'error');
  }
}

// Toggle category status
async function toggleCategoryStatus(categoryId, newStatus) {
  try {
    const token = getAuthToken();
    const response = await fetch(`/api/web-categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ actif: newStatus })
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la modification du statut');
    }

    showToast('Statut de la catégorie modifié !', 'success');
    loadCategories();
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Delete category
async function deleteCategory(categoryId, categoryName) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${categoryName}" ?\n\nCette action supprimera également tous les produits associés.`)) {
    return;
  }

  try {
    const token = getAuthToken();
    const response = await fetch(`/api/web-categories/${categoryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression');
    }

    showToast('Catégorie supprimée avec succès !', 'success');
    loadCategories();
  } catch (error) {
    console.error('Erreur:', error);
    showToast('Erreur: ' + error.message, 'error');
  }
}

// Open product modal
function openProductModal(product = null, preselectedCategoryId = null) {
  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  const titleText = document.getElementById('productModalTitleText');
  const saveBtn = document.getElementById('saveProductBtnText');
  const categorieContainer = document.getElementById('productCategorieContainer');
  const orderContainer = document.getElementById('productOrderContainer');
  const selectedCategoryInfo = document.getElementById('selectedCategoryInfo');
  const categorySelect = document.getElementById('productCategorie');
  const nomInput = document.getElementById('productNom');
  const slugInput = document.getElementById('productSlug');
  const form = document.getElementById('productForm');

  form.reset();

  if (product) {
    // Edit mode - show all fields
    titleText.textContent = 'Modifier Produit';
    saveBtn.textContent = 'Modifier';
    
    document.getElementById('productId').value = product.id_produit;
    document.getElementById('productNom').value = product.nom;
    document.getElementById('productSlug').value = product.slug;
    document.getElementById('productDescCourte').value = product.description_courte || '';
    document.getElementById('productDescLongue').value = product.description_longue || '';
    document.getElementById('productCategorie').value = product.id_categorie || '';
    document.getElementById('productTag').value = product.tag || 'Standard';
    document.getElementById('productStatut').value = product.statut || 'Disponible';
    document.getElementById('productPrix').value = product.prix || '';
    document.getElementById('productDevise').value = product.devise || 'EUR';
    document.getElementById('productDuree').value = product.duree || 'mois';
    document.getElementById('productTypeAchat').value = product.type_achat || 'panier';
    document.getElementById('productOrder').value = product.ordre_affichage || 1;
    document.getElementById('productActive').checked = product.actif;
    
    // Show all fields for editing
    categorieContainer.style.display = 'block';
    orderContainer.style.display = 'block';
    selectedCategoryInfo.style.display = 'none';
    
    // Remove auto-generation listener if exists
    nomInput.removeEventListener('input', autoGenerateSlug);
  } else {
    // Add mode - hide category and order, auto-generate slug
    titleText.textContent = 'Ajouter Produit';
    saveBtn.textContent = 'Ajouter';
    
    document.getElementById('productId').value = '';
    document.getElementById('productTag').value = 'Standard';
    document.getElementById('productStatut').value = 'Disponible';
    document.getElementById('productDevise').value = 'EUR';
    document.getElementById('productDuree').value = 'mois';
    document.getElementById('productTypeAchat').value = 'panier';
    document.getElementById('productActive').checked = true;
    
    // Hide category and order fields, show info
    categorieContainer.style.display = 'none';
    orderContainer.style.display = 'none';
    selectedCategoryInfo.style.display = 'block';
    selectedCategoryInfo.innerHTML = `Catégorie: <strong>${currentCategoryName}</strong> | Ordre d'affichage: <strong>Automatique</strong>`;
    
    // Set category value
    if (preselectedCategoryId && currentCategoryId) {
      categorySelect.value = preselectedCategoryId;
    }
    
    // Auto-generate next order
    setNextOrderForCategory();
    
    // Add slug auto-generation
    nomInput.addEventListener('input', autoGenerateSlug);
  }

  modal.show();
}

// Auto-generate slug based on category + product name
function autoGenerateSlug() {
  const nomInput = document.getElementById('productNom');
  const slugInput = document.getElementById('productSlug');
  const categoryName = currentCategoryName;
  
  if (nomInput.value && categoryName) {
    // Create slug: category-product-name
    const categorySlug = categoryName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Remove multiple hyphens
    
    const productSlug = nomInput.value.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Remove multiple hyphens
    
    const generatedSlug = `${categorySlug}-${productSlug}`;
    slugInput.value = generatedSlug;
  }
}

// Set next order for category automatically
async function setNextOrderForCategory() {
  if (!currentCategoryId) return;
  
  try {
    const token = getAuthToken();
    const response = await fetch('/api/web-products', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const products = await response.json();
      const categoryProducts = products.filter(p => 
        p.id_categorie && p.id_categorie.toString() === currentCategoryId.toString()
      );
      
      // Find highest order + 1
      const maxOrder = categoryProducts.reduce((max, product) => {
        const order = product.ordre_affichage || 1;
        return order > max ? order : max;
      }, 0);
      
      document.getElementById('productOrder').value = maxOrder + 1;
    }
  } catch (error) {
    // Default to 1 if anything fails
    document.getElementById('productOrder').value = 1;
  }
}

// Load products from API
async function loadProducts() {
  try {
    const token = getAuthToken();
    const productsContainer = document.getElementById('productsContainer');
    const categoryFilter = document.getElementById('categoryFilter');
    const selectedCategory = categoryFilter ? categoryFilter.value : '';

    productsContainer.innerHTML =
      '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/api/web-products', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des produits');
    }

    let products = await response.json();

    // Apply category filter if selected
    if (selectedCategory && selectedCategory !== '') {
      products = products.filter(product => 
        product.id_categorie && product.id_categorie.toString() === selectedCategory
      );
    }

    if (!products || products.length === 0) {
      productsContainer.innerHTML =
        '<div class="alert alert-info">Aucun produit trouvé</div>';
      return;
    }

    // Display products in a table
    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Catégorie</th>
              <th>Prix</th>
              <th>Tag</th>
              <th>Statut</th>
              <th>Type</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .map(
                product => `
              <tr>
                <td>${product.id_produit}</td>
                <td>
                  <strong>${product.nom}</strong><br>
                  <small class="text-muted">${product.slug}</small>
                </td>
                <td>
                  <span class="badge bg-secondary" id="category-${product.id_produit}">${product.id_categorie || 'N/A'}</span>
                </td>
                <td>
                  ${product.prix ? `${product.prix} ${product.devise}` : 'Sur devis'}
                  <br><small class="text-muted">par ${product.duree}</small>
                </td>
                <td>
                  <span class="badge ${getTagColor(product.tag)}">${product.tag || 'Standard'}</span>
                </td>
                <td>
                  <span class="badge ${getStatusColor(product.statut)}">${product.statut || 'Disponible'}</span>
                </td>
                <td>
                  <span class="badge ${product.type_achat === 'devis' ? 'bg-info' : 'bg-success'}">${product.type_achat || 'panier'}</span>
                </td>
                <td>
                  <span class="badge ${product.actif ? 'bg-success' : 'bg-danger'}">${
                  product.actif ? 'Actif' : 'Inactif'
                }</span>
                </td>
                <td>
                  <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-secondary" onclick="moveProduct(${product.id_produit}, 'up')" title="Déplacer vers le haut">
                      <i class="bi bi-arrow-up"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="moveProduct(${product.id_produit}, 'down')" title="Déplacer vers le bas">
                      <i class="bi bi-arrow-down"></i>
                    </button>
                  </div>
                  <button class="btn btn-sm btn-outline-primary me-1 ms-2" onclick="openProductModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${product.id_produit})">
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    productsContainer.innerHTML = tableHTML;
    
    // Load category names to replace IDs with names
    await loadCategoryNamesForProducts();
    
  } catch (error) {
    console.error('Erreur lors du chargement des produits:', error);
    document.getElementById('productsContainer').innerHTML =
      '<div class="alert alert-danger">Erreur lors du chargement des produits: ' +
      error.message +
      '</div>';
  }
}

// Helper functions for badge colors
function getTagColor(tag) {
  switch (tag?.toLowerCase()) {
    case 'premium':
      return 'bg-warning text-dark';
    case 'prioritaire':
      return 'bg-primary';
    case 'standard':
    default:
      return 'bg-secondary';
  }
}

function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'disponible':
      return 'bg-success';
    case 'en rupture':
      return 'bg-danger';
    case 'sur commande':
      return 'bg-warning text-dark';
    default:
      return 'bg-secondary';
  }
}

// Save product
async function saveProduct() {
  try {
    const token = getAuthToken();
    const productId = document.getElementById('productId').value;

    // Get category - use current category if we're in category view and adding
    let categoryId = document.getElementById('productCategorie').value;
    if (!productId && currentCategoryId && !categoryId) {
      // Adding new product from category view
      categoryId = currentCategoryId;
    }

    // Validate required fields
    if (!document.getElementById('productNom').value.trim()) {
      throw new Error('Le nom du produit est requis');
    }
    if (!document.getElementById('productSlug').value.trim()) {
      throw new Error('Le slug est requis');
    }
    if (!categoryId) {
      throw new Error('La catégorie est requise');
    }

    const productData = {
      nom: document.getElementById('productNom').value.trim(),
      slug: document.getElementById('productSlug').value.trim(),
      description_courte: document.getElementById('productDescCourte').value.trim(),
      description_longue: document.getElementById('productDescLongue').value.trim(),
      id_categorie: parseInt(categoryId),
      tag: document.getElementById('productTag').value,
      statut: document.getElementById('productStatut').value,
      prix: parseFloat(document.getElementById('productPrix').value) || null,
      devise: document.getElementById('productDevise').value,
      duree: document.getElementById('productDuree').value,
      type_achat: document.getElementById('productTypeAchat').value,
      ordre_affichage: parseInt(document.getElementById('productOrder').value) || 1,
      actif: document.getElementById('productActive').checked
    };

    const url = productId ? `/api/web-products/${productId}` : '/api/web-products';
    const method = productId ? 'PUT' : 'POST';

    console.log('Sending product data:', productData); // Debug log

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`Erreur ${response.status}: ${errorText}`);
    }

    // Close modal and refresh list
    const modal = bootstrap.Modal.getInstance(
      document.getElementById('productModal')
    );
    modal.hide();
    
    if (currentCategoryId) {
      loadCategoryProducts();
    } else {
      loadProducts();
    }

    // Show success message
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
      ${productId ? 'Produit modifié' : 'Produit créé'} avec succès!
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    const adminContent = document.querySelector('.admin-content');
    if (adminContent) {
      adminContent.insertBefore(alertDiv, adminContent.firstChild);
    }

  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    alert('Erreur lors de la sauvegarde du produit: ' + error.message);
  }
}

// Delete product
async function deleteProduct(productId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
    return;
  }

  try {
    const token = getAuthToken();

    const response = await fetch(`/api/web-products/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression du produit');
    }

    if (currentCategoryId) {
      loadCategoryProducts();
    } else {
      loadProducts();
    }

    // Show success message
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
      Produit supprimé avec succès!
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    const adminContent = document.querySelector('.admin-content');
    if (adminContent) {
      adminContent.insertBefore(alertDiv, adminContent.firstChild);
    }

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    alert('Erreur lors de la suppression du produit: ' + error.message);
  }
}

// Load categories for product dropdown
async function loadCategoriesForProducts() {
  try {
    const token = getAuthToken();

    const response = await fetch('/api/web-categories', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des catégories');
    }

    const categories = await response.json();
    const select = document.getElementById('productCategorie');
    
    if (select) {
      select.innerHTML = '<option value="">Sélectionner une catégorie</option>' +
        categories.map(cat => `<option value="${cat.id_categorie}">${cat.nom}</option>`).join('');
    }

    // Also load categories for filter dropdown
    const filterSelect = document.getElementById('categoryFilter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Toutes les catégories</option>' +
        categories.map(cat => `<option value="${cat.id_categorie}">${cat.nom}</option>`).join('');
    }

  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error);
  }
}

// Move product up or down in order
async function moveProduct(productId, direction) {
  try {
    const token = getAuthToken();

    const response = await fetch(`/api/web-products/${productId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ direction: direction })
    });

    if (!response.ok) {
      // If the API endpoint doesn't exist, we'll implement it client-side
      await moveItemClientSide('product', productId, direction);
    } else {
      loadProducts();
      showAlert(`Produit déplacé vers ${direction === 'up' ? 'le haut' : 'le bas'} avec succès!`, 'success');
    }
  } catch (error) {
    // Fallback to client-side implementation
    await moveItemClientSide('product', productId, direction);
  }
}

// Move category up or down in order
async function moveCategory(categoryId, direction) {
  try {
    const token = getAuthToken();

    const response = await fetch(`/api/web-categories/${categoryId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ direction: direction })
    });

    if (!response.ok) {
      // If the API endpoint doesn't exist, we'll implement it client-side
      await moveItemClientSide('category', categoryId, direction);
    } else {
      loadCategories();
      showAlert(`Catégorie déplacée vers ${direction === 'up' ? 'le haut' : 'le bas'} avec succès!`, 'success');
    }
  } catch (error) {
    // Fallback to client-side implementation
    await moveItemClientSide('category', categoryId, direction);
  }
}

// Client-side implementation for moving items when API endpoints don't exist
async function moveItemClientSide(type, itemId, direction) {
  try {
    const token = getAuthToken();
    const apiEndpoint = type === 'product' ? '/api/web-products' : '/api/web-categories';
    
    // Get all items
    const response = await fetch(apiEndpoint, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des ${type}s`);
    }

    const items = await response.json();
    const orderField = type === 'product' ? 'ordre_affichage' : 'ordre_affichage';
    const idField = type === 'product' ? 'id_produit' : 'id_categorie';
    
    // Sort items by order
    items.sort((a, b) => (a[orderField] || 999) - (b[orderField] || 999));
    
    // Find current item index
    const currentIndex = items.findIndex(item => item[idField] == itemId);
    
    if (currentIndex === -1) {
      throw new Error(`${type} introuvable`);
    }
    
    // Calculate new position
    let newIndex;
    if (direction === 'up') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(items.length - 1, currentIndex + 1);
    }
    
    // If no change needed
    if (newIndex === currentIndex) {
      showAlert(`Le ${type} est déjà à ${direction === 'up' ? 'la première' : 'la dernière'} position`, 'info');
      return;
    }
    
    // Swap orders
    const currentItem = items[currentIndex];
    const targetItem = items[newIndex];
    
    const currentOrder = currentItem[orderField] || (currentIndex + 1);
    const targetOrder = targetItem[orderField] || (newIndex + 1);
    
    // Update both items
    await updateItemOrder(type, currentItem[idField], targetOrder);
    await updateItemOrder(type, targetItem[idField], currentOrder);
    
    // Reload the list
    if (type === 'product') {
      loadProducts();
    } else {
      loadCategories();
    }
    
    showAlert(`${type === 'product' ? 'Produit' : 'Catégorie'} déplacé${type === 'product' ? '' : 'e'} avec succès!`, 'success');
    
  } catch (error) {
    console.error(`Erreur lors du déplacement du ${type}:`, error);
    showAlert(`Erreur lors du déplacement: ${error.message}`, 'danger');
  }
}

// Update item order - Simplified version that works with our API
async function updateItemOrder(type, itemId, newOrder) {
  const token = getAuthToken();
  
  try {
    // Get all items to find the one we want to update
    const listEndpoint = type === 'product' ? '/api/web-products' : '/api/web-categories';
    const listResponse = await fetch(listEndpoint, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!listResponse.ok) {
      throw new Error(`Erreur lors de la récupération de la liste des ${type}s`);
    }
    
    const allItems = await listResponse.json();
    const idField = type === 'product' ? 'id_produit' : 'id_categorie';
    const currentItem = allItems.find(item => item[idField] == itemId);
    
    if (!currentItem) {
      throw new Error(`${type} avec l'ID ${itemId} introuvable`);
    }
    
    // Update the item with new order
    const updateData = {
      ...currentItem,
      ordre_affichage: newOrder
    };
    
    const updateEndpoint = `${listEndpoint}/${itemId}`;
    const updateResponse = await fetch(updateEndpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Erreur lors de la mise à jour: ${errorText}`);
    }
    
  } catch (error) {
    console.error(`Erreur dans updateItemOrder pour ${type} ${itemId}:`, error);
    throw error;
  }
}

// Show alert message
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  const adminContent = document.querySelector('.admin-content');
  if (adminContent) {
    adminContent.insertBefore(alertDiv, adminContent.firstChild);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 3000);
  }
}

// Show products for a specific category
function showCategoryProducts(categoryId, categoryName) {
  currentCategoryId = categoryId;
  currentCategoryName = categoryName;
  
  // Update titles
  document.getElementById('categoryProductsTitle').textContent = `Produits de ${categoryName}`;
  document.getElementById('categoryProductsSubtitle').textContent = `Gérer les produits de la catégorie ${categoryName}`;
  
  // Hide all sections and show category products section
  document.querySelectorAll('.section-content').forEach(section => {
    section.classList.add('d-none');
  });
  document.getElementById('category-products-section').classList.remove('d-none');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Load products for this category
  loadCategoryProducts();
}

function backToCategories() {
  currentCategoryId = null;
  currentCategoryName = '';
  
  // Hide category products section and show categories
  document.querySelectorAll('.section-content').forEach(section => {
    section.classList.add('d-none');
  });
  document.getElementById('categories-section').classList.remove('d-none');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelector('[data-section="categories"]').classList.add('active');
}

// Load products for current category
async function loadCategoryProducts() {
  if (!currentCategoryId) return;
  
  try {
    const token = getAuthToken();
    const container = document.getElementById('categoryProductsContainer');

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/api/web-products', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des produits');
    }

    let products = await response.json();
    
    // Filter products by current category
    products = products.filter(product => 
      product.id_categorie && product.id_categorie.toString() === currentCategoryId.toString()
    );

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> 
          Aucun produit trouvé pour la catégorie "${currentCategoryName}".
          <br>
          <button class="btn btn-primary btn-sm mt-2" onclick="openProductModal(null, ${currentCategoryId})">
            <i class="bi bi-plus-circle"></i> Ajouter le premier produit
          </button>
        </div>
      `;
      return;
    }

    // Sort by order
    products.sort((a, b) => (a.ordre_affichage || 999) - (b.ordre_affichage || 999));

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom</th>
              <th>Prix</th>
              <th>Tag</th>
              <th>Statut</th>
              <th>Type</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .map(
                product => `
              <tr>
                <td><span class="badge bg-secondary">${product.ordre_affichage || 1}</span></td>
                <td>
                  <strong>${product.nom}</strong><br>
                  <small class="text-muted">${product.slug}</small>
                </td>
                <td>
                  ${product.prix ? `${product.prix} ${product.devise}` : 'Sur devis'}
                  <br><small class="text-muted">par ${product.duree}</small>
                </td>
                <td>
                  <span class="badge ${getTagColor(product.tag)}">${product.tag || 'Standard'}</span>
                </td>
                <td>
                  <span class="badge ${getStatusColor(product.statut)}">${product.statut || 'Disponible'}</span>
                </td>
                <td>
                  <span class="badge ${product.type_achat === 'devis' ? 'bg-info' : 'bg-success'}">${product.type_achat || 'panier'}</span>
                </td>
                <td>
                  <span class="badge ${product.actif ? 'bg-success' : 'bg-danger'}">${
                  product.actif ? 'Actif' : 'Inactif'
                }</span>
                </td>
                <td>
                  <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-secondary" onclick="moveProduct(${product.id_produit}, 'up')" title="Déplacer vers le haut">
                      <i class="bi bi-arrow-up"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="moveProduct(${product.id_produit}, 'down')" title="Déplacer vers le bas">
                      <i class="bi bi-arrow-down"></i>
                    </button>
                  </div>
                  <button class="btn btn-sm btn-outline-primary me-1 ms-2" onclick="openProductModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${product.id_produit})">
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  } catch (error) {
    console.error('Erreur lors du chargement des produits:', error);
    document.getElementById('categoryProductsContainer').innerHTML =
      '<div class="alert alert-danger">Erreur lors du chargement des produits: ' + error.message + '</div>';
  }
}
async function loadCategoryNamesForProducts() {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/web-categories', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return; // Silently fail if categories can't be loaded
    }

    const categories = await response.json();
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.id_categorie] = cat.nom;
    });

    // Update category names in product table
    const categoryBadges = document.querySelectorAll('[id^="category-"]');
    categoryBadges.forEach(badge => {
      const productId = badge.id.replace('category-', '');
      const categoryId = badge.textContent;
      if (categoryMap[categoryId]) {
        badge.textContent = categoryMap[categoryId];
        badge.classList.remove('bg-secondary');
        badge.classList.add('bg-info');
      }
    });
  } catch (error) {
    // Silently fail if category names can't be loaded
    console.debug('Could not load category names:', error);
  }
}