import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import AppointmentsPage from "@/pages/appointments-page";
import RoomListPage from "@/pages/room-list-page";
import NewBookingPage from "@/pages/tabbed-booking-page";
import SettingsPage from "@/pages/settings-page";
import LandingPage from "@/pages/landing-page";
import PublicRoomPage from "@/pages/public-room-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { LanguageProvider } from "./hooks/use-language";
import { useEffect } from "react";

function Router() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect users based on their role when they log in
  useEffect(() => {
    if (user) {
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
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/admin/appointments" component={AppointmentsPage} />
      <ProtectedRoute path="/admin/rooms" component={RoomListPage} />
      <ProtectedRoute path="/new-booking" component={NewBookingPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
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
