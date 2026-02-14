export const getCurrentFinancialYear = (): { start: Date; end: Date; label: string } => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(year, 3, 1),
    end: new Date(year + 1, 2, 31),
    label: `FY ${year}-${(year + 1).toString().slice(2)}`,
  };
};

export const getMonthName = (monthIndex: number): string => {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex];
};

export const getFinancialYearMonths = (): string[] => {
  return ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
};
