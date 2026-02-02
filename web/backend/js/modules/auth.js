/**
 * Authentication Module
 * Handles user authentication and authorization
 */

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

// Handle logout
function handleLogout() {
  localStorage.removeItem('authToken');
  window.location.href = '/auth.html';
}

// Export functions
window.AdminAuth = {
  getAuthToken,
  checkAuth,
  checkAdminStatus,
  handleLogout
};