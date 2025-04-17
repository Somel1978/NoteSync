import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Clock,
  LayoutGrid,
  LogOut,
  PlusCircle,
  Settings,
  Store,
  CheckCircle,
  Menu,
  X,
  Globe,
  Home
} from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./language-selector";
import { useQuery } from "@tanstack/react-query";
import { AppearanceSettings } from "@shared/schema";

export function Sidebar() {
  const { t } = useTranslation();
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Fetch appearance settings
  const { data: appearanceSettings } = useQuery<AppearanceSettings>({
    queryKey: ['/api/settings/appearance'],
    refetchOnWindowFocus: false
  });

  const logoText = appearanceSettings?.logoText || "AC";
  const title = appearanceSettings?.title || "ACRDSC";
  const subtitle = appearanceSettings?.subtitle || "Reservas";

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/"); // Redirect to the landing page after logout
      }
    });
  };

  const isActive = (path: string) => {
    return location === path;
  };

  // Close sidebar when navigating on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location, isMobile]);

  if (!user) return null;

  const NavItem = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      navigate(href);
    };

    return (
      <li className="mb-2">
        <button
          onClick={handleClick}
          className={cn(
            "flex items-center text-gray-300 hover:bg-primary-hover px-4 py-3 rounded-md transition-colors w-full text-left",
            {
              "bg-primary-hover border-l-3 border-green-500 text-white": isActive(href),
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
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center">
          <div className="bg-white p-2 rounded-md w-12.5 h-12.5 flex items-center justify-center">
            <div className="text-2xl font-bold text-primary">{logoText}</div>
          </div>
          <div className="ml-3 text-white">
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-xs">{subtitle}</div>
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

      {/* Navigation Links - Role-based access */}
      <nav className="flex-1 mt-6">
        <ul className="px-2">
          {/* Dashboard - Only for Admin and Director */}
          {(user.role === 'admin' || user.role === 'director') && (
            <NavItem
              href="/dashboard"
              icon={<LayoutGrid className="h-5 w-5 mr-3" />}
              label={t('navigation.dashboard')}
            />
          )}
          
          {/* Appointments - Only for Admin and Director */}
          {(user.role === 'admin' || user.role === 'director') && (
            <NavItem
              href="/admin/appointments"
              icon={<CheckCircle className="h-5 w-5 mr-3" />}
              label={t('navigation.appointments')}
            />
          )}
          
          {/* Rooms - Only for Admin and Director */}
          {(user.role === 'admin' || user.role === 'director') && (
            <NavItem
              href="/admin/rooms"
              icon={<Store className="h-5 w-5 mr-3" />}
              label={t('navigation.rooms')}
            />
          )}
          
          {/* New Booking - For all users */}
          <NavItem
            href="/new-booking"
            icon={<PlusCircle className="h-5 w-5 mr-3" />}
            label={t('common.add')}
          />
          
          {/* Settings - For all users */}
          <NavItem
            href="/settings"
            icon={<Settings className="h-5 w-5 mr-3" />}
            label={t('navigation.settings')}
          />
        </ul>
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto border-t border-gray-700 p-4">
        <Button
          variant="ghost"
          className="text-gray-300 hover:bg-transparent w-full justify-start px-4 py-2 mb-2"
          onClick={() => navigate("/")}
        >
          <Home className="h-5 w-5 mr-3" />
          <span>{t('navigation.returnHome')}</span>
        </Button>
        
        <Button
          variant="ghost"
          className="text-gray-300 hover:bg-transparent w-full justify-start px-4 py-2"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span>{t('common.logout')}</span>
        </Button>
        
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
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-2 z-50 rounded-full bg-primary text-white shadow-lg h-8 w-8 p-1.5"
        >
          <Menu className="h-3.5 w-3.5" />
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
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside className="bg-primary w-64 h-full flex flex-col fixed left-0 top-0 z-40 hidden md:flex">
      {sidebarContent}
    </aside>
  );
}
