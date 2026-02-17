import { useState, useMemo } from "react";
import { useStore } from "@/data/store";
import { formatCurrency } from "@/utils/formatters";
import { getFinancialYearMonths } from "@/utils/dateHelpers";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Wallet, CreditCard, AlertTriangle, TrendingUp, Target, CalendarDays, CheckCircle2, XCircle, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const getFYOptions = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const options = [];
  for (let y = startYear; y >= startYear - 4; y--) {
    options.push({ label: `FY ${y}-${(y + 1).toString().slice(2)}`, startYear: y });
  }
  return options;
};

const getFYRange = (startYear: number) => ({
  start: new Date(startYear, 3, 1),
  end: new Date(startYear + 1, 2, 31),
  label: `FY ${startYear}-${(startYear + 1).toString().slice(2)}`,
});

const Dashboard = () => {
  const { cards, payments } = useStore();
  const fyOptions = useMemo(() => getFYOptions(), []);
  const [selectedFYYear, setSelectedFYYear] = useState(fyOptions[0].startYear);
  const fy = useMemo(() => getFYRange(selectedFYYear), [selectedFYYear]);

  const fyPayments = payments.filter((p) => {
    const d = new Date(p.statementDate);
    return d >= fy.start && d <= fy.end;
  });

  const totalSpend = fyPayments.reduce((s, p) => s + p.paymentDue, 0);
  const activeCards = cards.filter((c) => c.cardStatus === "Active").length;
  const missedPayments = fyPayments.filter((p) => {
    const status = p.paidAmount >= p.paymentDue ? "Paid" : (p.paymentDeadline && new Date(p.paymentDeadline) < new Date() ? "Overdue" : "Pending");
    return status === "Overdue";
  }).length;

  // Average utilization across all active cards
  const activeCardsList = cards.filter((c) => c.cardStatus === "Active");
  const avgUtilization = activeCardsList.length > 0
    ? Math.round(
        activeCardsList.reduce((sum, card) => {
          const cardSpend = fyPayments.filter((p) => p.cardId === card.id).reduce((s, p) => s + p.paymentDue, 0);
          return sum + (card.cardLimit > 0 ? (cardSpend / card.cardLimit) * 100 : 0);
        }, 0) / activeCardsList.length
      )
    : 0;

  // Card-wise spend
  const cardSpend = cards.map((card) => ({
    name: card.cardName.split(" ").slice(-1)[0],
    fullName: card.cardName,
    spend: fyPayments.filter((p) => p.cardId === card.id).reduce((s, p) => s + p.paymentDue, 0),
  })).sort((a, b) => b.spend - a.spend);

  // Bank-wise spend
  const bankMap: Record<string, number> = {};
  cards.forEach((card) => {
    const spend = fyPayments.filter((p) => p.cardId === card.id).reduce((s, p) => s + p.paymentDue, 0);
    bankMap[card.bank] = (bankMap[card.bank] || 0) + spend;
  });
  const bankSpend = Object.entries(bankMap).map(([name, value]) => ({ name, value }));

  // Target achievement (milestone-based)
  const targetData = activeCardsList.map((card) => {
    const actual = fyPayments.filter((p) => p.cardId === card.id).reduce((s, p) => s + p.paymentDue, 0);
    const milestones = card.targetMilestones || [];
    const achievedMilestones = milestones.filter((m) => actual >= m.spend);
    const nextMilestone = milestones.sort((a, b) => a.spend - b.spend).find((m) => actual < m.spend);
    const topMilestone = milestones.length > 0 ? milestones.reduce((max, m) => m.spend > max.spend ? m : max, milestones[0]) : null;
    const pct = topMilestone && topMilestone.spend > 0 ? Math.min(Math.round((actual / topMilestone.spend) * 100), 100) : 0;
    return { name: card.cardName, actual, milestones, achievedMilestones, nextMilestone, topTarget: topMilestone?.spend || 0, pct };
  });

  // Milestones missed: active cards where top milestone was not achieved and FY is ending/ended
  const now = new Date();
  const fyEnded = now > fy.end;
  const milestonesMissed = fyEnded ? targetData.filter((t) => t.pct < 100).length : 0;

  // Category-wise spend from transactions
  const categoryMap: Record<string, number> = {};
  fyPayments.forEach((p) => {
    const txns = p.transactions || [];
    const txnTotal = txns.reduce((s, t) => s + t.amount, 0);
    txns.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });
    const unaccounted = Math.max(0, p.paymentDue - txnTotal);
    if (unaccounted > 0) {
      categoryMap["Other"] = (categoryMap["Other"] || 0) + unaccounted;
    }
  });
  const categorySpend = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Monthly trend
  const months = getFinancialYearMonths();
  const monthlyTrend = months.map((m, i) => {
    const monthIdx = (i + 3) % 12;
    const yearOffset = monthIdx < 3 ? 1 : 0;
    const year = fy.start.getFullYear() + yearOffset;
    const row: Record<string, string | number> = { month: m };
    cards.forEach((card) => {
      row[card.cardName] = fyPayments
        .filter((p) => {
          const d = new Date(p.statementDate);
          return p.cardId === card.id && d.getMonth() === monthIdx && d.getFullYear() === year;
        })
        .reduce((s, p) => s + p.paymentDue, 0);
    });
    return row;
  });

  // Per-card utilization (average across FY months with statements)
  const utilizationData = activeCardsList.map((card) => {
    const cardPayments = fyPayments.filter((p) => p.cardId === card.id);
    const avgUtil = cardPayments.length > 0
      ? Math.round(cardPayments.reduce((s, p) => s + (card.cardLimit > 0 ? (p.paymentDue / card.cardLimit) * 100 : 0), 0) / cardPayments.length)
      : 0;
    return { name: card.cardName, utilization: avgUtil, limit: card.cardLimit };
  });

  // Statement timeline
  const timelineData = activeCardsList.map((card) => {
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-foreground">Dashboard</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">{fy.label} • Financial Overview</p>
        </div>
        <select value={selectedFYYear} onChange={(e) => setSelectedFYYear(Number(e.target.value))}
          className="h-10 rounded-lg border border-input bg-card px-4 text-body-sm font-medium text-foreground">
          {fyOptions.map((opt) => (
            <option key={opt.startYear} value={opt.startYear}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Spend" value={formatCurrency(totalSpend)} trend={12.5} trendLabel="vs last FY" icon={<Wallet size={22} />} accent="primary" />
        <MetricCard title="Active Cards" value={String(activeCards)} icon={<CreditCard size={22} />} accent="success" />
        <MetricCard title="Missed Payments" value={String(missedPayments)} trend={missedPayments > 0 ? missedPayments * 10 : 0} trendLabel="this FY" icon={<AlertTriangle size={22} />} accent="warning" />
        <MetricCard title="Avg Utilization" value={`${avgUtilization}%`} icon={<TrendingUp size={22} />} accent="secondary" />
      </div>

      {/* Statement Timeline */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-card-foreground">Statement Timeline</h3>
          <span className="ml-2 text-body-xs text-muted-foreground">Missing statements highlighted</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-[160px]">Card</th>
                {months.map((m) => (
                  <th key={m} className="px-2 py-2 text-center font-semibold text-muted-foreground text-body-xs">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timelineData.map((card) => (
                <tr key={card.cardId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 font-medium text-foreground">{card.cardName}</td>
                  {card.months.map((ms, j) => (
                    <td key={j} className="px-2 py-2.5 text-center">
                      {ms.isFuture ? (
                        <span className="inline-block h-5 w-5 rounded-full bg-muted" />
                      ) : ms.hasStatement ? (
                        <CheckCircle2 size={18} className="inline-block text-success" />
                      ) : (
                        <XCircle size={18} className="inline-block text-destructive" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-4 text-body-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-success" /> Added</span>
          <span className="flex items-center gap-1"><XCircle size={14} className="text-destructive" /> Missing</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3.5 w-3.5 rounded-full bg-muted" /> Future</span>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">Card-wise Spend Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cardSpend} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(180, 10%, 88%)" />
              <XAxis type="number" tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                {cardSpend.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">Bank Spend Split</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={bankSpend} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                {bankSpend.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Trend */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">Monthly Spend Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(180, 10%, 88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {cards.map((card, i) => (
                <Line key={card.id} type="monotone" dataKey={card.cardName} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Target Achievement (Milestone-based) */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Target size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-card-foreground">Target Achievement</h3>
            {milestonesMissed > 0 && (
              <Badge className="bg-overdue text-overdue-foreground ml-auto">{milestonesMissed} milestone{milestonesMissed > 1 ? "s" : ""} missed</Badge>
            )}
          </div>
          <div className="space-y-5">
            {targetData.map((item, i) => (
              <div key={item.name}>
                <div className="mb-1.5 flex items-center justify-between text-body-sm">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.actual)} / {formatCurrency(item.topTarget)}
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {/* Milestone markers */}
                  {item.milestones.map((m, mi) => {
                    const pos = item.topTarget > 0 ? Math.min((m.spend / item.topTarget) * 100, 100) : 0;
                    return <div key={mi} className="absolute top-0 h-full w-0.5 bg-foreground/30" style={{ left: `${pos}%` }} title={`${formatCurrency(m.spend)}: ${m.reward}`} />;
                  })}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-body-xs text-muted-foreground">{item.pct}% achieved</p>
                  <div className="flex gap-1">
                    {item.achievedMilestones.map((m, mi) => (
                      <Badge key={mi} variant="outline" className="text-body-xs text-success border-success/30">{m.reward}</Badge>
                    ))}
                  </div>
                </div>
                {item.nextMilestone && (
                  <p className="text-body-xs text-muted-foreground mt-0.5">
                    Next: Spend {formatCurrency(item.nextMilestone.spend - item.actual)} more → {item.nextMilestone.reward}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Utilization + Category Spend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Avg Utilization per card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-card-foreground">Average Utilization Rate</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {utilizationData.map((item, i) => (
              <div key={item.name} className="rounded-lg border border-border bg-background p-4">
                <p className="text-body-sm font-medium text-foreground">{item.name}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-2xl font-bold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{item.utilization}%</span>
                  <span className="mb-0.5 text-body-xs text-muted-foreground">avg of {formatCurrency(item.limit)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(item.utilization, 100)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category-wise Spend */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PieChartIcon size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-card-foreground">Category-wise Spend</h3>
          </div>
          {categorySpend.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categorySpend} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {categorySpend.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {categorySpend.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-body-xs">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="ml-auto font-medium text-foreground">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground text-center py-8">No transaction data available. Add transactions to statements to see category breakdown.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
