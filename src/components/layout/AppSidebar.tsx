import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CreditCard, Receipt, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Cards", path: "/basic-details", icon: CreditCard },
  { title: "Payments", path: "/payment-details", icon: Receipt },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <>
      {/* ── Mobile top bar (logo only) ──────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center bg-sidebar px-4 md:hidden">
        <span className="text-lg font-semibold text-sidebar-primary-foreground tracking-tight">
          💳 FinTrack
        </span>
      </div>

      {/* ── Mobile bottom tab bar ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-sidebar-border bg-sidebar md:hidden">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 pb-1 transition-all duration-200",
                isActive
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
              )}
            >
              <item.icon
                size={22}
                className={cn(
                  "shrink-0 transition-transform duration-200",
                  isActive && "scale-110"
                )}
              />
              <span className="text-[10px] font-medium leading-none">{item.title}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 z-50 h-screen w-[240px] flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center px-4">
          <span className="text-lg font-semibold text-sidebar-primary-foreground tracking-tight">
            💳 FinTrack
          </span>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
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

        <div className="p-3 border-t border-sidebar-accent space-y-2">
          {user && (
            <div className="rounded-lg bg-sidebar-accent px-3 py-2 space-y-2">
              <p className="text-body-xs text-sidebar-foreground/60 truncate" title={user.email}>
                {user.email}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 justify-start gap-2 px-2 text-body-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar"
                onClick={signOut}
              >
                <LogOut size={13} />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
