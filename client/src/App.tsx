import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import AppointmentsPage from "@/pages/appointments-page";
import RoomListPage from "@/pages/room-list-page";
import NewBookingPage from "@/pages/enhanced-tabbed-booking-page";
import SettingsPage from "@/pages/settings-page";
import LandingPage from "@/pages/landing-page";
import PublicRoomPage from "@/pages/public-room-page";
import RoomAvailabilityPage from "@/pages/room-availability-page";
import { ProtectedRoute } from "./lib/protected-route";
import { RoleRestrictedRoute } from "./lib/role-restricted-route";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { LanguageProvider } from "./hooks/use-language";
import { useEffect } from "react";

function Router() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect users based on their role when they log in, but only if they're on the auth page
  useEffect(() => {
    const currentPath = window.location.pathname;
    // Only redirect if user is on auth page or root page
    if (user && (currentPath === '/auth' || currentPath === '/')) {
      if (user.role === 'guest') {
        setLocation("/new-booking");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, setLocation]);
  
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/rooms" component={PublicRoomPage} />
      <Route path="/rooms/availability" component={RoomAvailabilityPage} />
      <Route path="/rooms/availability/:id" component={RoomAvailabilityPage} />
      <Route path="/auth" component={AuthPage} />
      <RoleRestrictedRoute path="/dashboard" component={DashboardPage} requiredRole="adminOrDirector" />
      <RoleRestrictedRoute path="/admin/appointments" component={AppointmentsPage} requiredRole="adminOrDirector" />
      <RoleRestrictedRoute path="/admin/appointments/details/:id" component={AppointmentsPage} requiredRole="adminOrDirector" />
      <RoleRestrictedRoute path="/admin/rooms" component={RoomListPage} requiredRole="adminOrDirector" />
      <ProtectedRoute path="/new-booking" component={NewBookingPage} />
      <RoleRestrictedRoute path="/settings" component={SettingsPage} requiredRole="admin" />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <Router />
          <Toaster />
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
