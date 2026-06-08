/**
 * Contact Form Handler
 * Gère la soumission du formulaire de contact
 */

document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contactForm');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');

  if (!contactForm) return;

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset messages
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';

    // Collect form data
    const formData = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      subject: document.getElementById('subject').value,
      message: document.getElementById('message').value.trim(),
    };

    // Validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      showError(window.i18next?.t('contact.form_submit_error') || 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showError(window.i18next?.t('contact.form_invalid_email') || 'Veuillez entrer une adresse email valide.');
      return;
    }

    try {
      // Send to API
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Success
        contactForm.reset();
        showSuccess();
        
        // Scroll to success message
        setTimeout(() => {
          successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        const errorData = await response.json();
        showError(
          errorData.message || 
          window.i18next?.t('contact.form_submit_error') || 
          'Une erreur est survenue lors de l\'envoi du message.'
        );
      }
    } catch (error) {
      console.error('Contact form error:', error);
      showError(
        window.i18next?.t('contact.form_submit_error') || 
        'Une erreur est survenue lors de l\'envoi du message.'
      );
    }
  });

  function showSuccess() {
    successMessage.style.display = 'block';
    successMessage.setAttribute('role', 'alert');
    successMessage.setAttribute('aria-live', 'polite');
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.setAttribute('role', 'alert');
    errorMessage.setAttribute('aria-live', 'assertive');
    
    // Auto-hide error after 5 seconds
    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 5000);
  }
});
