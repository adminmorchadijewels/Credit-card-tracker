import { useStore } from "@/data/store";
import { formatCurrency } from "@/utils/formatters";
import { getCurrentFinancialYear } from "@/utils/dateHelpers";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Wallet, CreditCard, AlertTriangle, Star, TrendingUp, Target } from "lucide-react";
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
];

const Dashboard = () => {
  const { cards, payments } = useStore();
  const fy = getCurrentFinancialYear();

  const fyPayments = payments.filter((p) => {
    const d = new Date(p.statementDate);
    return d >= fy.start && d <= fy.end;
  });

  const totalSpend = fyPayments.reduce((s, p) => s + p.paymentDue, 0);
  const activeCards = cards.filter((c) => c.cardStatus === "Active").length;
  const missedPayments = fyPayments.filter((p) => p.status === "Overdue").length;
  const totalRewardPoints = Math.round(totalSpend / 150) * 4;

  // Card-wise spend for bar chart
  const cardSpend = cards.map((card) => ({
    name: card.cardName.split(" ").slice(-1)[0],
    fullName: card.cardName,
    spend: fyPayments.filter((p) => p.cardId === card.id).reduce((s, p) => s + p.paymentDue, 0),
  })).sort((a, b) => b.spend - a.spend);

  // Bank-wise spend for pie chart
  const bankMap: Record<string, number> = {};
  cards.forEach((card) => {
    const spend = fyPayments.filter((p) => p.cardId === card.id).reduce((s, p) => s + p.paymentDue, 0);
    bankMap[card.bank] = (bankMap[card.bank] || 0) + spend;
  });
  const bankSpend = Object.entries(bankMap).map(([name, value]) => ({ name, value }));

  // Target achievement
  const targetData = cards
    .filter((c) => c.cardStatus === "Active")
    .map((card) => {
      const actual = fyPayments.filter((p) => p.cardId === card.id).reduce((s, p) => s + p.paymentDue, 0);
      const pct = card.targetSpend > 0 ? Math.min(Math.round((actual / card.targetSpend) * 100), 100) : 0;
      return { name: card.cardName, actual, target: card.targetSpend, pct };
    });

  // Monthly trend
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
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

  // Utilization
  const utilizationData = cards
    .filter((c) => c.cardStatus === "Active")
    .map((card) => {
      const latestPayment = fyPayments
        .filter((p) => p.cardId === card.id)
        .sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime())[0];
      const utilization = latestPayment ? Math.round((latestPayment.paymentDue / card.cardLimit) * 100) : 0;
      return { name: card.cardName, utilization, limit: card.cardLimit };
    });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-foreground">Dashboard</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">{fy.label} • Financial Overview</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Spend"
          value={formatCurrency(totalSpend)}
          trend={12.5}
          trendLabel="vs last FY"
          icon={<Wallet size={22} />}
          accent="primary"
        />
        <MetricCard
          title="Active Cards"
          value={String(activeCards)}
          icon={<CreditCard size={22} />}
          accent="success"
        />
        <MetricCard
          title="Missed Payments"
          value={String(missedPayments)}
          trend={missedPayments > 0 ? missedPayments * 10 : 0}
          trendLabel="this FY"
          icon={<AlertTriangle size={22} />}
          accent="warning"
        />
        <MetricCard
          title="Reward Points"
          value={totalRewardPoints.toLocaleString("en-IN")}
          trend={8}
          trendLabel="growth"
          icon={<Star size={22} />}
          accent="secondary"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card-wise Spend */}
        <div className="col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">Card-wise Spend Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cardSpend} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(180, 10%, 88%)" />
              <XAxis type="number" tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                {cardSpend.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bank Donut */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">Bank Spend Split</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={bankSpend}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {bankSpend.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
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
                <Line
                  key={card.id}
                  type="monotone"
                  dataKey={card.cardName}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Target Achievement */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Target size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-card-foreground">Target Achievement</h3>
          </div>
          <div className="space-y-5">
            {targetData.map((item, i) => (
              <div key={item.name}>
                <div className="mb-1.5 flex items-center justify-between text-body-sm">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(item.actual)} / {formatCurrency(item.target)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${item.pct}%`,
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                </div>
                <p className="mt-1 text-body-xs text-muted-foreground">{item.pct}% achieved</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Utilization */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          <h3 className="text-base font-semibold text-card-foreground">Card Utilization Rate</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {utilizationData.map((item, i) => (
            <div key={item.name} className="rounded-lg border border-border bg-background p-4">
              <p className="text-body-sm font-medium text-foreground">{item.name}</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-2xl font-bold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                  {item.utilization}%
                </span>
                <span className="mb-0.5 text-body-xs text-muted-foreground">
                  of {formatCurrency(item.limit)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${item.utilization}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
