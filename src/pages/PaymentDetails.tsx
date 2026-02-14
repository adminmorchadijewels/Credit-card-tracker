import { useState } from "react";
import { useStore } from "@/data/store";
import { Payment } from "@/types";
import { formatCurrency, formatDate, generateId } from "@/utils/formatters";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
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

const statusStyles: Record<string, string> = {
  Paid: "bg-success text-success-foreground",
  Pending: "bg-warning text-warning-foreground",
  Overdue: "bg-overdue text-overdue-foreground",
};

const PaymentDetails = () => {
  const { cards, payments, addPayment, updatePayment, deletePayment } = useStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cardFilter, setCardFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const emptyPayment: Payment = {
    id: generateId(),
    cardId: cards[0]?.id || "",
    cardName: cards[0]?.cardName || "",
    statementDate: "",
    paymentDue: 0,
    paymentDeadline: "",
    paymentPaidOn: null,
    paidAmount: 0,
    status: "Pending",
    notes: "",
  };

  const [form, setForm] = useState<Payment>(emptyPayment);

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.cardName.toLowerCase().includes(q) || p.cardId.toLowerCase().includes(q);
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchCard = !cardFilter || p.cardId === cardFilter;
    return matchSearch && matchStatus && matchCard;
  }).sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime());

  const openAdd = () => {
    setEditingPayment(null);
    setForm({ ...emptyPayment, id: generateId() });
    setModalOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditingPayment(p);
    setForm({ ...p });
    setModalOpen(true);
  };

  const computeStatus = (f: Payment): Payment["status"] => {
    if (f.paidAmount > 0 && f.paidAmount >= f.paymentDue) return "Paid";
    if (f.paymentDeadline && new Date(f.paymentDeadline) < new Date()) return "Overdue";
    return "Pending";
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading text-foreground">Payment Details</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">{payments.length} payment records</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} /> Add Payment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-card px-3 text-body-sm text-foreground"
        >
          <option value="">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>
        <select
          value={cardFilter}
          onChange={(e) => setCardFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-card px-3 text-body-sm text-foreground"
        >
          <option value="">All Cards</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.cardName}</option>)}
        </select>
        {(search || statusFilter || cardFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); setCardFilter(""); }}>
            <X size={14} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Card", "Statement", "Due Amount", "Deadline", "Paid On", "Paid Amount", "Status", "Notes", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const displayStatus = computeStatus(p);
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{p.cardName}</p>
                      <p className="text-body-xs text-muted-foreground">{p.cardId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Input type="date" value={p.statementDate} className="h-8 w-[130px]"
                      onChange={(e) => updatePayment({ ...p, statementDate: e.target.value, status: computeStatus({ ...p, statementDate: e.target.value }) })} />
                  </td>
                  <td className="px-4 py-3">
                    <Input type="number" value={p.paymentDue} className="h-8 w-[100px]"
                      onChange={(e) => {
                        const updated = { ...p, paymentDue: Number(e.target.value) };
                        updatePayment({ ...updated, status: computeStatus(updated) });
                      }} />
                  </td>
                  <td className="px-4 py-3">
                    <Input type="date" value={p.paymentDeadline} className="h-8 w-[130px]"
                      onChange={(e) => {
                        const updated = { ...p, paymentDeadline: e.target.value };
                        updatePayment({ ...updated, status: computeStatus(updated) });
                      }} />
                  </td>
                  <td className="px-4 py-3">
                    <Input type="date" value={p.paymentPaidOn || ""} className="h-8 w-[130px]"
                      onChange={(e) => {
                        const updated = { ...p, paymentPaidOn: e.target.value || null };
                        updatePayment({ ...updated, status: computeStatus(updated) });
                      }} />
                  </td>
                  <td className="px-4 py-3">
                    <Input type="number" value={p.paidAmount} className="h-8 w-[100px]"
                      onChange={(e) => {
                        const updated = { ...p, paidAmount: Number(e.target.value) };
                        updatePayment({ ...updated, status: computeStatus(updated) });
                      }} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusStyles[displayStatus]}>{displayStatus}</Badge>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">No payments found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment" : "Add Payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Card *</Label>
              <select
                value={form.cardId}
                onChange={(e) => {
                  const card = cards.find((c) => c.id === e.target.value);
                  setForm((prev) => ({ ...prev, cardId: e.target.value, cardName: card?.cardName || "" }));
                }}
                className="w-full h-10 rounded-lg border border-input bg-card px-3 text-body-sm text-foreground"
              >
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaymentDetails;
