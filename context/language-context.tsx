import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import { LANGUAGES, SupportedLocale, translate } from '@/services/i18n';

const STORAGE_KEY = 'cyna_language';
const SUPPORTED: SupportedLocale[] = ['fr', 'en', 'es', 'zh', 'ar'];

interface LanguageContextValue {
  locale: SupportedLocale;
  setLocale: (l: SupportedLocale) => Promise<void>;
  t: (key: string, opts?: Record<string, unknown>) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale:    'fr',
  setLocale: async () => {},
  t:         (k) => k,
  isRTL:     false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('fr');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && SUPPORTED.includes(saved as SupportedLocale)) {
          applyRTL(saved as SupportedLocale);
          setLocaleState(saved as SupportedLocale);
        } else {
          try {
            const locales = Localization.getLocales();
            const code = locales?.[0]?.languageCode ?? 'fr';
            const matched = SUPPORTED.find((l) => code.startsWith(l)) ?? 'fr';
            applyRTL(matched);
            setLocaleState(matched);
          } catch {
            // expo-localization unavailable — stay on French
          }
        }
      })
      .catch(() => {
        // AsyncStorage unavailable — stay on French
      });
  }, []);

  const setLocale = useCallback(async (newLocale: SupportedLocale) => {
    applyRTL(newLocale);
    setLocaleState(newLocale);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // persist failure is non-fatal
    }
  }, []);

  const t = useCallback(
    (key: string, opts?: Record<string, unknown>) => translate(locale, key, opts),
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isRTL: locale === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => useContext(LanguageContext);

function applyRTL(locale: SupportedLocale) {
  const isRTL = locale === 'ar';
  if (isRTL && !I18nManager.isRTL) {
    I18nManager.forceRTL(true);
  } else if (!isRTL && I18nManager.isRTL) {
    I18nManager.forceRTL(false);
  }
}

export { LANGUAGES };
export type { SupportedLocale };
