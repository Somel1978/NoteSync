import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route } from "wouter";
import { AccessRestricted, AccessRestrictedType } from "@/components/access-restricted";

type UserRole = "admin" | "director" | "guest";
type AccessLevel = "admin" | "adminOrDirector" | "any";

interface RoleRestrictedRouteProps {
  path: string;
  component: () => React.JSX.Element;
  requiredRole: AccessLevel;
}

export function RoleRestrictedRoute({
  path,
  component: Component,
  requiredRole,
}: RoleRestrictedRouteProps) {
  const { user, isLoading } = useAuth();

  // Show spinner while loading
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // User is not logged in
  if (!user) {
    return (
      <Route path={path}>
        <AccessRestricted type="login" />
      </Route>
    );
  }

  // Check permissions based on role
  const hasPermission = () => {
    switch (requiredRole) {
      case "admin":
        return user.role === "admin";
      case "adminOrDirector":
        return user.role === "admin" || user.role === "director";
      case "any":
        return true;
      default:
        return false;
    }
  };

  // User doesn't have required role
  if (!hasPermission()) {
    return (
      <Route path={path}>
        <AccessRestricted 
          type={requiredRole === "admin" ? "admin" : "adminOrDirector"} 
        />
      </Route>
    );
  }

  // User has permission, render component
  return <Route path={path} component={Component} />;
}