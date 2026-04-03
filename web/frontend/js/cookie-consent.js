(function () {
  const STORAGE_KEY = 'cyna_cookie_consent';
  const VALUE_ACCEPTED = 'accepted';
  const VALUE_REFUSED = 'refused';
  const BANNER_ID = 'cyna-cookie-banner';
  const LAUNCHER_ID = 'cyna-cookie-launcher';

  function getConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {}
  }

  function hideBanner() {
    const existing = document.getElementById(BANNER_ID);
    if (existing) existing.remove();
    document.body.classList.remove('cyna-cookie-banner-open');
  }

  function showLauncher() {
    if (document.getElementById(LAUNCHER_ID)) return;

    const launcher = document.createElement('button');
    launcher.id = LAUNCHER_ID;
    launcher.type = 'button';
    launcher.className = 'cyna-cookie-launcher btn btn-sm';
    launcher.setAttribute('aria-label', 'Ouvrir les préférences cookies');
    launcher.innerHTML = '<i class="bi bi-shield-lock me-1"></i>Cookies';
    launcher.addEventListener('click', () => {
      buildBanner();
      launcher.remove();
    });

    document.body.appendChild(launcher);
  }

  function hideLauncher() {
    const existing = document.getElementById(LAUNCHER_ID);
    if (existing) existing.remove();
  }

  function acceptCookies() {
    setConsent(VALUE_ACCEPTED);
    hideBanner();
  }

  function refuseCookies() {
    setConsent(VALUE_REFUSED);
    hideBanner();
  }

  function buildBanner() {
    if (document.getElementById(BANNER_ID)) return;

    hideLauncher();

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'cyna-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Consentement aux cookies');

    banner.innerHTML = `
      <div class="cyna-cookie-banner__content">
        <div class="cyna-cookie-banner__text">
          <strong>Nous respectons votre vie privée.</strong>
          <p>
            CYNA utilise des cookies nécessaires au fonctionnement du site et peut,
            selon vos choix, activer des cookies optionnels pour améliorer l'expérience
            et mesurer l'audience. Vous pouvez accepter ou refuser ces cookies à tout moment.
          </p>
          <div class="cyna-cookie-banner__links">
            <a href="/legal.html">Mentions légales</a>
            <a href="/cgu.html">CGU</a>
            <a href="/contact.html" aria-label="Contacter CYNA au sujet des cookies">Nous contacter</a>
          </div>
        </div>
        <div class="cyna-cookie-banner__actions">
          <button type="button" class="btn btn-outline-light btn-sm" data-cookie-action="refuse">Refuser</button>
          <button type="button" class="btn btn-light btn-sm" data-cookie-action="accept">Accepter tout</button>
        </div>
      </div>
    `;

    banner.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cookie-action]');
      if (!button) return;

      const action = button.getAttribute('data-cookie-action');
      if (action === 'accept') acceptCookies();
      if (action === 'refuse') refuseCookies();
    });

    document.body.appendChild(banner);
    document.body.classList.add('cyna-cookie-banner-open');
  }

  function init() {
    const consent = getConsent();
    if (consent === VALUE_ACCEPTED || consent === VALUE_REFUSED) {
      hideBanner();
      showLauncher();
      return;
    }
    buildBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CynaCookieConsent = {
    accept: acceptCookies,
    refuse: refuseCookies,
    open: buildBanner,
    reset: function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      hideLauncher();
      buildBanner();
    },
    getConsent,
  };
})();
