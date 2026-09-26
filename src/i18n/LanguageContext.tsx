import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { Language, TRANSLATIONS, TranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isTamil: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'vigilshield_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ta' || saved === 'en') return saved;
    } catch {}
    // Default to English as requested
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
      let text: string = dict[key] || TRANSLATIONS.en[key];
      if (!text) {
        // Fallback: convert snake_case_key to human-readable capitalized text
        const words = String(key).split('_').map((w, idx) => idx === 0 ? (w.charAt(0).toUpperCase() + w.slice(1)) : w);
        text = words.join(' ');
      }

      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        });
      }

      return text;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
      isTamil: language === 'ta',
    }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    const fallbackT = (key: TranslationKey, params?: Record<string, string | number>) => {
      let text: string = TRANSLATIONS.en[key] || key;
      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        });
      }
      return text;
    };
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: fallbackT,
      isTamil: false,
    };
  }
  return context;
}
