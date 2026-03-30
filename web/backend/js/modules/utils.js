/**
 * Utilities Module
 * Common utility functions used across the admin panel
 */

// Force all fetch calls to envoyer les cookies (session httpOnly) et éviter "Bearer null"
(function patchFetchForAuth() {
  const originalFetch = window.fetch;
  window.fetch = (url, options = {}) => {
    const opts = { credentials: 'include', ...options };
    opts.headers = { ...(options.headers || {}) };
    const token = AdminAuth?.getAuthToken?.();
    if (token && !opts.headers['Authorization']) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }
    if (opts.headers['Authorization'] === 'Bearer null') {
      delete opts.headers['Authorization'];
    }
    return originalFetch(url, opts);
  };
})();

// Show toast notification
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1055';
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toastElement = document.createElement('div');
  toastElement.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
  toastElement.setAttribute('role', 'alert');
  toastElement.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  toastContainer.appendChild(toastElement);

  // Show toast
  const toast = new bootstrap.Toast(toastElement);
  toast.show();

  // Remove toast element after it's hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Show toast notification (popup style)
function showAlert(message, type = 'info') {
  // Map alert types to Bootstrap toast styles
  const typeMapping = {
    'success': { bg: 'bg-success', icon: 'bi-check-circle-fill', text: 'text-white' },
    'danger': { bg: 'bg-danger', icon: 'bi-exclamation-triangle-fill', text: 'text-white' },
    'warning': { bg: 'bg-warning', icon: 'bi-exclamation-triangle-fill', text: 'text-dark' },
    'info': { bg: 'bg-info', icon: 'bi-info-circle-fill', text: 'text-white' }
  };
  
  const style = typeMapping[type] || typeMapping['info'];
  const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  // Create toast element
  const toastHtml = `
    <div class="toast align-items-center ${style.bg} ${style.text} border-0" role="alert" id="${toastId}" data-bs-autohide="true" data-bs-delay="4000">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center">
          <i class="bi ${style.icon} me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close ${style.text === 'text-white' ? 'btn-close-white' : ''} me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;
  
  // Get or create toast container
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1055';
    document.body.appendChild(toastContainer);
  }
  
  // Add toast to container
  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  
  // Initialize and show the toast
  const toastElement = document.getElementById(toastId);
  if (toastElement) {
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Clean up after toast is hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
      if (toastElement.parentNode) {
        toastElement.remove();
      }
    });
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

// Slugify text
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Remove multiple hyphens
}

// Export functions
window.AdminUtils = {
  showToast,
  showAlert,
  getTagColor,
  getStatusColor,
  slugify
};
