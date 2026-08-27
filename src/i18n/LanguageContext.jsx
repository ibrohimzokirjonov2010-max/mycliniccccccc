import { createContext, useContext, useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import uz from './translations/uz.json';
import ru from './translations/ru.json';
import en from './translations/en.json';

const translations = { uz, ru, en };

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'uz';
  });

  // t() function depends on language so components always get correct translations
  const t = useCallback((key, params, fallback) => {
    const dict = translations[language] || translations['uz'];
    const keys = key.split('.');
    let value = dict;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    const defaultVal = typeof params === 'string' ? params : fallback;
    let result = value !== undefined ? value : (defaultVal !== undefined ? defaultVal : key);
    // SAFETY GUARD: if result is an object (not a primitive), return the key string
    // This prevents "Objects are not valid as React child" crashes when a translation
    // key points to a nested object instead of a leaf string.
    if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
      return defaultVal || key;
    }
    // String interpolation: t('key', { name: 'Ali' }) → "Salom {{name}}" → "Salom Ali"
    if (params && typeof params === 'object' && typeof result === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return result;
  }, [language]);

  // startTransition = til o'zgarishi LOW-PRIORITY deb belgilanadi
  // React UI ni bloklamay, fon rejimida re-render qiladi → FREEZE YO'Q
  const changeLanguage = useCallback((lang) => {
    if (!translations[lang]) return;
    localStorage.setItem('app_language', lang);
    document.documentElement.lang = lang;
    startTransition(() => {
      setLanguage(lang);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const availableLanguages = useMemo(() => [
    { code: 'uz', name: "O'zbek",  nativeName: "O'zbek",  flag: '🇺🇿' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  ], []);

  const value = useMemo(() => ({
    language,
    changeLanguage,
    t,
    availableLanguages,
  }), [language, changeLanguage, t, availableLanguages]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within a LanguageProvider');
  return ctx;
};

export default LanguageContext;
