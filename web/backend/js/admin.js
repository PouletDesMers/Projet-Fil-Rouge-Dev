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