(function () {
  const STORAGE_KEY = 'cyna_cookie_consent';
  const VALUE_ACCEPTED = 'accepted';
  const VALUE_REFUSED = 'refused';
  const VALUE_CUSTOM = 'custom';
  const BANNER_ID = 'cyna-cookie-banner';
  const LAUNCHER_ID = 'cyna-cookie-launcher';
  const PREFERENCES_ID = 'cyna-cookie-preferences';

  const DEFAULT_PREFERENCES = {
    necessary: true,
    statistics: false,
    marketing: false,
  };

  function getConsent() {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);
      if (!rawValue) return null;

      if (rawValue === VALUE_ACCEPTED || rawValue === VALUE_REFUSED) {
        return {
          status: rawValue,
          preferences: {
            ...DEFAULT_PREFERENCES,
            statistics: rawValue === VALUE_ACCEPTED,
            marketing: rawValue === VALUE_ACCEPTED,
          },
        };
      }

      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== 'object') return null;

      return {
        status: parsed.status || VALUE_CUSTOM,
        preferences: {
          ...DEFAULT_PREFERENCES,
          ...(parsed.preferences || {}),
        },
      };
    } catch (_) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
      openPreferences();
    });

    document.body.appendChild(launcher);
  }

  function hideLauncher() {
    const existing = document.getElementById(LAUNCHER_ID);
    if (existing) existing.remove();
  }

  function hidePreferences() {
    const existing = document.getElementById(PREFERENCES_ID);
    if (existing) existing.remove();
    document.body.classList.remove('cyna-cookie-preferences-open');
  }

  function openPreferences(consent = getConsent()) {
    hideBanner();
    hideLauncher();
    hidePreferences();

    const preferences = consent?.preferences || DEFAULT_PREFERENCES;

    const overlay = document.createElement('div');
    overlay.id = PREFERENCES_ID;
    overlay.className = 'cyna-cookie-preferences';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Préférences cookies');

    overlay.innerHTML = `
      <div class="cyna-cookie-preferences__panel">
        <div class="cyna-cookie-preferences__header">
          <div>
            <h3>Préférences cookies</h3>
            <p>Choisissez les cookies que vous autorisez. Les cookies nécessaires restent toujours actifs.</p>
          </div>
          <button type="button" class="cyna-cookie-preferences__close" data-cookie-action="close" aria-label="Fermer">&times;</button>
        </div>

        <div class="cyna-cookie-preferences__group">
          <div class="cyna-cookie-preferences__row is-disabled">
            <div>
              <strong>Cookies nécessaires</strong>
              <p>Indispensables au fonctionnement du site, à l'authentification et à la sécurité.</p>
            </div>
            <span class="badge bg-success">Toujours actifs</span>
          </div>

          <label class="cyna-cookie-preferences__row" for="cookie-statistics">
            <div>
              <strong>Cookies statistiques</strong>
              <p>Mesure de fréquentation et amélioration des pages.</p>
            </div>
            <input id="cookie-statistics" type="checkbox" ${preferences.statistics ? 'checked' : ''} />
          </label>

          <label class="cyna-cookie-preferences__row" for="cookie-marketing">
            <div>
              <strong>Cookies marketing</strong>
              <p>Personnalisation des contenus et suivi des campagnes.</p>
            </div>
            <input id="cookie-marketing" type="checkbox" ${preferences.marketing ? 'checked' : ''} />
          </label>
        </div>

        <div class="cyna-cookie-preferences__actions">
          <button type="button" class="btn btn-outline-light btn-sm" data-cookie-action="refuse-all">Tout refuser</button>
          <button type="button" class="btn btn-light btn-sm" data-cookie-action="save">Enregistrer</button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        openLauncherAfterClose();
        return;
      }

      const button = event.target.closest('[data-cookie-action]');
      if (!button) return;

      const action = button.getAttribute('data-cookie-action');
      if (action === 'close') {
        hidePreferences();
        showLauncher();
      }

      if (action === 'refuse-all') {
        refuseCookies();
        showLauncher();
      }

      if (action === 'save') {
        const nextConsent = {
          status: VALUE_CUSTOM,
          preferences: {
            ...DEFAULT_PREFERENCES,
            statistics: overlay.querySelector('#cookie-statistics')?.checked === true,
            marketing: overlay.querySelector('#cookie-marketing')?.checked === true,
          },
        };
        setConsent(nextConsent);
        hidePreferences();
        showLauncher();
      }
    });

    document.body.appendChild(overlay);
    document.body.classList.add('cyna-cookie-preferences-open');
  }

  function openLauncherAfterClose() {
    hidePreferences();
    showLauncher();
  }

  function acceptCookies() {
    setConsent({
      status: VALUE_ACCEPTED,
      preferences: {
        ...DEFAULT_PREFERENCES,
        statistics: true,
        marketing: true,
      },
    });
    hideBanner();
    hidePreferences();
    showLauncher();
  }

  function refuseCookies() {
    setConsent({
      status: VALUE_REFUSED,
      preferences: { ...DEFAULT_PREFERENCES },
    });
    hideBanner();
    hidePreferences();
    showLauncher();
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
          <button type="button" class="btn btn-outline-light btn-sm" data-cookie-action="customize">Personnaliser</button>
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
      if (action === 'customize') openPreferences();
    });

    document.body.appendChild(banner);
    document.body.classList.add('cyna-cookie-banner-open');
  }

  function init() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }

    const consent = getConsent();
    if (consent?.status === VALUE_ACCEPTED || consent?.status === VALUE_REFUSED || consent?.status === VALUE_CUSTOM) {
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
    openPreferences,
    open: buildBanner,
    reset: function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      hideLauncher();
      hidePreferences();
      buildBanner();
    },
    getConsent,
  };
})();
