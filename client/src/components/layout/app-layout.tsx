import { Sidebar } from "@/components/layout/sidebar";
import { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="bg-gray-100 font-sans flex h-screen overflow-hidden">
      <Sidebar />
      <main className="ml-64 flex-1 overflow-y-auto bg-gray-100">
        {children}
      </main>
    </div>
  );
}
