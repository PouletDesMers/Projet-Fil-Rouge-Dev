import i18next from "https://cdn.jsdelivr.net/npm/i18next@23.16.8/+esm";

import frCommon from "../locales/fr/common.js";
import enCommon from "../locales/en/common.js";
import esCommon from "../locales/es/common.js";
import arCommon from "../locales/ams/common.js";
import zhCommon from "../locales/zh/common.js";

const savedLanguage = localStorage.getItem("language") || "fr";

await i18next.init({
  lng: savedLanguage,
  fallbackLng: "fr",
  debug: false,
  resources: {
    fr: {
      translation: frCommon,
    },
    en: {
      translation: enCommon,
    },
    es: {
      translation: esCommon,
    },
    ar: {
      translation: arCommon,
    },
    zh: {
      translation: zhCommon,
    },
  },
});

window.i18next = i18next;

export default i18next;