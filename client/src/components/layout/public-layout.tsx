import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Clock, LayoutGrid, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSelector } from "./language-selector";
import { cn } from "@/lib/utils";

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [location] = useLocation();

  const navigationItems = [
    {
      title: t("navigation.appointments"),
      href: "/",
      icon: Clock,
      active: location === "/"
    },
    {
      title: t("navigation.rooms"),
      href: "/rooms",
      icon: LayoutGrid,
      active: location === "/rooms"
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-black text-white flex flex-col">
        {/* Logo and Title */}
        <div className="p-4 flex flex-col items-center space-y-2">
          <div className="w-24 h-24 rounded-md bg-white flex items-center justify-center overflow-hidden">
            <img 
              src="/logo.svg" 
              alt="ACRDSC Logo" 
              className="w-20 h-20 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://placehold.co/80x80?text=ACRDSC";
              }}
            />
          </div>
          <h1 className="text-xl font-bold">ACRDSC Reservas</h1>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 mt-6">
          <ul className="space-y-1">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>
                  <a className={cn(
                    "flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors",
                    item.active && "bg-gray-800 text-white"
                  )}>
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.title}
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-800">
          {user ? (
            <Link href="/dashboard">
              <a className="flex items-center text-gray-300 hover:text-white transition-colors">
                <LayoutGrid className="mr-2 h-5 w-5" />
                {t("dashboard.title")}
              </a>
            </Link>
          ) : (
            <Link href="/auth">
              <a className="flex items-center text-gray-300 hover:text-white transition-colors">
                <LogIn className="mr-2 h-5 w-5" />
                {t("auth.login")}
              </a>
            </Link>
          )}
          
          <div className="mt-4">
            <LanguageSelector />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}