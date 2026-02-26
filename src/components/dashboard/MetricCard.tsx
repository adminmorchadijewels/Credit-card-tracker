import { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon: ReactNode;
  accent?: "primary" | "secondary" | "success" | "warning";
  style?: CSSProperties;
}

const accentStyles = {
  primary: "from-primary/10 to-primary/5 border-primary/20",
  secondary: "from-secondary/10 to-secondary/5 border-secondary/20",
  success: "from-success/10 to-success/5 border-success/20",
  warning: "from-warning/10 to-warning/5 border-warning/20",
};

const iconBgStyles = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

export const MetricCard = ({ title, value, trend, trendLabel, icon, accent = "primary", style }: MetricCardProps) => {
  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? "text-success" : trend && trend < 0 ? "text-overdue" : "text-muted-foreground";

  return (
    <div
      style={style}
      className={cn(
        "h-full animate-fade-in rounded-xl border bg-gradient-to-br p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] cursor-default select-none",
        accentStyles[accent]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-body-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <div className={cn("flex items-center gap-1 text-body-xs font-medium", trendColor)}>
            {trend !== undefined ? (
              <>
                <TrendIcon size={14} />
                <span>{Math.abs(trend)}%</span>
                {trendLabel && <span className="text-muted-foreground ml-1">{trendLabel}</span>}
              </>
            ) : (
              <span className="invisible select-none">—</span>
            )}
          </div>
        </div>
        <div className={cn("rounded-xl p-3 shrink-0", iconBgStyles[accent])}>
          {icon}
        </div>
      </div>
    </div>
  );
};
