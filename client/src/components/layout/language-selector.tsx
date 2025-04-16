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
          variant="outline" 
          className="w-full justify-start px-4 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary font-medium"
        >
          <Globe className="h-5 w-5 mr-2" />
          <span>{t('navigation.language')}</span>
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