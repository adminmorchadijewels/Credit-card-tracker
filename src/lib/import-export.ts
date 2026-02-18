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

// ── Cards ─────────────────────────────────────────────────────────────────────

const CARD_HEADERS = [
  "id", "cardName", "parentId", "bank", "ownedBy", "email",
  "customerCare", "registeredNo", "cardLimit", "cardStatus",
  "limitShared", "billGenerationDay", "billPaymentDate",
  "annualCharges", "annualCycleReset", "rewardPointsExpiryDays",
  "milestoneRewards", "generalRewards", "targetMilestones",
];

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
    const get = (key: string) => (row[headers.indexOf(key)] ?? "").trim();

    const cardName = get("cardName");
    const bank = get("bank");
    if (!cardName || !bank) {
      errors.push(`Row ${i + 1}: cardName and bank are required.`);
      continue;
    }

    let targetMilestones: { spend: number; reward: string }[] = [{ spend: 0, reward: "" }];
    try {
      const parsed = JSON.parse(get("targetMilestones") || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) targetMilestones = parsed;
    } catch { /* keep default */ }

    const idVal = get("id");
    cards.push({
      id: idVal || crypto.randomUUID(),
      parentId: get("parentId"),
      cardName,
      cardStatus: (get("cardStatus") as "Active" | "Inactive") || "Active",
      ownedBy: get("ownedBy"),
      bank,
      customerCare: get("customerCare"),
      billGenerationDay: Number(get("billGenerationDay")) || 1,
      billPaymentDate: Number(get("billPaymentDate")) || 20,
      limitShared: get("limitShared") === "true",
      milestoneRewards: get("milestoneRewards"),
      generalRewards: get("generalRewards"),
      targetMilestones,
      annualCharges: Number(get("annualCharges")) || 0,
      registeredNo: get("registeredNo"),
      email: get("email"),
      annualCycleReset: get("annualCycleReset"),
      cardLimit: Number(get("cardLimit")) || 0,
      rewardPointsExpiryDays: Number(get("rewardPointsExpiryDays")) || 365,
    });
  }
  return { cards, errors };
}

// ── Payments ──────────────────────────────────────────────────────────────────

const PAYMENT_HEADERS = [
  "id", "cardId", "cardName", "statementDate", "paymentDue",
  "paymentDeadline", "paymentPaidOn", "paidAmount", "status", "notes",
];

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
    const get = (key: string) => (row[headers.indexOf(key)] ?? "").trim();

    const cardId = get("cardId");
    const statementDate = get("statementDate");
    if (!cardId || !statementDate) {
      errors.push(`Row ${i + 1}: cardId and statementDate are required.`);
      continue;
    }

    const idVal = get("id");
    payments.push({
      id: idVal || crypto.randomUUID(),
      cardId,
      cardName: get("cardName") || cardMap[cardId] || "",
      statementDate,
      paymentDue: Number(get("paymentDue")) || 0,
      paymentDeadline: get("paymentDeadline"),
      paymentPaidOn: get("paymentPaidOn") || null,
      paidAmount: Number(get("paidAmount")) || 0,
      status: (get("status") as Payment["status"]) || "Pending",
      notes: get("notes"),
      transactions: [],
    });
  }
  return { payments, errors };
}
