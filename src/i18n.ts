import i18next from 'i18next';
import { useSyncExternalStore } from 'react';
import { zhCN } from './messages';

export type Language = 'en-US' | 'zh-CN';
export const LANGUAGE_KEY = 'rosetta.language';
export const normalizeLanguage = (value?: string | null): Language =>
  /^zh(?:-|$)/i.test(value || '') ? 'zh-CN' : 'en-US';
const english = Object.fromEntries(Object.keys(zhCN).map((key) => [key, key]));
Object.assign(english, {
  '{{count}} records_one': '{{count}} record',
  '{{count}} files_one': '{{count}} file',
});
const legacyEnglish = Object.fromEntries(
  Object.entries(zhCN).map(([en, zh]) => [zh, en]),
);
const legacyChinese = Object.fromEntries(
  Object.values(zhCN).map((zh) => [zh, zh]),
);
function savedLanguage(): Language {
  try {
    return normalizeLanguage(
      typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(LANGUAGE_KEY),
    );
  } catch {
    return 'en-US';
  }
}
if (!i18next.isInitialized) {
  void i18next.init({
    lng: savedLanguage(),
    fallbackLng: 'en-US',
    supportedLngs: ['en-US', 'zh-CN'],
    keySeparator: false,
    nsSeparator: false,
    initImmediate: false,
    interpolation: { escapeValue: false },
    resources: {},
  });
}
i18next.addResourceBundle(
  'en-US',
  'translation',
  { ...legacyEnglish, ...english },
  true,
  true,
);
i18next.addResourceBundle(
  'zh-CN',
  'translation',
  { ...legacyChinese, ...zhCN },
  true,
  true,
);
export const getLanguage = (): Language => normalizeLanguage(i18next.language);
export function t(
  key: string | string[],
  options?: Record<string, any> | string,
): string {
  const source = Array.isArray(key) ? key[0] : key;
  const fallback =
    getLanguage() === 'zh-CN'
      ? zhCN[source] || source
      : legacyEnglish[source] || source;
  const settings = typeof options === 'object' ? options : {};
  const value = i18next.t(source, { defaultValue: fallback, ...settings });
  return typeof value === 'string' && value.trim() ? value : fallback;
}
function updateDocument() {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = getLanguage();
    document.title = t('Standalone annotation tool');
  }
}
i18next.on('languageChanged', updateDocument);
updateDocument();
export async function setLanguage(language: Language) {
  await i18next.changeLanguage(normalizeLanguage(language));
  try {
    window.localStorage.setItem(LANGUAGE_KEY, getLanguage());
  } catch {
    /* Storage may be disabled. */
  }
}
const subscribe = (refresh: () => void) => {
  i18next.on('languageChanged', refresh);
  return () => {
    i18next.off('languageChanged', refresh);
  };
};
export const useLanguage = () =>
  useSyncExternalStore(subscribe, getLanguage, () => 'en-US' as Language);
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LANGUAGE_KEY)
      void i18next.changeLanguage(normalizeLanguage(event.newValue));
  });
}
