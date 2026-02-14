import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, CreditCard, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Basic Details", path: "/basic-details", icon: CreditCard },
  { title: "Payment Details", path: "/payment-details", icon: Receipt },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <span className="text-lg font-semibold text-sidebar-primary-foreground tracking-tight">
            💳 CardTrack
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
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
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4">
        {!collapsed && (
          <div className="rounded-lg bg-sidebar-accent p-3 text-body-xs text-sidebar-foreground/50">
            Data stored locally
          </div>
        )}
      </div>
    </aside>
  );
};
