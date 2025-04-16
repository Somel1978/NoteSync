import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

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
  const { t } = useTranslation();
  const [language, setLanguage] = useState<Language>((i18n.language || 'en').split('-')[0] as Language);
  
  const languages = [
    { code: 'en' as Language, name: t('languages.english', 'English') },
    { code: 'es' as Language, name: t('languages.spanish', 'Spanish') },
    { code: 'pt' as Language, name: t('languages.portuguese', 'Portuguese') }
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