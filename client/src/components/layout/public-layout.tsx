import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { 
  Clock, 
  LayoutGrid, 
  LogIn, 
  Menu, 
  X, 
  Home 
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSelector } from "./language-selector";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { AppearanceSettings } from "@shared/schema";

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Fetch appearance settings
  const { data: appearanceSettings } = useQuery<AppearanceSettings>({
    queryKey: ['/api/settings/appearance'],
    refetchOnWindowFocus: false
  });

  const logoText = appearanceSettings?.logoText || "AC";
  const logoUrl = appearanceSettings?.logoUrl || null;
  const useLogoImage = appearanceSettings?.useLogoImage || false;
  const title = appearanceSettings?.title || "ACRDSC";
  const subtitle = appearanceSettings?.subtitle || "Reservas";

  // Close sidebar when navigating on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location, isMobile]);

  const navigationItems = [
    {
      title: t("navigation.appointments"),
      href: "/",
      icon: <Clock className="h-5 w-5 mr-3" />,
      active: location === "/"
    },
    {
      title: t("navigation.rooms"),
      href: "/rooms",
      icon: <LayoutGrid className="h-5 w-5 mr-3" />,
      active: location === "/rooms"
    }
  ];

  const NavItem = ({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      navigate(href);
    };

    return (
      <li className="mb-2">
        <button
          onClick={handleClick}
          className={cn(
            "flex items-center text-gray-300 hover:text-gray-300 px-4 py-3 rounded-md transition-colors w-full text-left",
            {
              "bg-primary-hover border-l-3 border-green-500 text-white": active,
            }
          )}
        >
          {icon}
          <span>{label}</span>
        </button>
      </li>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo and Title */}
      <div className="p-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center">
          <div className="bg-white p-2 rounded-md w-12.5 h-12.5 flex items-center justify-center overflow-hidden">
            {useLogoImage && logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="object-contain w-full h-full"
              />
            ) : (
              <div className="text-2xl font-bold text-primary">{logoText}</div>
            )}
          </div>
          <div className="ml-3 text-white">
            <div className="font-semibold text-base">{title}</div>
            <div className="text-sm">{subtitle}</div>
          </div>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 mt-4">
        <ul className="px-2">
          {navigationItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.title}
              active={item.active}
            />
          ))}
        </ul>
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto border-t border-gray-700 p-4">
        {user ? (
          <Button
            variant="ghost"
            className="text-gray-300 hover:text-gray-300 hover:bg-transparent w-full justify-start px-4 py-2"
            onClick={() => navigate("/dashboard")}
          >
            <LayoutGrid className="h-5 w-5 mr-3" />
            <span>{t("dashboard.title")}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="text-gray-300 hover:text-gray-300 hover:bg-transparent w-full justify-start px-4 py-2"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="h-5 w-5 mr-3" />
            <span>{t("auth.login")}</span>
          </Button>
        )}
        
        <div className="mt-4">
          {/* Language Selector with enhanced visibility */}
          <div className="rounded-md p-2 mb-2">
            <div className="text-xs text-white/70 mb-1 font-medium px-2">{t('navigation.selectLanguage', 'Select Language')}</div>
            <LanguageSelector />
          </div>
        </div>
      </div>
    </>
  );

  // Mobile menu toggle
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="fixed top-8 left-3 z-50 rounded-full bg-primary text-white shadow-lg h-10 w-10 p-2"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* Mobile sidebar */}
        <aside
          className={cn(
            "bg-primary w-64 h-full flex flex-col fixed left-0 top-0 z-50 transform transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </aside>
        
        {/* Backdrop */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <main className="flex-1 w-full p-6 md:pl-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Desktop sidebar */}
      <aside className="bg-primary w-64 h-screen flex flex-col fixed left-0 top-0 z-40">
        {sidebarContent}
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 ml-64 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}