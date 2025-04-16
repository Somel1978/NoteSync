import { Sidebar } from "@/components/layout/sidebar";
import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="bg-gray-100 font-sans flex h-screen overflow-hidden">
      <Sidebar />
      <main className={`flex-1 overflow-y-auto bg-gray-100 ${isMobile ? 'ml-0 pl-10' : 'ml-0 md:ml-64'}`}>
        {children}
      </main>
    </div>
  );
}
