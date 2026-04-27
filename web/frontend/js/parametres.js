(function () {
  'use strict';

  const t = (key, fallback) => {
    try {
      return window.i18next ? window.i18next.t(key) : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const form = document.getElementById('passwordForm');
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const msg = document.getElementById('passwordMessage');

  function showMessage(text, type) {
    if (!msg) return;
    msg.className = `small ${type === 'error' ? 'text-danger' : 'text-success'}`;
    msg.textContent = text;
  }

  function clearMessage() {
    if (!msg) return;
    msg.textContent = '';
    msg.className = 'small';
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage();

    const ancienMotDePasse = currentPasswordInput.value.trim();
    const motDePasse = newPasswordInput.value.trim();
    const confirm = confirmPasswordInput.value.trim();

    if (!ancienMotDePasse || !motDePasse || !confirm) {
      showMessage(t('settings.fill_all_fields', 'Veuillez remplir tous les champs.'), 'error');
      return;
    }

    if (motDePasse.length < 8) {
      showMessage(t('settings.min_chars', 'Le nouveau mot de passe doit contenir au moins 8 caractères.'), 'error');
      return;
    }

    if (motDePasse !== confirm) {
      showMessage(t('settings.mismatch', 'La confirmation ne correspond pas au nouveau mot de passe.'), 'error');
      return;
    }

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ancienMotDePasse, motDePasse })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Erreur ${res.status}`);
      }

      showMessage(t('settings.update_success', 'Mot de passe mis à jour avec succès.'), 'success');
      form.reset();

    } catch (error) {
      console.error('Erreur mise à jour mot de passe:', error);
      showMessage(error.message || t('settings.update_error', 'Erreur lors de la mise à jour du mot de passe.'), 'error');
    }
  });
})();
