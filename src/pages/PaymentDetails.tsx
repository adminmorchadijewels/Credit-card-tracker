import { useState, useRef, Fragment } from "react";
import { useStore } from "@/data/store";
import { Payment, PaymentInstallment, Transaction } from "@/types";
import { formatCurrency, formatDate, generateId } from "@/utils/formatters";
import { Plus, Pencil, Trash2, Search, X, Upload, FileText, ChevronDown, ChevronUp, Download, FileDown, Banknote, AlertTriangle } from "lucide-react";
import {
  exportPaymentsCSV,
  exportPaymentsWithTransactionsCSV,
  downloadPaymentsSample,
  importPaymentsCSV,
} from "@/lib/import-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { StatementChat } from "@/components/StatementChat";
import { MessageSquare } from "lucide-react";

const statusStyles: Record<string, string> = {
  Paid: "bg-success text-success-foreground",
  Pending: "bg-warning text-warning-foreground",
  Overdue: "bg-overdue text-overdue-foreground",
};

const TRANSACTION_CATEGORIES = ["Travel", "Dining", "Shopping", "Groceries", "Fuel", "Bills", "Entertainment", "Health", "Education", "Other"];

const PaymentDetails = () => {
  const { cards, payments, addPayment, updatePayment, deletePayment, addTransaction, updateTransaction, deleteTransaction, addInstallment, updateInstallment, deleteInstallment, loading } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cardFilter, setCardFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
  const [txnForm, setTxnForm] = useState<Transaction>({ id: "", paymentId: "", date: "", category: "Other", amount: 0, remark: "" });
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [chatPayment, setChatPayment] = useState<Payment | null>(null);
  const [installModalPayment, setInstallModalPayment] = useState<Payment | null>(null);
  const [installForm, setInstallForm] = useState<{ date: string; amount: number; note: string }>({ date: "", amount: 0, note: "" });
  const [editingInstall, setEditingInstall] = useState<PaymentInstallment | null>(null);
  type PaymentSortField = "cardName" | "statementDate" | "paymentDue" | "paymentDeadline" | "paymentPaidOn" | "paidAmount" | "status";
  const [sortField, setSortField] = useState<PaymentSortField>("statementDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const handlePaymentSort = (field: PaymentSortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };
  type TxnSortField = "date" | "category" | "amount" | "remark";
  const [txnSortField, setTxnSortField] = useState<TxnSortField>("date");
  const [txnSortDir, setTxnSortDir] = useState<"asc" | "desc">("asc");
  const handleTxnSort = (field: TxnSortField) => {
    if (txnSortField === field) setTxnSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setTxnSortField(field); setTxnSortDir("asc"); }
  };

  const [form, setForm] = useState<Payment>({
    id: generateId(), cardId: "", cardName: "",
    statementDate: "", paymentDue: 0, paymentDeadline: "", paymentPaidOn: null,
    paidAmount: 0, status: "Pending", notes: "", transactions: [], installments: [],
  });

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


  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.cardName.toLowerCase().includes(q) || p.cardId.toLowerCase().includes(q);
    const matchStatus = !statusFilter || computeStatus(p) === statusFilter;
    const matchCard = !cardFilter || p.cardId === cardFilter;
    return matchSearch && matchStatus && matchCard;
  }).sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const aVal = (a[sortField] ?? "") as string | number;
    const bVal = (b[sortField] ?? "") as string | number;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * dir;
    }
    return ((aVal as number) - (bVal as number)) * dir;
  });

  function computeStatus(f: Payment): Payment["status"] {
    if (f.paidAmount > 0 && f.paidAmount >= f.paymentDue) return "Paid";
    if (f.paymentDeadline && new Date(f.paymentDeadline) < new Date()) return "Overdue";
    return "Pending";
  }

  const openAdd = () => {
    setEditingPayment(null);
    setForm({ id: generateId(), cardId: cards[0]?.id || "", cardName: cards[0]?.cardName || "",
      statementDate: "", paymentDue: 0, paymentDeadline: "", paymentPaidOn: null,
      paidAmount: 0, status: "Pending", notes: "", transactions: [], installments: [] });
    setModalOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditingPayment(p);
    setForm({ ...p });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.cardId || !form.statementDate) {
      toast({ title: "Validation Error", description: "Card and Statement Date are required.", variant: "destructive" });
      return;
    }
    const card = cards.find((c) => c.id === form.cardId);
    const updated = { ...form, cardName: card?.cardName || form.cardName, status: computeStatus(form) };
    if (editingPayment) {
      updatePayment(updated);
      toast({ title: "Payment updated" });
    } else {
      addPayment(updated);
      toast({ title: "Payment added" });
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deletePayment(deleteId);
      toast({ title: "Payment deleted" });
      setDeleteId(null);
    }
  };

  const handleMarkPaid = (p: Payment) => {
    const today = new Date().toISOString().split("T")[0];
    updatePayment({ ...p, paymentPaidOn: today, paidAmount: p.paymentDue, status: "Paid" });
    toast({ title: `${p.cardName} marked as paid` });
  };

  const setField = (key: keyof Payment, value: Payment[keyof Payment]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** When selecting a card in Add mode, pre-fill next statement & deadline dates
   *  based on the card's last payment and bill gen / pay days. */
  const handleCardSelectInModal = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!editingPayment) {
      const lastPayment = [...payments]
        .filter((p) => p.cardId === cardId)
        .sort((a, b) => b.statementDate.localeCompare(a.statementDate))[0];
      if (lastPayment) {
        const lastStat = new Date(lastPayment.statementDate);
        const genDay = card?.billGenerationDay || lastStat.getDate();
        const payDay = card?.billPaymentDate || 20;
        const nextStatMonth = (lastStat.getMonth() + 1) % 12;
        const nextStatYear = lastStat.getMonth() === 11 ? lastStat.getFullYear() + 1 : lastStat.getFullYear();
        const nextStat = new Date(nextStatYear, nextStatMonth, genDay);
        const deadlineMonth = (nextStatMonth + 1) % 12;
        const deadlineYear = nextStatMonth === 11 ? nextStatYear + 1 : nextStatYear;
        const deadline = new Date(deadlineYear, deadlineMonth, payDay);
        setForm((prev) => ({
          ...prev, cardId, cardName: card?.cardName || "",
          statementDate: nextStat.toISOString().split("T")[0],
          paymentDeadline: deadline.toISOString().split("T")[0],
        }));
        return;
      }
    }
    setForm((prev) => ({ ...prev, cardId, cardName: card?.cardName || "" }));
  };

  /** Find the previous month's payment for the same card (for MoM delta). */
  const prevMonthPayment = (p: Payment) => {
    const d = new Date(p.statementDate);
    const prevY = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const prevM = (d.getMonth() + 11) % 12;
    return payments.find((o) => {
      if (o.cardId !== p.cardId || o.id === p.id) return false;
      const od = new Date(o.statementDate);
      return od.getFullYear() === prevY && od.getMonth() === prevM;
    }) ?? null;
  };

  const handleFileUpload = async (paymentId: string, file: File) => {
    setUploadingFor(paymentId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${paymentId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("statements").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("statements").getPublicUrl(path);
      const payment = payments.find((p) => p.id === paymentId);
      if (payment) {
        updatePayment({ ...payment, statementFileUrl: urlData.publicUrl, statementFileName: file.name });
      }
      toast({ title: "Statement uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFor(null);
    }
  };

  const openTxnAdd = (paymentId: string) => {
    setEditingTxn(null);
    setTxnForm({ id: generateId(), paymentId, date: "", category: "Other", amount: 0, remark: "" });
    setTxnModalOpen(true);
  };

  const openTxnEdit = (txn: Transaction) => {
    setEditingTxn(txn);
    setTxnForm({ ...txn });
    setTxnModalOpen(true);
  };

  const handleTxnSave = () => {
    if (!txnForm.date || txnForm.amount <= 0) {
      toast({ title: "Validation Error", description: "Date and Amount are required.", variant: "destructive" });
      return;
    }
    if (editingTxn) {
      updateTransaction(txnForm.paymentId, txnForm);
      toast({ title: "Transaction updated" });
    } else {
      addTransaction(txnForm.paymentId, txnForm);
      toast({ title: "Transaction added" });
    }
    setTxnModalOpen(false);
  };

  const openInstallModal = (p: Payment) => {
    // Sync installModalPayment with the latest state from payments store
    setInstallModalPayment(p);
    setInstallForm({ date: "", amount: 0, note: "" });
    setEditingInstall(null);
  };

  const handleInstallSave = () => {
    if (!installForm.date || installForm.amount <= 0) {
      toast({ title: "Validation Error", description: "Date and Amount are required.", variant: "destructive" });
      return;
    }
    if (!installModalPayment) return;
    if (editingInstall) {
      updateInstallment(installModalPayment.id, { ...editingInstall, ...installForm });
      toast({ title: "Installment updated" });
    } else {
      addInstallment(installModalPayment.id, { id: generateId(), ...installForm });
      toast({ title: "Installment added" });
    }
    setInstallForm({ date: "", amount: 0, note: "" });
    setEditingInstall(null);
    // Keep modal open so user can add more; also sync latest payment state
    setInstallModalPayment((prev) =>
      prev ? (payments.find((p) => p.id === prev.id) ?? prev) : null
    );
  };

  const handleImportPayments = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const cardMap: Record<string, string> = Object.fromEntries(cards.map((c) => [c.id, c.cardName]));
      const { payments: imported, errors } = importPaymentsCSV(csv, cardMap);
      if (errors.length > 0) {
        toast({ title: "Import errors", description: errors.join("\n"), variant: "destructive" });
      }
      let added = 0, updated = 0;
      const existingIds = new Set(payments.map((p) => p.id));
      imported.forEach((p) => {
        if (existingIds.has(p.id)) {
          // Merge: preserve fields not present in CSV to avoid data loss
          const existing = payments.find((ep) => ep.id === p.id);
          updatePayment({
            ...p,
            transactions: existing?.transactions ?? [],
            installments: existing?.installments ?? [],
            statementFileUrl: p.statementFileUrl ?? existing?.statementFileUrl,
            statementFileName: p.statementFileName ?? existing?.statementFileName,
          });
          updated++;
        } else {
          addPayment({ ...p, installments: [] });
          added++;
        }
      });
      const parts: string[] = [];
      if (added > 0) parts.push(`${added} added`);
      if (updated > 0) parts.push(`${updated} updated`);
      if (parts.length > 0) {
        toast({ title: `Import complete: ${parts.join(", ")}` });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getUndefinedAmount = (p: Payment) => {
    const txnTotal = (p.transactions || []).reduce((s, t) => s + t.amount, 0);
    return Math.max(0, p.paymentDue - txnTotal);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading text-foreground">Payment Details</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">{payments.length} payment records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportPaymentsCSV(payments)}>
            <Download size={14} /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportPaymentsWithTransactionsCSV(payments)}>
            <Download size={14} /> Export Full
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadPaymentsSample}>
            <FileDown size={14} /> Sample CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => importRef.current?.click()}>
            <Upload size={14} /> Import CSV
          </Button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImportPayments} />
          <Button onClick={openAdd} className="gap-2">
            <Plus size={16} /> Add Payment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2.5">
        {/* Search + Card select */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} className="h-10 w-full sm:w-auto rounded-full border border-input bg-card px-4 text-body-sm text-foreground">
            <option value="">All Cards</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.cardName}</option>)}
          </select>
          {(search || statusFilter || cardFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); setCardFilter(""); }}>
              <X size={14} className="mr-1" /> Clear
            </Button>
          )}
        </div>
        {/* Status pill buttons */}
        <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-0.5">
          {(["", "Paid", "Pending", "Overdue"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                "shrink-0 rounded-full border px-4 py-1.5 text-body-xs font-medium transition-all duration-150",
                statusFilter === s
                  ? s === "Paid"
                    ? "bg-success text-success-foreground border-success shadow-sm"
                    : s === "Pending"
                    ? "bg-warning text-warning-foreground border-warning shadow-sm"
                    : s === "Overdue"
                    ? "bg-destructive text-destructive-foreground border-destructive shadow-sm"
                    : "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              ].join(" ")}
            >
              {s === "" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Overdue Banner */}
      {(() => {
        const overdue = payments.filter(
          (p) => p.paidAmount < p.paymentDue && p.paymentDeadline && new Date(p.paymentDeadline) < new Date()
        );
        if (overdue.length === 0) return null;
        return (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={17} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-body-sm font-semibold text-destructive">
                {overdue.length} overdue payment{overdue.length !== 1 ? "s" : ""}
              </p>
              <p className="text-body-xs text-muted-foreground mt-0.5">
                {overdue.map((p) => `${p.cardName} (${formatCurrency(p.paymentDue - p.paidAmount)})`).join(" · ")}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {filtered.map((p, i) => {
          const displayStatus = computeStatus(p);
          const isExpanded = expandedPayment === p.id;
          const txns = p.transactions || [];
          const undefinedAmt = getUndefinedAmount(p);
          const paidPct = p.paymentDue > 0 ? Math.min(100, (p.paidAmount / p.paymentDue) * 100) : 0;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{p.cardName}</p>
                    <p className="text-body-xs text-muted-foreground">{p.cardId}</p>
                  </div>
                  <Badge className={statusStyles[displayStatus]}>{displayStatus}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-body-sm">
                  <div>
                    <p className="text-body-xs text-muted-foreground">Statement</p>
                    <Input type="date" value={p.statementDate} className="h-8 mt-0.5"
                      onChange={(e) => { const u = { ...p, statementDate: e.target.value }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                  </div>
                  <div>
                    <p className="text-body-xs text-muted-foreground">Deadline</p>
                    <Input type="date" value={p.paymentDeadline} className="h-8 mt-0.5"
                      onChange={(e) => { const u = { ...p, paymentDeadline: e.target.value }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                  </div>
                  <div>
                    <p className="text-body-xs text-muted-foreground">Due Amount</p>
                    <Input type="number" value={p.paymentDue} className="h-8 mt-0.5"
                      onChange={(e) => { const u = { ...p, paymentDue: Number(e.target.value) }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                  </div>
                  <div>
                    <p className="text-body-xs text-muted-foreground">Paid Amount</p>
                    {p.installments.length > 0 ? (
                      <p className="text-body-sm font-medium mt-0.5">{formatCurrency(p.paidAmount)}</p>
                    ) : (
                      <Input type="number" value={p.paidAmount} className="h-8 mt-0.5"
                        onChange={(e) => { const u = { ...p, paidAmount: Number(e.target.value) }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-body-xs text-muted-foreground">
                      Paid On{p.installments.length > 0 ? ` (${p.installments.length} payment${p.installments.length !== 1 ? "s" : ""})` : ""}
                    </p>
                    {p.installments.length > 0 ? (
                      <p className="text-body-sm mt-0.5">{p.paymentPaidOn ? formatDate(p.paymentPaidOn) : "—"}</p>
                    ) : (
                      <Input type="date" value={p.paymentPaidOn || ""} className="h-8 mt-0.5"
                        onChange={(e) => { const u = { ...p, paymentPaidOn: e.target.value || null }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="h-7 text-body-xs gap-1" onClick={() => openInstallModal(p)}>
                    <Banknote size={12} />
                    Payments{p.installments.length > 0 ? ` (${p.installments.length})` : ""}
                  </Button>
                  {p.statementFileName ? (
                    <a href={p.statementFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-body-xs">
                      <FileText size={14} /> {p.statementFileName}
                    </a>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-body-xs gap-1" disabled={uploadingFor === p.id}
                      onClick={() => { setUploadingFor(p.id); fileInputRef.current?.click(); }}>
                      <Upload size={12} /> {uploadingFor === p.id ? "Uploading..." : "Upload"}
                    </Button>
                  )}
                  {displayStatus !== "Paid" && p.installments.length === 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-body-xs text-success" onClick={() => handleMarkPaid(p)}>Mark Paid</Button>
                  )}
                  {p.statementFileUrl && (
                    <Button variant="ghost" size="sm" className="h-7 text-body-xs gap-1 text-primary" onClick={() => setChatPayment(p)}>
                      <MessageSquare size={12} /> Ask AI
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 size={14} /></Button>
                </div>
                {/* Pay progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={[
                      "h-full rounded-full transition-all duration-500",
                      displayStatus === "Paid" ? "bg-success" : displayStatus === "Overdue" ? "bg-destructive" : "bg-warning",
                    ].join(" ")}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-1 py-2 text-body-xs text-muted-foreground border-t border-border hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedPayment(isExpanded ? null : p.id)}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {txns.length} transaction{txns.length !== 1 ? "s" : ""}
              </button>
              {isExpanded && (
                <div className="border-t border-border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-body-sm font-semibold">Transactions</h4>
                    <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => openTxnAdd(p.id)}>
                      <Plus size={12} /> Add
                    </Button>
                  </div>
                  {undefinedAmt > 0 && (
                    <p className="text-body-xs text-muted-foreground">Unaccounted: <strong className="text-warning">{formatCurrency(undefinedAmt)}</strong></p>
                  )}
                  {txns.length > 0 ? [...txns].sort((a, b) => {
                    const dir = txnSortDir === "asc" ? 1 : -1;
                    const av = (a[txnSortField] ?? "") as string | number;
                    const bv = (b[txnSortField] ?? "") as string | number;
                    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
                    return ((av as number) - (bv as number)) * dir;
                  }).map((t) => (
                    <div key={t.id} className="flex items-start justify-between rounded-lg border border-border bg-card p-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-body-xs">{t.category}</Badge>
                          <span className="font-medium text-body-sm">{formatCurrency(t.amount)}</span>
                        </div>
                        <p className="text-body-xs text-muted-foreground">{formatDate(t.date)}{t.remark ? ` • ${t.remark}` : ""}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTxnEdit(t)}><Pencil size={12} /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { deleteTransaction(p.id, t.id); toast({ title: "Transaction deleted" }); }}><Trash2 size={12} /></Button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-body-xs text-muted-foreground text-center py-3">No transactions. Total categorized as "Other".</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">No payments found</div>
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {(
                [
                  { label: "", field: null },
                  { label: "Card", field: "cardName" },
                  { label: "Statement", field: "statementDate" },
                  { label: "Due Amount", field: "paymentDue" },
                  { label: "Deadline", field: "paymentDeadline" },
                  { label: "Paid On", field: "paymentPaidOn" },
                  { label: "Paid Amount", field: "paidAmount" },
                  { label: "Status", field: "status" },
                  { label: "Statement File", field: null },
                  { label: "Actions", field: null },
                ] as { label: string; field: PaymentSortField | null }[]
              ).map(({ label, field }) => (
                <th
                  key={label}
                  onClick={field ? () => handlePaymentSort(field) : undefined}
                  className={`px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap ${field ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {field && sortField === field && (
                      sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const displayStatus = computeStatus(p);
              const isExpanded = expandedPayment === p.id;
              const txns = p.transactions || [];
              const undefinedAmt = getUndefinedAmount(p);
              return (
                <Fragment key={p.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedPayment(isExpanded ? null : p.id)}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{p.cardName}</p>
                        <p className="text-body-xs text-muted-foreground">{p.cardId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input type="date" value={p.statementDate} className="h-8 w-[150px] min-w-[150px]"
                        onChange={(e) => { const u = { ...p, statementDate: e.target.value }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                    </td>
                    <td className="px-4 py-3">
                      <Input type="number" value={p.paymentDue} className="h-8 w-[100px]"
                        onChange={(e) => { const u = { ...p, paymentDue: Number(e.target.value) }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                      {(() => {
                        const prev = prevMonthPayment(p);
                        if (!prev || prev.paymentDue === 0) return null;
                        const delta = p.paymentDue - prev.paymentDue;
                        const pct = Math.round((delta / prev.paymentDue) * 100);
                        if (pct === 0) return null;
                        return (
                          <p className={`text-[10px] font-medium flex items-center gap-0.5 mt-0.5 ${delta > 0 ? "text-destructive" : "text-success"}`}>
                            {delta > 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            {Math.abs(pct)}% vs prev
                          </p>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <Input type="date" value={p.paymentDeadline} className="h-8 w-[150px] min-w-[150px]"
                        onChange={(e) => { const u = { ...p, paymentDeadline: e.target.value }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                    </td>
                    <td className="px-4 py-3">
                      {p.installments.length > 0 ? (
                        <button onClick={() => openInstallModal(p)}
                          className="flex items-center gap-1.5 text-body-xs text-primary hover:underline">
                          <Banknote size={13} />
                          {formatDate(p.paymentPaidOn || "")}
                          <span className="text-muted-foreground">({p.installments.length})</span>
                        </button>
                      ) : (
                        <Input type="date" value={p.paymentPaidOn || ""} className="h-8 w-[150px] min-w-[150px]"
                          onChange={(e) => { const u = { ...p, paymentPaidOn: e.target.value || null }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.installments.length > 0 ? (
                        <span className="text-body-sm font-medium">{formatCurrency(p.paidAmount)}</span>
                      ) : (
                        <Input type="number" value={p.paidAmount} className="h-8 w-[100px]"
                          onChange={(e) => { const u = { ...p, paidAmount: Number(e.target.value) }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusStyles[displayStatus]}>{displayStatus}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.statementFileName ? (
                        <a href={p.statementFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-body-xs">
                          <FileText size={14} /> {p.statementFileName}
                        </a>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-body-xs gap-1" disabled={uploadingFor === p.id}
                          onClick={() => { setUploadingFor(p.id); fileInputRef.current?.click(); }}>
                          <Upload size={12} /> {uploadingFor === p.id ? "Uploading..." : "Upload"}
                        </Button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="outline" size="sm" className="h-8 text-body-xs gap-1" onClick={() => openInstallModal(p)}>
                          <Banknote size={13} />
                          Payments{p.installments.length > 0 ? ` (${p.installments.length})` : ""}
                        </Button>
                        {displayStatus !== "Paid" && p.installments.length === 0 && (
                          <Button variant="ghost" size="sm" className="h-8 text-body-xs text-success" onClick={() => handleMarkPaid(p)}>
                            Mark Paid
                          </Button>
                        )}
                        {p.statementFileUrl && (
                          <Button variant="ghost" size="sm" className="h-8 text-body-xs gap-1 text-primary" onClick={() => setChatPayment(p)}>
                            <MessageSquare size={14} /> Ask AI
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${p.id}-txns`} className="border-b border-border bg-muted/10">
                      <td colSpan={10} className="px-8 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-body-sm font-semibold text-foreground">Transactions</h4>
                          <div className="flex items-center gap-3">
                            {undefinedAmt > 0 && (
                              <span className="text-body-xs text-muted-foreground">
                                Unaccounted: <strong className="text-warning">{formatCurrency(undefinedAmt)}</strong>
                              </span>
                            )}
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => openTxnAdd(p.id)}>
                              <Plus size={12} /> Add Transaction
                            </Button>
                          </div>
                        </div>
                        {txns.length > 0 ? (
                          <table className="w-full text-body-xs">
                            <thead>
                              <tr className="border-b border-border">
                                {(
                                  [
                                    { label: "Date", field: "date" },
                                    { label: "Category", field: "category" },
                                    { label: "Amount", field: "amount" },
                                    { label: "Remark", field: "remark" },
                                    { label: "Actions", field: null },
                                  ] as { label: string; field: TxnSortField | null }[]
                                ).map(({ label, field }) => (
                                  <th
                                    key={label}
                                    onClick={field ? () => handleTxnSort(field) : undefined}
                                    className={`px-3 py-2 text-left font-semibold text-muted-foreground ${field ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {label}
                                      {field && txnSortField === field && (
                                        txnSortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                                      )}
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[...txns].sort((a, b) => {
                                const dir = txnSortDir === "asc" ? 1 : -1;
                                const av = (a[txnSortField] ?? "") as string | number;
                                const bv = (b[txnSortField] ?? "") as string | number;
                                if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
                                return ((av as number) - (bv as number)) * dir;
                              }).map((t) => (
                                <tr key={t.id} className="border-b border-border last:border-0">
                                  <td className="px-3 py-2">{formatDate(t.date)}</td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="text-body-xs">{t.category}</Badge>
                                  </td>
                                  <td className="px-3 py-2">{formatCurrency(t.amount)}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{t.remark || "—"}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTxnEdit(t)}>
                                        <Pencil size={12} />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { deleteTransaction(p.id, t.id); toast({ title: "Transaction deleted" }); }}>
                                        <Trash2 size={12} />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {undefinedAmt > 0 && (
                                <tr className="bg-warning/5">
                                  <td className="px-3 py-2 text-muted-foreground">—</td>
                                  <td className="px-3 py-2"><Badge variant="outline" className="text-body-xs">Other</Badge></td>
                                  <td className="px-3 py-2 font-medium text-warning">{formatCurrency(undefinedAmt)}</td>
                                  <td className="px-3 py-2 text-muted-foreground italic">Unaccounted amount</td>
                                  <td className="px-3 py-2" />
                                </tr>
                              )}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-body-xs text-muted-foreground py-4 text-center">
                            No transactions defined. Total amount ({formatCurrency(p.paymentDue)}) categorized as "Other".
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">No payments found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingFor) handleFileUpload(uploadingFor, file);
          e.target.value = "";
        }}
      />

      {/* Add/Edit Payment Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment" : "Add Payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Card *</Label>
              <select value={form.cardId} onChange={(e) => handleCardSelectInModal(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-body-sm text-foreground">
                <option value="">Select card</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.cardName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statement Date *</Label>
                <Input type="date" value={form.statementDate} onChange={(e) => setField("statementDate", e.target.value)} />
                {form.statementDate && form.cardId && (() => {
                  const card = cards.find((c) => c.id === form.cardId);
                  if (!card) return null;
                  const day = new Date(form.statementDate).getDate();
                  if (day !== card.billGenerationDay) {
                    return (
                      <p className="text-[11px] text-warning flex items-center gap-1 mt-1">
                        <AlertTriangle size={11} />
                        Card bills on day {card.billGenerationDay}, not day {day}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="space-y-2">
                <Label>Payment Deadline</Label>
                <Input type="date" value={form.paymentDeadline} onChange={(e) => setField("paymentDeadline", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Due (₹)</Label>
                <Input type="number" min="0" value={form.paymentDue} onChange={(e) => setField("paymentDue", Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Paid Amount (₹)</Label>
                <Input type="number" min="0" value={form.paidAmount} onChange={(e) => setField("paidAmount", Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Paid On</Label>
              <Input type="date" value={form.paymentPaidOn || ""} onChange={(e) => setField("paymentPaidOn", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Optional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingPayment ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Modal */}
      <Dialog open={txnModalOpen} onOpenChange={setTxnModalOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTxn ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={txnForm.date} onChange={(e) => setTxnForm((prev) => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select value={txnForm.category} onChange={(e) => setTxnForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-input bg-card px-3 text-body-sm text-foreground">
                  {TRANSACTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹) *</Label>
              <Input type="number" min="0" value={txnForm.amount} onChange={(e) => setTxnForm((prev) => ({ ...prev, amount: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Remark</Label>
              <Input value={txnForm.remark} onChange={(e) => setTxnForm((prev) => ({ ...prev, remark: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxnModalOpen(false)}>Cancel</Button>
            <Button onClick={handleTxnSave}>{editingTxn ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement AI Chat */}
      {chatPayment && (
        <StatementChat payment={chatPayment} onClose={() => setChatPayment(null)} />
      )}

      {/* Payment Installments Modal */}
      {(() => {
        // Always read the freshest copy from the payments store
        const livePayment = payments.find((p) => p.id === installModalPayment?.id) ?? installModalPayment;
        const installments = livePayment?.installments ?? [];
        const totalPaid = installments.reduce((s, i) => s + i.amount, 0);
        const remaining = Math.max(0, (livePayment?.paymentDue ?? 0) - totalPaid);
        return (
          <Dialog open={!!installModalPayment} onOpenChange={(open) => { if (!open) { setInstallModalPayment(null); setEditingInstall(null); setInstallForm({ date: "", amount: 0, note: "" }); } }}>
            <DialogContent className="w-full max-w-[95vw] sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Banknote size={18} className="text-primary" />
                  Payment Installments
                  {livePayment && <span className="text-muted-foreground font-normal text-sm">— {livePayment.cardName}</span>}
                </DialogTitle>
              </DialogHeader>

              {/* Summary bar */}
              {livePayment && (
                <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 px-4 py-3 text-body-sm">
                  <div>
                    <p className="text-body-xs text-muted-foreground">Due</p>
                    <p className="font-semibold">{formatCurrency(livePayment.paymentDue)}</p>
                  </div>
                  <div>
                    <p className="text-body-xs text-muted-foreground">Paid</p>
                    <p className="font-semibold text-success">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-body-xs text-muted-foreground">Remaining</p>
                    <p className={`font-semibold ${remaining > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(remaining)}</p>
                  </div>
                  <div>
                    <p className="text-body-xs text-muted-foreground">Installments</p>
                    <p className="font-semibold">{installments.length}</p>
                  </div>
                </div>
              )}

              {/* Installments list */}
              {installments.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-body-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        {["Date", "Amount", "Note", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...installments].sort((a, b) => a.date.localeCompare(b.date)).map((inst) => (
                        <tr key={inst.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(inst.date)}</td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(inst.amount)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{inst.note || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => { setEditingInstall(inst); setInstallForm({ date: inst.date, amount: inst.amount, note: inst.note }); }}>
                                <Pencil size={11} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                onClick={() => { if (livePayment) { deleteInstallment(livePayment.id, inst.id); toast({ title: "Installment removed" }); } }}>
                                <Trash2 size={11} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-body-xs text-muted-foreground text-center py-4 rounded-lg border border-border border-dashed">
                  No installments yet. Add the first payment below.
                </p>
              )}

              {/* Add / Edit form */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-body-xs font-semibold text-foreground">
                  {editingInstall ? "Edit Installment" : "Add Installment"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-body-xs">Date *</Label>
                    <Input type="date" value={installForm.date}
                      onChange={(e) => setInstallForm((f) => ({ ...f, date: e.target.value }))} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-body-xs">Amount (₹) *</Label>
                    <Input type="number" min="0" value={installForm.amount || ""}
                      onChange={(e) => setInstallForm((f) => ({ ...f, amount: Number(e.target.value) }))} className="h-8" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-body-xs">Note</Label>
                  <Input value={installForm.note} placeholder="e.g. Partial payment, NEFT…"
                    onChange={(e) => setInstallForm((f) => ({ ...f, note: e.target.value }))} className="h-8" />
                </div>
                <div className="flex gap-2 justify-end">
                  {editingInstall && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingInstall(null); setInstallForm({ date: "", amount: 0, note: "" }); }}>
                      Cancel Edit
                    </Button>
                  )}
                  <Button size="sm" onClick={handleInstallSave}>
                    {editingInstall ? "Update" : "Add Installment"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Delete Confirmation */}
      {(() => {
        const paymentToDelete = payments.find((p) => p.id === deleteId);
        const linkedTxnCount = paymentToDelete?.transactions?.length ?? 0;
        return (
          <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                {linkedTxnCount > 0 ? (
                  <AlertDialogDescription className="text-destructive font-medium">
                    Cannot delete this payment. It has {linkedTxnCount} transaction{linkedTxnCount !== 1 ? "s" : ""} linked to it.
                    Please delete those transactions first before removing this payment.
                  </AlertDialogDescription>
                ) : (
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{linkedTxnCount > 0 ? "OK" : "Cancel"}</AlertDialogCancel>
                {linkedTxnCount === 0 && (
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </div>
  );
};

export default PaymentDetails;
