import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
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
  Globe,
} from "lucide-react";

export function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActive = (path: string) => {
    return location === path;
  };

  if (!user) return null;

  return (
    <aside className="bg-primary w-64 h-full flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 flex items-center justify-center border-b border-gray-700">
        <div className="bg-white p-2 rounded-md w-16 h-16 flex items-center justify-center">
          <div className="text-2xl font-bold text-primary">AC</div>
        </div>
        <div className="ml-3 text-white">
          <div className="font-semibold">ACRDSC</div>
          <div className="text-xs">Reservas</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 mt-6">
        <ul className="px-2">
          <li className="mb-2">
            <Link href="/">
              <a
                className={cn(
                  "flex items-center text-gray-300 hover:bg-primary-hover px-4 py-3 rounded-md transition-colors",
                  {
                    "bg-primary-hover border-l-3 border-green-500 text-white":
                      isActive("/"),
                  }
                )}
              >
                <LayoutGrid className="h-5 w-5 mr-3" />
                <span>Dashboard</span>
              </a>
            </Link>
          </li>
          <li className="mb-2">
            <Link href="/appointments">
              <a
                className={cn(
                  "flex items-center text-gray-300 hover:bg-primary-hover px-4 py-3 rounded-md transition-colors",
                  {
                    "bg-primary-hover border-l-3 border-green-500 text-white":
                      isActive("/appointments"),
                  }
                )}
              >
                <CheckCircle className="h-5 w-5 mr-3" />
                <span>Appointments</span>
              </a>
            </Link>
          </li>
          <li className="mb-2">
            <Link href="/rooms">
              <a
                className={cn(
                  "flex items-center text-gray-300 hover:bg-primary-hover px-4 py-3 rounded-md transition-colors",
                  {
                    "bg-primary-hover border-l-3 border-green-500 text-white":
                      isActive("/rooms"),
                  }
                )}
              >
                <Store className="h-5 w-5 mr-3" />
                <span>Available Rooms</span>
              </a>
            </Link>
          </li>
          <li className="mb-2">
            <Link href="/new-booking">
              <a
                className={cn(
                  "flex items-center text-gray-300 hover:bg-primary-hover px-4 py-3 rounded-md transition-colors",
                  {
                    "bg-primary-hover border-l-3 border-green-500 text-white":
                      isActive("/new-booking"),
                  }
                )}
              >
                <PlusCircle className="h-5 w-5 mr-3" />
                <span>New Booking</span>
              </a>
            </Link>
          </li>
          <li className="mb-2">
            <Link href="/settings">
              <a
                className={cn(
                  "flex items-center text-gray-300 hover:bg-primary-hover px-4 py-3 rounded-md transition-colors",
                  {
                    "bg-primary-hover border-l-3 border-green-500 text-white":
                      isActive("/settings"),
                  }
                )}
              >
                <Settings className="h-5 w-5 mr-3" />
                <span>Settings</span>
              </a>
            </Link>
          </li>
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
    </aside>
  );
}
