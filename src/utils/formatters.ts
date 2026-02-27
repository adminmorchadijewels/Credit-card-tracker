export const formatCurrency = (amount: number): string => {
  if (!isFinite(amount)) return "₹—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (n: number): string => {
  return new Intl.NumberFormat("en-IN").format(n);
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};
