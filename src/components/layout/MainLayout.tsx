import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { useBackup } from "@/hooks/useBackup";

export const MainLayout = ({ children }: { children: ReactNode }) => {
  useBackup();
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="md:ml-[240px] flex-1 transition-all duration-300 pt-14 md:pt-0">
        <div className="mx-auto max-w-[1400px] p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
