/**
 * Authentication Module
 * Handles user authentication and authorization
 */

// Auth token is now in httpOnly cookies - no need to access it directly
function getAuthToken() {
  // Pour compatibilité avec l'ancien code, mais maintenant les cookies sont gérés automatiquement
  return null; // Le token est dans un cookie httpOnly, inaccessible au JavaScript
}

// Redirect to login if not authenticated
function checkAuth() {
  // La vérification est maintenant faite côté serveur via les middlewares
  // Si on arrive ici, c'est que l'authentification a réussi
  return true;
}

// Check if user is admin
async function checkAdminStatus() {
  try {
    // Utilisation de /auth/profile qui gère automatiquement les cookies
    const response = await fetch('/auth/profile');

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
  // Appel à l'endpoint de déconnexion sécurisé pour effacer le cookie httpOnly
  fetch('/auth/logout', { method: 'POST' })
    .then(() => {
      window.location.href = '/auth.html';
    })
    .catch(() => {
      // En cas d'erreur, redirection quand même
      window.location.href = '/auth.html';
    });
}

// Export functions
window.AdminAuth = {
  getAuthToken,
  checkAuth,
  checkAdminStatus,
  handleLogout
};