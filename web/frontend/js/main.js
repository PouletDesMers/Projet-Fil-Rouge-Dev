import i18next from "./i18n.js";

function applyTranslations() {
  document.documentElement.lang = i18next.language;
  document.documentElement.dir = i18next.language === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const translation = i18next.t(key);
    element.textContent = translation;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    element.setAttribute("placeholder", i18next.t(key));
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const key = element.getAttribute("data-i18n-aria-label");
    element.setAttribute("aria-label", i18next.t(key));
  });

  updateLanguageMenuState(i18next.language);
}

function setupLanguageSwitcher() {
  const switcher = document.getElementById("languageSwitcher");

  if (!switcher) return;

  switcher.value = i18next.language;

  switcher.addEventListener("change", async (event) => {
    const newLanguage = event.target.value;

    await i18next.changeLanguage(newLanguage);
    localStorage.setItem("language", newLanguage);

    applyTranslations();

    document.dispatchEvent(
      new CustomEvent("languageChanged", {
        detail: { language: newLanguage },
      })
    );
  });
}

async function setAppLanguage(newLanguage) {
  await i18next.changeLanguage(newLanguage);
  localStorage.setItem("language", newLanguage);
  applyTranslations();

  document.dispatchEvent(
    new CustomEvent("languageChanged", {
      detail: { language: newLanguage },
    })
  );
}

function updateLanguageMenuState(language) {
  const languageMap = {
    fr: { flag: "🇫🇷", code: "FR" },
    en: { flag: "🇬🇧", code: "EN" },
    es: { flag: "🇪🇸", code: "ES" },
    ar: { flag: "🇸🇦", code: "AR" },
    zh: { flag: "🇨🇳", code: "ZH" },
  };

  const current = languageMap[language] || languageMap.fr;
  const flag = document.getElementById("currentLangFlag");
  const code = document.getElementById("currentLangCode");

  if (flag) flag.textContent = current.flag;
  if (code) code.textContent = current.code;

  document.querySelectorAll(".language-option").forEach((button) => {
    const isActive = button.getAttribute("data-language") === language;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  setupLanguageSwitcher();
});

document.addEventListener("languageChanged", applyTranslations);
document.addEventListener("navbarLoaded", applyTranslations);
document.addEventListener("app:set-language", (event) => {
  const newLanguage = event.detail?.language;
  if (newLanguage) {
    setAppLanguage(newLanguage);
  }
});

window.setAppLanguage = setAppLanguage;

export { applyTranslations };