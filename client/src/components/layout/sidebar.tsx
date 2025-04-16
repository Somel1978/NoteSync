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
} from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./language-selector";

export function Sidebar() {
  const { t } = useTranslation();
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleLogout = () => {
    logoutMutation.mutate();
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
          <div className="bg-white p-2 rounded-md w-10 h-10 flex items-center justify-center">
            <div className="text-xl font-bold text-primary">AC</div>
          </div>
          <div className="ml-3 text-white">
            <div className="font-semibold text-sm">ACRDSC</div>
            <div className="text-xs">Reservas</div>
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
          <NavItem
            href="/"
            icon={<LayoutGrid className="h-5 w-5 mr-3" />}
            label={t('navigation.dashboard')}
          />
          <NavItem
            href="/appointments"
            icon={<CheckCircle className="h-5 w-5 mr-3" />}
            label={t('navigation.appointments')}
          />
          <NavItem
            href="/rooms"
            icon={<Store className="h-5 w-5 mr-3" />}
            label={t('navigation.rooms')}
          />
          <NavItem
            href="/new-booking"
            icon={<PlusCircle className="h-5 w-5 mr-3" />}
            label={t('common.add')}
          />
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
          className="text-gray-300 hover:text-white w-full justify-start px-4 py-2"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span>Logout</span>
        </Button>
        <div className="flex items-center mt-4 px-4">
          <Globe className="h-5 w-5 text-gray-400" />
          <span className="ml-2 text-sm text-gray-400">English</span>
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
