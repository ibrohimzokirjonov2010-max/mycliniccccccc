import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { persistSet, secureGet } from '@/api/sessionStore';
import { dictionaries, type Dict, type Lang } from '@/i18n/strings';

export type { Lang };

const KEY = 'myclinic.lang';

type I18nValue = {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLang(value: string | null): value is Lang {
  return value === 'uz' || value === 'ru' || value === 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('uz');

  useEffect(() => {
    secureGet(KEY).then((stored) => {
      if (isLang(stored)) setLangState(stored);
    }).catch(() => undefined);
  }, []);

  const value = useMemo<I18nValue>(() => ({
    lang,
    t: dictionaries[lang],
    setLang: (next) => {
      setLangState(next);
      persistSet(KEY, next).catch(() => undefined);
    },
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside provider');
  return value;
}

export function errorText(code: string, t: Dict): string {
  const known = t.errors[code as keyof Dict['errors']];
  return known || t.errors.generic;
}
