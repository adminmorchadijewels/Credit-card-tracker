import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/data/store";
import { formatCurrency } from "@/utils/formatters";
import { getFinancialYearMonths } from "@/utils/dateHelpers";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  Wallet, CreditCard, AlertTriangle, TrendingUp, Target, CalendarDays,
  CheckCircle2, XCircle, BarChart3, PieChart as PieChartIcon,
  ChevronDown, SlidersHorizontal, ReceiptText, Clock, Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(258, 52%, 51%)",
  "hsl(13, 99%, 61%)",
  "hsl(152, 60%, 45%)",
  "hsl(38, 92%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(170, 60%, 40%)",
];

// ── FY helpers ──────────────────────────────────────────────────────────────

const getFYOptions = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  // currentFYStart: the April that started the current FY
  const currentFYStart = currentMonth >= 3 ? currentYear : currentYear - 1;
  const options = [];
  // Always include one future FY (currentFYStart + 1) plus 4 past FYs
  for (let y = currentFYStart + 1; y >= currentFYStart - 4; y--) {
    options.push({ label: `FY ${y}-${(y + 1).toString().slice(2)}`, startYear: y });
  }
  return options;
};

const getFYRange = (startYear: number) => ({
  start: new Date(startYear, 3, 1),
  end: new Date(startYear + 1, 2, 31),
  label: `FY ${startYear}-${(startYear + 1).toString().slice(2)}`,
});

// ── Reusable multi-select filter control ─────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-body-xs font-normal shrink-0"
        >
          <SlidersHorizontal size={12} />
          {selected.length === 0
            ? `All ${label}`
            : `${selected.length}/${options.length} ${label}`}
          <ChevronDown size={11} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="end">
        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          <button
            className="w-full text-left px-2 py-1.5 rounded text-body-xs text-muted-foreground hover:bg-muted/60 transition-colors"
            onClick={() => onChange([])}
          >
            All {label}
          </button>
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/60 transition-colors select-none"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <span className="text-body-xs text-foreground truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { cards, payments, loading } = useStore();

  // ── All hooks must be before any conditional return ──────────────────────
  const fyOptions = useMemo(() => getFYOptions(), []);

  const readLS = <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return JSON.parse(v) as T;
    } catch {}
    return fallback;
  };

  // Default: fyOptions[1] = current FY (fyOptions[0] is next/future FY)
  const [selectedFYYear, setSelectedFYYear] = useState<number>(() =>
    readLS("cc-dash-fy", fyOptions[1].startYear)
  );

  // Per-section multi-select filters (empty array = show all)
  const [timelineFilter, setTimelineFilter] = useState<string[]>(() => readLS("cc-dash-timeline", []));
  const [trendFilter, setTrendFilter] = useState<string[]>(() => readLS("cc-dash-trend", []));
  const [targetFilter, setTargetFilter] = useState<string[]>(() => readLS("cc-dash-target", []));
  const [utilizationFilter, setUtilizationFilter] = useState<string[]>(() => readLS("cc-dash-util", []));
  // Bank split: filter by card owner
  const [bankOwnerFilter, setBankOwnerFilter] = useState<string[]>(() => readLS("cc-dash-bankowner", []));

  useEffect(() => { try { localStorage.setItem("cc-dash-fy", JSON.stringify(selectedFYYear)); } catch {} }, [selectedFYYear]);
  useEffect(() => { try { localStorage.setItem("cc-dash-timeline", JSON.stringify(timelineFilter)); } catch {} }, [timelineFilter]);
  useEffect(() => { try { localStorage.setItem("cc-dash-trend", JSON.stringify(trendFilter)); } catch {} }, [trendFilter]);
  useEffect(() => { try { localStorage.setItem("cc-dash-target", JSON.stringify(targetFilter)); } catch {} }, [targetFilter]);
  useEffect(() => { try { localStorage.setItem("cc-dash-util", JSON.stringify(utilizationFilter)); } catch {} }, [utilizationFilter]);
  useEffect(() => { try { localStorage.setItem("cc-dash-bankowner", JSON.stringify(bankOwnerFilter)); } catch {} }, [bankOwnerFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-body-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  const fy = getFYRange(selectedFYYear);
  const now = new Date();

  const fyPayments = payments.filter((p) => {
    const d = new Date(p.statementDate);
    return d >= fy.start && d <= fy.end;
  });

  const activeCardsList = cards.filter((c) => c.cardStatus === "Active");

  // ── KPI metrics ───────────────────────────────────────────────────────────
  const totalSpend = fyPayments.reduce((s, p) => s + p.paymentDue, 0);
  const totalPaid = fyPayments.reduce((s, p) => s + p.paidAmount, 0);
  const activeCards = activeCardsList.length;
  const missedPayments = fyPayments.filter((p) => {
    const status =
      p.paidAmount >= p.paymentDue
        ? "Paid"
        : p.paymentDeadline && new Date(p.paymentDeadline) < now
        ? "Overdue"
        : "Pending";
    return status === "Overdue";
  }).length;
  const avgUtilization =
    activeCardsList.length > 0
      ? Math.round(
          activeCardsList.reduce((sum, card) => {
            const cardSpend = fyPayments
              .filter((p) => p.cardId === card.id)
              .reduce((s, p) => s + p.paymentDue, 0);
            return sum + (card.cardLimit > 0 ? (cardSpend / card.cardLimit) * 100 : 0);
          }, 0) / activeCardsList.length
        )
      : 0;

  const outstandingBalance = Math.max(0, totalSpend - totalPaid);

  // ── Due this week (unpaid, deadline within 7 days or already overdue) ─────
  const dueThisWeek = payments
    .filter((p) => {
      if (!p.paymentDeadline) return false;
      const deadline = new Date(p.paymentDeadline);
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return p.paidAmount < p.paymentDue && daysUntil <= 7;
    })
    .sort((a, b) => new Date(a.paymentDeadline).getTime() - new Date(b.paymentDeadline).getTime());

  // ── Annual fee reminders (active cards with fee due in next 60 days) ──────
  const annualFeeReminders = cards
    .filter((c) => c.annualCharges > 0 && c.annualCycleReset && c.cardStatus === "Active")
    .map((c) => {
      const reset = new Date(c.annualCycleReset);
      const thisYear = now.getFullYear();
      let next = new Date(thisYear, reset.getMonth(), reset.getDate());
      if (next <= now) next = new Date(thisYear + 1, reset.getMonth(), reset.getDate());
      const daysUntil = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { card: c, nextDate: next, daysUntil };
    })
    .filter((r) => r.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // ── Filter option lists ───────────────────────────────────────────────────
  const cardOptions = activeCardsList.map((c) => ({ value: c.id, label: c.cardName }));
  const ownerOptions = [
    ...new Set(cards.map((c) => c.ownedBy).filter(Boolean)),
  ].map((o) => ({ value: o, label: o }));

  // ── Card-wise spend ───────────────────────────────────────────────────────
  const cardSpend = cards
    .map((card) => ({
      name: card.cardName.split(" ").slice(-1)[0],
      fullName: card.cardName,
      spend: fyPayments
        .filter((p) => p.cardId === card.id)
        .reduce((s, p) => s + p.paymentDue, 0),
    }))
    .sort((a, b) => b.spend - a.spend);

  // ── Bank-wise spend filtered by owner ────────────────────────────────────
  const bankFilteredCards =
    bankOwnerFilter.length > 0
      ? cards.filter((c) => bankOwnerFilter.includes(c.ownedBy))
      : cards;
  const bankMap: Record<string, number> = {};
  bankFilteredCards.forEach((card) => {
    const spend = fyPayments
      .filter((p) => p.cardId === card.id)
      .reduce((s, p) => s + p.paymentDue, 0);
    bankMap[card.bank] = (bankMap[card.bank] || 0) + spend;
  });
  const bankSpend = Object.entries(bankMap).map(([name, value]) => ({ name, value }));

  // ── Target achievement ────────────────────────────────────────────────────
  // Only include active cards that have at least one milestone with a spend target
  const allTargetData = activeCardsList
    .filter((card) => (card.targetMilestones || []).some((m) => m.spend > 0))
    .map((card) => {
      const actual = fyPayments
        .filter((p) => p.cardId === card.id)
        .reduce((s, p) => s + p.paymentDue, 0);
      const milestones = [...(card.targetMilestones || [])]
        .filter((m) => m.spend > 0)
        .sort((a, b) => a.spend - b.spend);
      const nextMilestone = milestones.find((m) => actual < m.spend);
      const topMilestone = milestones.length > 0 ? milestones[milestones.length - 1] : null;
      const overallPct =
        topMilestone && topMilestone.spend > 0
          ? Math.min(Math.round((actual / topMilestone.spend) * 100), 100)
          : 0;
      return {
        cardId: card.id,
        name: card.cardName,
        actual,
        milestones,
        nextMilestone,
        topTarget: topMilestone?.spend || 0,
        overallPct,
      };
    });

  const targetCardOptions = allTargetData.map((t) => ({ value: t.cardId, label: t.name }));
  const targetData =
    targetFilter.length > 0
      ? allTargetData.filter((t) => targetFilter.includes(t.cardId))
      : allTargetData;

  const fyEnded = now > fy.end;
  const milestonesMissed = fyEnded ? targetData.filter((t) => t.overallPct < 100).length : 0;

  // ── Category-wise spend ───────────────────────────────────────────────────
  const categoryMap: Record<string, number> = {};
  fyPayments.forEach((p) => {
    const txns = p.transactions || [];
    const txnTotal = txns.reduce((s, t) => s + t.amount, 0);
    txns.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });
    const unaccounted = Math.max(0, p.paymentDue - txnTotal);
    if (unaccounted > 0) categoryMap["Other"] = (categoryMap["Other"] || 0) + unaccounted;
  });
  const categorySpend = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── Monthly trend filtered by selected cards ──────────────────────────────
  const months = getFinancialYearMonths();
  const trendCards =
    trendFilter.length > 0 ? cards.filter((c) => trendFilter.includes(c.id)) : cards;
  const monthlyTrend = months.map((m, i) => {
    const monthIdx = (i + 3) % 12;
    const yearOffset = monthIdx < 3 ? 1 : 0;
    const year = fy.start.getFullYear() + yearOffset;
    const row: Record<string, string | number> = { month: m };
    trendCards.forEach((card) => {
      row[card.cardName] = fyPayments
        .filter((p) => {
          const d = new Date(p.statementDate);
          return p.cardId === card.id && d.getMonth() === monthIdx && d.getFullYear() === year;
        })
        .reduce((s, p) => s + p.paymentDue, 0);
    });
    return row;
  });

  // ── Utilization filtered ──────────────────────────────────────────────────
  const utilizationCards =
    utilizationFilter.length > 0
      ? activeCardsList.filter((c) => utilizationFilter.includes(c.id))
      : activeCardsList;
  const utilizationData = utilizationCards.map((card) => {
    const cardPayments = fyPayments.filter((p) => p.cardId === card.id);
    const avgUtil =
      cardPayments.length > 0
        ? Math.round(
            cardPayments.reduce(
              (s, p) => s + (card.cardLimit > 0 ? (p.paymentDue / card.cardLimit) * 100 : 0),
              0
            ) / cardPayments.length
          )
        : 0;
    return { name: card.cardName, utilization: avgUtil, limit: card.cardLimit };
  });

  // ── Statement timeline filtered ───────────────────────────────────────────
  const timelineCards =
    timelineFilter.length > 0
      ? activeCardsList.filter((c) => timelineFilter.includes(c.id))
      : activeCardsList;
  const timelineData = timelineCards.map((card) => {
    const monthStatuses = months.map((m, i) => {
      const monthIdx = (i + 3) % 12;
      const yearOffset = monthIdx < 3 ? 1 : 0;
      const year = fy.start.getFullYear() + yearOffset;
      const monthDate = new Date(year, monthIdx, 1);
      const isFuture = monthDate > now;
      const hasStatement = fyPayments.some((p) => {
        const d = new Date(p.statementDate);
        return p.cardId === card.id && d.getMonth() === monthIdx && d.getFullYear() === year;
      });
      return { month: m, hasStatement, isFuture };
    });
    return { cardName: card.cardName, cardId: card.id, months: monthStatuses };
  });

  // ── Shared section container class ───────────────────────────────────────
  const sectionCard =
    "rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200";

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-heading text-foreground">Dashboard</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">{fy.label} • Financial Overview</p>
        </div>
        <select
          value={selectedFYYear}
          onChange={(e) => setSelectedFYYear(Number(e.target.value))}
          className="h-10 rounded-lg border border-input bg-card px-4 text-body-sm font-medium text-foreground shrink-0"
        >
          {fyOptions.map((opt) => (
            <option key={opt.startYear} value={opt.startYear}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          {
            title: "Total Spend",
            value: formatCurrency(totalSpend),
            trend: 12.5,
            trendLabel: "vs last FY",
            icon: <Wallet size={22} />,
            accent: "primary" as const,
          },
          {
            title: "Total Paid",
            value: formatCurrency(totalPaid),
            trendLabel: fy.label,
            icon: <CheckCircle2 size={22} />,
            accent: "success" as const,
          },
          {
            title: "Outstanding",
            value: formatCurrency(outstandingBalance),
            icon: <ReceiptText size={22} />,
            accent: outstandingBalance > 0 ? "warning" as const : "success" as const,
          },
          {
            title: "Active Cards",
            value: String(activeCards),
            icon: <CreditCard size={22} />,
            accent: "secondary" as const,
          },
          {
            title: "Missed Payments",
            value: String(missedPayments),
            trend: missedPayments > 0 ? missedPayments * 10 : 0,
            trendLabel: "this FY",
            icon: <AlertTriangle size={22} />,
            accent: "warning" as const,
          },
          {
            title: "Avg Utilization",
            value: `${avgUtilization}%`,
            icon: <TrendingUp size={22} />,
            accent: "secondary" as const,
          },
        ].map((card, i) => (
          <div
            key={card.title}
            className="h-full animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <MetricCard {...card} />
          </div>
        ))}
      </div>

      {/* ── Due This Week ──────────────────────────────────────────────── */}
      {dueThisWeek.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={18} className="text-warning shrink-0" />
            <h3 className="text-base font-semibold text-card-foreground">Due This Week</h3>
            <Badge className="bg-warning text-warning-foreground ml-1">{dueThisWeek.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            {dueThisWeek.map((p) => {
              const deadline = new Date(p.paymentDeadline);
              const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isOverdue = daysUntil < 0;
              return (
                <div key={p.id} className={`flex-1 min-w-[160px] rounded-lg border p-3 ${isOverdue ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/10"}`}>
                  <p className="font-medium text-body-sm text-foreground">{p.cardName}</p>
                  <p className={`text-body-xs font-semibold mt-0.5 ${isOverdue ? "text-destructive" : "text-warning"}`}>
                    {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? "Due today" : `Due in ${daysUntil}d`}
                  </p>
                  <p className="text-body-xs text-muted-foreground mt-0.5">{formatCurrency(p.paymentDue - p.paidAmount)} remaining</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Annual Fee Reminders ────────────────────────────────────────── */}
      {annualFeeReminders.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="mb-3 flex items-center gap-2">
            <Bell size={18} className="text-primary shrink-0" />
            <h3 className="text-base font-semibold text-card-foreground">Annual Fee Reminders</h3>
            <span className="text-body-xs text-muted-foreground ml-1">Next 60 days</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {annualFeeReminders.map(({ card, nextDate, daysUntil }) => (
              <div key={card.id} className="flex-1 min-w-[160px] rounded-lg border border-border bg-background p-3">
                <p className="font-medium text-body-sm text-foreground">{card.cardName}</p>
                <p className="text-body-xs text-muted-foreground mt-0.5">{formatCurrency(card.annualCharges)} fee</p>
                <p className={`text-body-xs font-medium mt-0.5 ${daysUntil <= 14 ? "text-warning" : "text-primary"}`}>
                  {daysUntil === 0 ? "Due today" : `In ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`} · {nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Statement Timeline ─────────────────────────────────────────── */}
      <div className={sectionCard}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <CalendarDays size={18} className="text-primary shrink-0" />
          <h3 className="text-base font-semibold text-card-foreground">Statement Timeline</h3>
          <span className="hidden sm:inline text-body-xs text-muted-foreground">
            Missing statements highlighted
          </span>
          <div className="ml-auto">
            <MultiSelect
              label="Cards"
              options={cardOptions}
              selected={timelineFilter}
              onChange={setTimelineFilter}
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-3 px-3">
          <table className="w-full text-body-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-[130px] sm:w-[160px]">
                  Card
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className="px-1 py-2 text-center font-semibold text-muted-foreground text-body-xs"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timelineData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-body-xs text-muted-foreground">
                    No cards to display
                  </td>
                </tr>
              ) : (
                timelineData.map((card) => (
                  <tr
                    key={card.cardId}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground text-body-xs sm:text-body-sm max-w-[130px] truncate">
                      {card.cardName}
                    </td>
                    {card.months.map((ms, j) => (
                      <td key={j} className="px-1 py-2.5 text-center">
                        {ms.isFuture ? (
                          <span className="inline-block h-4 w-4 rounded-full bg-muted" />
                        ) : ms.hasStatement ? (
                          <CheckCircle2 size={16} className="inline-block text-success" />
                        ) : (
                          <XCircle size={16} className="inline-block text-destructive" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-body-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={13} className="text-success" /> Added
          </span>
          <span className="flex items-center gap-1">
            <XCircle size={13} className="text-destructive" /> Missing
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-muted" /> Future
          </span>
        </div>
      </div>

      {/* ── Charts Row 1: Card-wise Spend + Bank Split ─────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={`col-span-1 lg:col-span-2 ${sectionCard}`}>
          <h3 className="mb-4 text-base font-semibold text-card-foreground">
            Card-wise Spend Breakdown
          </h3>
          <div className="overflow-x-auto">
            <div className="min-w-[300px]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={cardSpend} layout="vertical" margin={{ left: 16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180, 10%, 88%)" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                    {cardSpend.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={sectionCard}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-card-foreground flex-1">Bank Spend Split</h3>
            {ownerOptions.length > 0 && (
              <MultiSelect
                label="Owners"
                options={ownerOptions}
                selected={bankOwnerFilter}
                onChange={setBankOwnerFilter}
              />
            )}
          </div>
          {bankSpend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={bankSpend}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {bankSpend.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-body-xs text-muted-foreground text-center py-16">
              No data for selected owners
            </p>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Monthly Trend + Target Achievement ───────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Monthly Spend Trend */}
        <div className={sectionCard}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-card-foreground flex-1">
              Monthly Spend Trend
            </h3>
            <MultiSelect
              label="Cards"
              options={cardOptions}
              selected={trendFilter}
              onChange={setTrendFilter}
            />
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[300px]">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(180, 10%, 88%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  {trendCards.map((card, i) => (
                    <Line
                      key={card.id}
                      type="monotone"
                      dataKey={card.cardName}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Target Achievement */}
        <div className={sectionCard}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Target size={18} className="text-primary shrink-0" />
            <h3 className="text-base font-semibold text-card-foreground flex-1">
              Target Achievement
            </h3>
            {milestonesMissed > 0 && (
              <Badge className="bg-overdue text-overdue-foreground shrink-0">
                {milestonesMissed} missed
              </Badge>
            )}
            {targetCardOptions.length > 0 && (
              <MultiSelect
                label="Cards"
                options={targetCardOptions}
                selected={targetFilter}
                onChange={setTargetFilter}
              />
            )}
          </div>

          {targetData.length === 0 ? (
            <p className="text-body-sm text-muted-foreground text-center py-10">
              {allTargetData.length === 0
                ? "No milestone targets configured. Add spend targets to cards to track progress here."
                : "No cards selected"}
            </p>
          ) : (
            <div className="space-y-5 max-h-[320px] overflow-y-auto pr-1">
              {targetData.map((item, i) => (
                <div key={item.cardId}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-body-sm font-semibold text-foreground">{item.name}</span>
                    <span className="text-body-xs text-muted-foreground">
                      {formatCurrency(item.actual)} spent
                    </span>
                  </div>

                  {/* Milestone stepper */}
                  <div className="relative overflow-x-auto pb-1">
                    <div className="flex items-center min-w-0">
                      {item.milestones.map((m, mi) => {
                        const achieved = item.actual >= m.spend;
                        const pct =
                          m.spend > 0
                            ? Math.min(Math.round((item.actual / m.spend) * 100), 100)
                            : 0;
                        const isLast = mi === item.milestones.length - 1;
                        return (
                          <div key={mi} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
                            <div className="flex flex-col items-center">
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all shrink-0 ${
                                  achieved
                                    ? "border-success bg-success text-success-foreground"
                                    : "border-border bg-card text-muted-foreground"
                                }`}
                              >
                                {achieved ? (
                                  <CheckCircle2 size={16} />
                                ) : (
                                  <span>{mi + 1}</span>
                                )}
                              </div>
                              <div className="mt-1 text-center max-w-[72px]">
                                <p className="text-[10px] font-medium text-foreground leading-tight truncate">
                                  {formatCurrency(m.spend)}
                                </p>
                                <p
                                  className="text-[9px] text-muted-foreground leading-tight truncate"
                                  title={m.reward}
                                >
                                  {m.reward}
                                </p>
                                {!achieved && pct > 0 && (
                                  <p
                                    className="text-[9px] font-medium"
                                    style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}
                                  >
                                    {pct}%
                                  </p>
                                )}
                              </div>
                            </div>
                            {!isLast && (
                              <div className="flex-1 mx-1 h-0.5 bg-border relative overflow-hidden">
                                <div
                                  className="absolute inset-y-0 left-0 h-full transition-all duration-700"
                                  style={{
                                    width: achieved ? "100%" : `${pct}%`,
                                    backgroundColor: achieved
                                      ? "hsl(152, 60%, 45%)"
                                      : CHART_COLORS[i % CHART_COLORS.length],
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {item.nextMilestone && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Next: spend {formatCurrency(item.nextMilestone.spend - item.actual)} more →{" "}
                      {item.nextMilestone.reward}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Utilization + Category Spend ───────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Average Utilization Rate */}
        <div className={sectionCard}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <BarChart3 size={18} className="text-primary shrink-0" />
            <h3 className="text-base font-semibold text-card-foreground flex-1">
              Average Utilization Rate
            </h3>
            <MultiSelect
              label="Cards"
              options={cardOptions}
              selected={utilizationFilter}
              onChange={setUtilizationFilter}
            />
          </div>

          {utilizationData.length === 0 ? (
            <p className="text-body-xs text-muted-foreground text-center py-8">
              No cards selected
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {utilizationData.map((item, i) => (
                <div
                  key={item.name}
                  className="rounded-lg border border-border bg-background p-4 hover:shadow-sm transition-all duration-200 hover:-translate-y-px"
                >
                  <p className="text-body-sm font-medium text-foreground truncate">{item.name}</p>
                  <div className="mt-2.5 flex items-end gap-2">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}
                    >
                      {item.utilization}%
                    </span>
                    <span className="mb-0.5 text-body-xs text-muted-foreground">
                      avg / {formatCurrency(item.limit)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(item.utilization, 100)}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category-wise Spend */}
        <div className={sectionCard}>
          <div className="mb-4 flex items-center gap-2">
            <PieChartIcon size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-card-foreground">Category-wise Spend</h3>
          </div>
          {categorySpend.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={categorySpend}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categorySpend.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {categorySpend.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-body-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate">{c.name}</span>
                    <span className="ml-auto font-medium text-foreground shrink-0">
                      {formatCurrency(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground text-center py-10">
              No transaction data available. Add transactions to statements to see category
              breakdown.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
