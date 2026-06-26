import fr from '@/locales/fr.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import zh from '@/locales/zh.json';
import ar from '@/locales/ar.json';

export type SupportedLocale = 'fr' | 'en' | 'es' | 'zh' | 'ar';

export const LANGUAGES: { code: SupportedLocale; name: string; flag: string; rtl: boolean }[] = [
  { code: 'fr', name: 'Français',  flag: '🇫🇷', rtl: false },
  { code: 'en', name: 'English',   flag: '🇬🇧', rtl: false },
  { code: 'es', name: 'Español',   flag: '🇪🇸', rtl: false },
  { code: 'zh', name: '中文',       flag: '🇨🇳', rtl: false },
  { code: 'ar', name: 'العربية',   flag: '🇸🇦', rtl: true  },
];

const TRANSLATIONS: Record<SupportedLocale, Record<string, unknown>> = { fr, en, es, zh, ar };

function nested(obj: Record<string, unknown>, key: string): string | null {
  const parts = key.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : null;
}

export function translate(locale: SupportedLocale, key: string, opts?: Record<string, unknown>): string {
  let result = nested(TRANSLATIONS[locale], key) ?? nested(TRANSLATIONS.fr, key) ?? key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      result = result.replace(new RegExp('%\\{' + k + '\\}', 'g'), String(v ?? ''));
    }
  }
  return result;
}
