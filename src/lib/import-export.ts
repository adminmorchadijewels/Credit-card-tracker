import { CreditCard, Payment } from "@/types";

// ── CSV helpers ───────────────────────────────────────────────────────────────

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let cell = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { cell += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { cell += line[i]; i++; }
      }
      result.push(cell);
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) { result.push(line.slice(i)); break; }
      result.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return result;
}

function parseCsvRows(csv: string): string[][] {
  return csv.trim().split("\n").map(parseCsvLine);
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().split("T")[0];

/** Normalize dates to YYYY-MM-DD regardless of input format.
 *  Accepts: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY */
function normalizeDate(raw: string): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // already ISO
  const m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return raw;
}

// ── Cards ─────────────────────────────────────────────────────────────────────
// Column labels match the UI table headers exactly.
// Legacy camelCase keys (old exports) are accepted as fallback during import.

const CARD_COL_MAP = [
  { label: "Card ID",            legacy: "id" },
  { label: "Card Name",          legacy: "cardName" },
  { label: "Parent ID",          legacy: "parentId" },
  { label: "Bank",               legacy: "bank" },
  { label: "Owner",              legacy: "ownedBy" },
  { label: "Email",              legacy: "email" },
  { label: "Customer Care",      legacy: "customerCare" },
  { label: "Registered No",      legacy: "registeredNo" },
  { label: "Card Limit",         legacy: "cardLimit" },
  { label: "Status",             legacy: "cardStatus" },
  { label: "Limit Shared",       legacy: "limitShared" },
  { label: "Bill Gen Day",       legacy: "billGenerationDay" },
  { label: "Bill Pay Day",       legacy: "billPaymentDate" },
  { label: "Annual Charges",     legacy: "annualCharges" },
  { label: "Annual Cycle Reset", legacy: "annualCycleReset" },
  { label: "Expiry (days)",      legacy: "rewardPointsExpiryDays" },
  { label: "Milestone Rewards",  legacy: "milestoneRewards" },
  { label: "General Rewards",    legacy: "generalRewards" },
  { label: "Target Milestones",  legacy: "targetMilestones" },
] as const;

const CARD_HEADERS = CARD_COL_MAP.map((c) => c.label);

/** Build a field getter that resolves both new UI label and old camelCase key. */
function makeCardGetter(headers: string[], row: string[]) {
  return (colLabel: string): string => {
    const map = CARD_COL_MAP.find((c) => c.label === colLabel);
    let idx = headers.indexOf(colLabel);
    if (idx === -1 && map) idx = headers.indexOf(map.legacy);
    return (row[idx] ?? "").trim();
  };
}

export function exportCardsCSV(cards: CreditCard[]) {
  const rows = [
    CARD_HEADERS.join(","),
    ...cards.map((c) =>
      [
        c.id, c.cardName, c.parentId, c.bank, c.ownedBy, c.email,
        c.customerCare, c.registeredNo, c.cardLimit, c.cardStatus,
        c.limitShared, c.billGenerationDay, c.billPaymentDate,
        c.annualCharges, c.annualCycleReset, c.rewardPointsExpiryDays,
        c.milestoneRewards, c.generalRewards,
        JSON.stringify(c.targetMilestones || []),
      ].map(escapeCsv).join(",")
    ),
  ].join("\n");
  downloadFile(rows, `fintrack-cards-${today()}.csv`);
}

export function downloadCardsSample() {
  const rows = [
    CARD_HEADERS.join(","),
    [
      "CARD001", "HDFC Regalia", "", "HDFC", "John Doe", "john@example.com",
      "1800-XXX-XXXX", "9876543210", "500000", "Active",
      "false", "15", "5",
      "2500", "2025-01-01", "365",
      "Spend 5L → 2500 bonus points", "4 reward points per ₹150",
      JSON.stringify([{ spend: 500000, reward: "2500 bonus points" }]),
    ].map(escapeCsv).join(","),
  ].join("\n");
  downloadFile(rows, "fintrack-cards-sample.csv");
}

export function importCardsCSV(
  csv: string
): { cards: CreditCard[]; errors: string[] } {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return { cards: [], errors: ["CSV has no data rows."] };

  const headers = rows[0].map((h) => h.trim());
  const errors: string[] = [];
  const cards: CreditCard[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2 || row.every((c) => !c.trim())) continue;
    const get = makeCardGetter(headers, row);

    const cardName = get("Card Name");
    const bank = get("Bank");
    if (!cardName || !bank) {
      errors.push(`Row ${i + 1}: "Card Name" and "Bank" are required.`);
      continue;
    }

    let targetMilestones: { spend: number; reward: string }[] = [{ spend: 0, reward: "" }];
    try {
      const parsed = JSON.parse(get("Target Milestones") || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) targetMilestones = parsed;
    } catch { /* keep default */ }

    const idVal = get("Card ID");
    cards.push({
      id: idVal || crypto.randomUUID(),
      parentId: get("Parent ID"),
      cardName,
      cardStatus: (get("Status") as "Active" | "Inactive") || "Active",
      ownedBy: get("Owner"),
      bank,
      customerCare: get("Customer Care"),
      billGenerationDay: Number(get("Bill Gen Day")) || 1,
      billPaymentDate: Number(get("Bill Pay Day")) || 20,
      limitShared: get("Limit Shared") === "true",
      milestoneRewards: get("Milestone Rewards"),
      generalRewards: get("General Rewards"),
      targetMilestones,
      annualCharges: Number(get("Annual Charges")) || 0,
      registeredNo: get("Registered No"),
      email: get("Email"),
      annualCycleReset: get("Annual Cycle Reset"),
      cardLimit: Number(get("Card Limit")) || 0,
      rewardPointsExpiryDays: Number(get("Expiry (days)")) || 365,
    });
  }
  return { cards, errors };
}

// ── Payments ──────────────────────────────────────────────────────────────────
// Column labels match the UI table headers exactly.
// Legacy camelCase keys (old exports) are accepted as fallback during import.

const PAYMENT_COL_MAP = [
  { label: "Payment ID",     legacy: "id" },
  { label: "Card ID",        legacy: "cardId" },
  { label: "Card Name",      legacy: "cardName" },
  { label: "Statement Date", legacy: "statementDate" },
  { label: "Due Amount",     legacy: "paymentDue" },
  { label: "Deadline",       legacy: "paymentDeadline" },
  { label: "Paid On",        legacy: "paymentPaidOn" },
  { label: "Paid Amount",    legacy: "paidAmount" },
  { label: "Status",         legacy: "status" },
  { label: "Notes",          legacy: "notes" },
] as const;

const PAYMENT_HEADERS = PAYMENT_COL_MAP.map((c) => c.label);

function makePaymentGetter(headers: string[], row: string[]) {
  return (colLabel: string): string => {
    const map = PAYMENT_COL_MAP.find((c) => c.label === colLabel);
    let idx = headers.indexOf(colLabel);
    if (idx === -1 && map) idx = headers.indexOf(map.legacy);
    return (row[idx] ?? "").trim();
  };
}

export function exportPaymentsCSV(payments: Payment[]) {
  const rows = [
    PAYMENT_HEADERS.join(","),
    ...payments.map((p) =>
      [
        p.id, p.cardId, p.cardName, p.statementDate, p.paymentDue,
        p.paymentDeadline, p.paymentPaidOn ?? "", p.paidAmount, p.status, p.notes,
      ].map(escapeCsv).join(",")
    ),
  ].join("\n");
  downloadFile(rows, `fintrack-payments-${today()}.csv`);
}

export function downloadPaymentsSample() {
  const rows = [
    PAYMENT_HEADERS.join(","),
    [
      "PAY001", "CARD001", "HDFC Regalia", "2025-01-15", "15000",
      "2025-02-05", "2025-02-03", "15000", "Paid", "January statement",
    ].map(escapeCsv).join(","),
    [
      "PAY002", "CARD001", "HDFC Regalia", "2025-02-15", "22000",
      "2025-03-05", "", "0", "Pending", "",
    ].map(escapeCsv).join(","),
  ].join("\n");
  downloadFile(rows, "fintrack-payments-sample.csv");
}

export function importPaymentsCSV(
  csv: string,
  cardMap: Record<string, string>
): { payments: Payment[]; errors: string[] } {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return { payments: [], errors: ["CSV has no data rows."] };

  const headers = rows[0].map((h) => h.trim());
  const errors: string[] = [];
  const payments: Payment[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2 || row.every((c) => !c.trim())) continue;
    const get = makePaymentGetter(headers, row);

    const cardId = get("Card ID");
    const statementDate = get("Statement Date");
    if (!cardId || !statementDate) {
      errors.push(`Row ${i + 1}: "Card ID" and "Statement Date" are required.`);
      continue;
    }

    const idVal = get("Payment ID");
    payments.push({
      id: idVal || crypto.randomUUID(),
      cardId,
      cardName: get("Card Name") || cardMap[cardId] || "",
      statementDate: normalizeDate(statementDate),
      paymentDue: Number(get("Due Amount")) || 0,
      paymentDeadline: normalizeDate(get("Deadline")),
      paymentPaidOn: normalizeDate(get("Paid On")) || null,
      paidAmount: Number(get("Paid Amount")) || 0,
      status: (get("Status") as Payment["status"]) || "Pending",
      notes: get("Notes"),
      transactions: [],
    });
  }
  return { payments, errors };
}
