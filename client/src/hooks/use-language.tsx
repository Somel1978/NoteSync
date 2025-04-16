import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'en' | 'es' | 'pt';

interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  languages: {
    code: Language;
    name: string;
  }[];
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const [language, setLanguage] = useState<Language>((i18n.language || 'en').split('-')[0] as Language);

  const languages = [
    { code: 'en' as Language, name: t('settings.english') },
    { code: 'es' as Language, name: t('settings.spanish') },
    { code: 'pt' as Language, name: t('settings.portuguese') }
  ];

  const changeLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  useEffect(() => {
    // Update language when i18n.language changes
    setLanguage((i18n.language || 'en').split('-')[0] as Language);
  }, [i18n.language]);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}