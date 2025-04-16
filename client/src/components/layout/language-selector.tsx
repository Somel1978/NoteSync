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

export function LanguageSelector() {
  const { t } = useTranslation();
  const { language, changeLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start px-4">
          <Globe className="h-5 w-5 mr-2" />
          {t('navigation.language')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" forceMount>
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => {
              changeLanguage(lang.code);
              setOpen(false);
            }}
          >
            <div className="flex items-center justify-between w-full">
              <span>{lang.name}</span>
              {language === lang.code && <Check className="h-4 w-4 ml-2" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}