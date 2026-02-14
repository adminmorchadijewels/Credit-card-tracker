import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

export const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="ml-[240px] flex-1 transition-all duration-300">
        <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
