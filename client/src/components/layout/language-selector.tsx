import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useTranslation } from "react-i18next";
import { Check, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Flag icons - Unicode regional indicator symbols
const flagIcons = {
  en: "🇺🇸",
  es: "🇪🇸",
  pt: "🇵🇹"
};

export function LanguageSelector() {
  const { t } = useTranslation();
  const { language, changeLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);

  // Get current language name
  const currentLanguage = languages.find(lang => lang.code === language);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between px-4 text-white hover:bg-white/10 hover:text-white font-medium"
        >
          <div className="flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            <span>{currentLanguage?.name || t('navigation.selectLanguage', 'Select Language')}</span>
          </div>
          <span className="ml-2">{flagIcons[language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => {
              changeLanguage(lang.code);
              setOpen(false);
            }}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <span className="mr-2">{flagIcons[lang.code]}</span>
                <span>{lang.name}</span>
              </div>
              {language === lang.code && <Check className="h-4 w-4 ml-2" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}