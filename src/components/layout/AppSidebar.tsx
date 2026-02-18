import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CreditCard, Receipt, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Basic Details", path: "/basic-details", icon: CreditCard },
  { title: "Payment Details", path: "/payment-details", icon: Receipt },
];

export const AppSidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-sidebar px-4 md:hidden">
        <span className="text-lg font-semibold text-sidebar-primary-foreground tracking-tight">
          💳 CardTrack
        </span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 w-[240px]",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center px-4">
          <span className="text-lg font-semibold text-sidebar-primary-foreground tracking-tight">
            💳 CardTrack
          </span>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon size={20} className="shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="rounded-lg bg-sidebar-accent p-3 text-body-xs text-sidebar-foreground/50">
            Synced with Supabase
          </div>
        </div>
      </aside>
    </>
  );
};
