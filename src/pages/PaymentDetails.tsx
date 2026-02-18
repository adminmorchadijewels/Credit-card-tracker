import { useState, useRef } from "react";
import { useStore } from "@/data/store";
import { Payment, Transaction } from "@/types";
import { formatCurrency, formatDate, generateId } from "@/utils/formatters";
import { Plus, Pencil, Trash2, Search, X, Upload, FileText, ChevronDown, ChevronUp, Download, FileDown } from "lucide-react";
import {
  exportPaymentsCSV,
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
  const { cards, payments, addPayment, updatePayment, deletePayment, addTransaction, updateTransaction, deleteTransaction, loading } = useStore();
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

  const [form, setForm] = useState<Payment>({
    id: generateId(), cardId: "", cardName: "",
    statementDate: "", paymentDue: 0, paymentDeadline: "", paymentPaidOn: null,
    paidAmount: 0, status: "Pending", notes: "", transactions: [],
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

  const emptyPayment: Payment = {
    id: generateId(), cardId: cards[0]?.id || "", cardName: cards[0]?.cardName || "",
    statementDate: "", paymentDue: 0, paymentDeadline: "", paymentPaidOn: null,
    paidAmount: 0, status: "Pending", notes: "", transactions: [],
  };

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.cardName.toLowerCase().includes(q) || p.cardId.toLowerCase().includes(q);
    const matchStatus = !statusFilter || computeStatus(p) === statusFilter;
    const matchCard = !cardFilter || p.cardId === cardFilter;
    return matchSearch && matchStatus && matchCard;
  }).sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime());

  function computeStatus(f: Payment): Payment["status"] {
    if (f.paidAmount > 0 && f.paidAmount >= f.paymentDue) return "Paid";
    if (f.paymentDeadline && new Date(f.paymentDeadline) < new Date()) return "Overdue";
    return "Pending";
  }

  const openAdd = () => {
    setEditingPayment(null);
    setForm({ id: generateId(), cardId: cards[0]?.id || "", cardName: cards[0]?.cardName || "",
      statementDate: "", paymentDue: 0, paymentDeadline: "", paymentPaidOn: null,
      paidAmount: 0, status: "Pending", notes: "", transactions: [] });
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
          updatePayment(p);
          updated++;
        } else {
          addPayment(p);
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 w-full sm:w-auto rounded-lg border border-input bg-card px-3 text-body-sm text-foreground">
          <option value="">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>
        <select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} className="h-10 w-full sm:w-auto rounded-lg border border-input bg-card px-3 text-body-sm text-foreground">
          <option value="">All Cards</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.cardName}</option>)}
        </select>
        {(search || statusFilter || cardFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); setCardFilter(""); }}>
            <X size={14} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {filtered.map((p) => {
          const displayStatus = computeStatus(p);
          const isExpanded = expandedPayment === p.id;
          const txns = p.transactions || [];
          const undefinedAmt = getUndefinedAmount(p);
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
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
                    <Input type="number" value={p.paidAmount} className="h-8 mt-0.5"
                      onChange={(e) => { const u = { ...p, paidAmount: Number(e.target.value) }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                  </div>
                  <div className="col-span-2">
                    <p className="text-body-xs text-muted-foreground">Paid On</p>
                    <Input type="date" value={p.paymentPaidOn || ""} className="h-8 mt-0.5"
                      onChange={(e) => { const u = { ...p, paymentPaidOn: e.target.value || null }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                  {displayStatus !== "Paid" && (
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
                  {txns.length > 0 ? txns.map((t) => (
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
              {["", "Card", "Statement", "Due Amount", "Deadline", "Paid On", "Paid Amount", "Status", "Statement File", "Notes", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
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
                <>
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
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
                    </td>
                    <td className="px-4 py-3">
                      <Input type="date" value={p.paymentDeadline} className="h-8 w-[150px] min-w-[150px]"
                        onChange={(e) => { const u = { ...p, paymentDeadline: e.target.value }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                    </td>
                    <td className="px-4 py-3">
                      <Input type="date" value={p.paymentPaidOn || ""} className="h-8 w-[150px] min-w-[150px]"
                        onChange={(e) => { const u = { ...p, paymentPaidOn: e.target.value || null }; updatePayment({ ...u, status: computeStatus(u) }); }} />
                    </td>
                    <td className="px-4 py-3">
                      <Input type="number" value={p.paidAmount} className="h-8 w-[100px]"
                        onChange={(e) => { const u = { ...p, paidAmount: Number(e.target.value) }; updatePayment({ ...u, status: computeStatus(u) }); }} />
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
                      <Input value={p.notes} className="h-8 w-[120px]" placeholder="—"
                        onChange={(e) => updatePayment({ ...p, notes: e.target.value })} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {displayStatus !== "Paid" && (
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
                      <td colSpan={11} className="px-8 py-4">
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
                                {["Date", "Category", "Amount", "Remark", "Actions"].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {txns.map((t) => (
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
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="py-12 text-center text-muted-foreground">No payments found</td></tr>
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
              <select value={form.cardId} onChange={(e) => { const card = cards.find((c) => c.id === e.target.value); setForm((prev) => ({ ...prev, cardId: e.target.value, cardName: card?.cardName || "" })); }}
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-body-sm text-foreground">
                <option value="">Select card</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.cardName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statement Date *</Label>
                <Input type="date" value={form.statementDate} onChange={(e) => setField("statementDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Deadline</Label>
                <Input type="date" value={form.paymentDeadline} onChange={(e) => setField("paymentDeadline", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Due (₹)</Label>
                <Input type="number" value={form.paymentDue} onChange={(e) => setField("paymentDue", Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Paid Amount (₹)</Label>
                <Input type="number" value={form.paidAmount} onChange={(e) => setField("paidAmount", Number(e.target.value))} />
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
              <Input type="number" value={txnForm.amount} onChange={(e) => setTxnForm((prev) => ({ ...prev, amount: Number(e.target.value) }))} />
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
