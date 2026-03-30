const loadingState = document.getElementById('loadingState');
const successState = document.getElementById('successState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const msg = document.getElementById('msg');

async function verifyEmail() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      throw new Error('No verification token provided');
    }

    const response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Email verification failed');
    }

    loadingState.classList.add('d-none');
    successState.classList.remove('d-none');
  } catch (error) {
    console.error('Verification error:', error);
    loadingState.classList.add('d-none');
    errorState.classList.remove('d-none');
    errorMessage.textContent = error.message;
  }
}

// Auto-verify on page load
verifyEmail();
