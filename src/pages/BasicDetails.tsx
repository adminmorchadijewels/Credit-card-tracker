import { useState, useRef } from "react";
import { useStore } from "@/data/store";
import { CreditCard, TargetMilestone } from "@/types";
import { formatCurrency, generateId } from "@/utils/formatters";
import { Plus, Pencil, Trash2, Search, X, Download, Upload, FileDown, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  exportCardsCSV,
  downloadCardsSample,
  importCardsCSV,
} from "@/lib/import-export";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/RichTextEditor";

const emptyCard: CreditCard = {
  id: "", parentId: "", cardName: "", cardStatus: "Active", ownedBy: "",
  bank: "", customerCare: "", billGenerationDay: 1, billPaymentDate: 20,
  limitShared: false, milestoneRewards: "", generalRewards: "",
  targetMilestones: [{ spend: 0, reward: "" }],
  annualCharges: 0, registeredNo: "", email: "",
  annualCycleReset: "", cardLimit: 0, rewardPointsExpiryDays: 365,
};

const BasicDetails = () => {
  const { cards, payments, addCard, updateCard, deleteCard, loading } = useStore();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [form, setForm] = useState<CreditCard>({ ...emptyCard, id: generateId() });
  const [bankFilter, setBankFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  type CardSortField = "cardName" | "bank" | "ownedBy" | "cardStatus" | "cardLimit" | "topTarget" | "rewardPointsExpiryDays" | "billGenerationDay" | "billPaymentDate";
  const [sortField, setSortField] = useState<CardSortField>("cardName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const handleCardSort = (field: CardSortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

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

  const filtered = cards.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || c.cardName.toLowerCase().includes(q) || c.bank.toLowerCase().includes(q) || c.ownedBy.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    const matchesBank = !bankFilter || c.bank === bankFilter;
    const matchesStatus = showInactive || c.cardStatus === "Active";
    return matchesSearch && matchesBank && matchesStatus;
  });

  const banks = [...new Set(cards.map((c) => c.bank))];

  const openAdd = () => {
    setEditingCard(null);
    setForm({ ...emptyCard, id: generateId() });
    setModalOpen(true);
  };

  const openEdit = (card: CreditCard) => {
    setEditingCard(card);
    setForm({ ...card });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.cardName.trim() || !form.bank.trim()) {
      toast({ title: "Validation Error", description: "Card Name and Bank are required.", variant: "destructive" });
      return;
    }
    if (editingCard) {
      updateCard(form);
      toast({ title: "Card updated successfully" });
    } else {
      addCard(form);
      toast({ title: "Card added successfully" });
    }
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteCard(deleteId);
      toast({ title: "Card deleted" });
      setDeleteId(null);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const { cards: imported, errors } = importCardsCSV(csv);
      if (errors.length > 0) {
        toast({ title: "Import errors", description: errors.join("\n"), variant: "destructive" });
      }
      let added = 0, updated = 0;
      const existingIds = new Set(cards.map((c) => c.id));
      imported.forEach((card) => {
        if (existingIds.has(card.id)) {
          updateCard(card);
          updated++;
        } else {
          addCard(card);
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

  const setField = (key: keyof CreditCard, value: CreditCard[keyof CreditCard]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateMilestone = (index: number, field: keyof TargetMilestone, value: string | number) => {
    setForm((prev) => {
      const milestones = [...(prev.targetMilestones || [])];
      milestones[index] = { ...milestones[index], [field]: value };
      return { ...prev, targetMilestones: milestones };
    });
  };

  const addMilestone = () => {
    setForm((prev) => ({
      ...prev,
      targetMilestones: [...(prev.targetMilestones || []), { spend: 0, reward: "" }],
    }));
  };

  const removeMilestone = (index: number) => {
    setForm((prev) => ({
      ...prev,
      targetMilestones: (prev.targetMilestones || []).filter((_, i) => i !== index),
    }));
  };

  const getTopTarget = (card: CreditCard) => {
    const milestones = card.targetMilestones || [];
    if (milestones.length === 0) return "—";
    const top = milestones.reduce((max, m) => m.spend > max.spend ? m : max, milestones[0]);
    return formatCurrency(top.spend);
  };

  const getTopTargetValue = (card: CreditCard) => {
    const milestones = card.targetMilestones || [];
    if (milestones.length === 0) return 0;
    return milestones.reduce((max, m) => m.spend > max ? m.spend : max, 0);
  };

  const sortedFiltered = [...filtered].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    if (sortField === "topTarget") {
      aVal = getTopTargetValue(a);
      bVal = getTopTargetValue(b);
    } else {
      aVal = a[sortField as keyof CreditCard] as string | number;
      bVal = b[sortField as keyof CreditCard] as string | number;
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading text-foreground">Basic Details</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {cards.filter((c) => c.cardStatus === "Active").length} active · {cards.length} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCardsCSV(cards)}>
            <Download size={14} /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadCardsSample}>
            <FileDown size={14} /> Sample CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => importRef.current?.click()}>
            <Upload size={14} /> Import CSV
          </Button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button onClick={openAdd} className="gap-2">
            <Plus size={16} /> Add New Card
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search cards..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="h-10 w-full sm:w-auto rounded-lg border border-input bg-card px-3 text-body-sm text-foreground">
          <option value="">All Banks</option>
          {banks.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="inline-flex shrink-0 items-center rounded-full border border-input bg-muted p-0.5 gap-0.5">
          <button
            onClick={() => setShowInactive(false)}
            className={[
              "rounded-full px-3 py-1.5 text-body-xs font-medium transition-all duration-200",
              !showInactive ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Active
          </button>
          <button
            onClick={() => setShowInactive(true)}
            className={[
              "rounded-full px-3 py-1.5 text-body-xs font-medium transition-all duration-200",
              showInactive ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            All
          </button>
        </div>
        {(search || bankFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setBankFilter(""); }}>
            <X size={14} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {sortedFiltered.map((card) => (
          <div key={card.id} className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{card.cardName}</p>
                <p className="text-body-xs text-muted-foreground">{card.bank} • {card.ownedBy}</p>
              </div>
              <Badge variant={card.cardStatus === "Active" ? "default" : "secondary"} className={card.cardStatus === "Active" ? "bg-success text-success-foreground" : ""}>
                {card.cardStatus}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-body-sm">
              <div>
                <p className="text-body-xs text-muted-foreground">Limit</p>
                <p className="font-medium">{formatCurrency(card.cardLimit)}</p>
              </div>
              <div>
                <p className="text-body-xs text-muted-foreground">Top Target</p>
                <p className="font-medium">{getTopTarget(card)}</p>
              </div>
              <div>
                <p className="text-body-xs text-muted-foreground">Bill Gen / Pay</p>
                <p className="font-medium">{card.billGenerationDay} / {card.billPaymentDate}</p>
              </div>
              <div>
                <p className="text-body-xs text-muted-foreground">Expiry (days)</p>
                <p className="font-medium">{card.rewardPointsExpiryDays}</p>
              </div>
            </div>
            <div className="flex gap-1 pt-1">
              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(card)}>
                <Pencil size={14} /> Edit
              </Button>
              <Button variant="outline" size="sm" className="text-destructive gap-1" onClick={() => setDeleteId(card.id)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
        {sortedFiltered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">No cards found</div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {(
                [
                  { label: "Card ID", field: null },
                  { label: "Card Name", field: "cardName" },
                  { label: "Bank", field: "bank" },
                  { label: "Owner", field: "ownedBy" },
                  { label: "Status", field: "cardStatus" },
                  { label: "Limit", field: "cardLimit" },
                  { label: "Top Target", field: "topTarget" },
                  { label: "Expiry (days)", field: "rewardPointsExpiryDays" },
                  { label: "Bill Gen Day", field: "billGenerationDay" },
                  { label: "Bill Pay Day", field: "billPaymentDate" },
                  { label: "Actions", field: null },
                ] as { label: string; field: CardSortField | null }[]
              ).map(({ label, field }) => (
                <th
                  key={label}
                  onClick={field ? () => handleCardSort(field) : undefined}
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
            {sortedFiltered.map((card) => (
              <tr key={card.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-body-xs">{card.id}</td>
                <td className="px-4 py-3 font-medium">{card.cardName}</td>
                <td className="px-4 py-3">{card.bank}</td>
                <td className="px-4 py-3">{card.ownedBy}</td>
                <td className="px-4 py-3">
                  <Badge variant={card.cardStatus === "Active" ? "default" : "secondary"} className={card.cardStatus === "Active" ? "bg-success text-success-foreground" : ""}>
                    {card.cardStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(card.cardLimit)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{getTopTarget(card)}</td>
                <td className="px-4 py-3 text-center">{card.rewardPointsExpiryDays}</td>
                <td className="px-4 py-3 text-center">{card.billGenerationDay}</td>
                <td className="px-4 py-3 text-center">{card.billPaymentDate}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(card)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(card.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedFiltered.length === 0 && (
              <tr><td colSpan={11} className="py-12 text-center text-muted-foreground">No cards found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Card" : "Add New Card"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Card ID</Label>
              <Input value={form.id} onChange={(e) => setField("id", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Card Name *</Label>
              <Input value={form.cardName} onChange={(e) => setField("cardName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Parent ID</Label>
              <Input value={form.parentId} onChange={(e) => setField("parentId", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bank *</Label>
              <Input value={form.bank} onChange={(e) => setField("bank", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Owned By</Label>
              <Input value={form.ownedBy} onChange={(e) => setField("ownedBy", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Customer Care</Label>
              <Input value={form.customerCare} onChange={(e) => setField("customerCare", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Registered No.</Label>
              <Input value={form.registeredNo} onChange={(e) => setField("registeredNo", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Card Limit (₹)</Label>
              <Input type="number" value={form.cardLimit} onChange={(e) => setField("cardLimit", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Reward Points Expiry (days)</Label>
              <Input type="number" value={form.rewardPointsExpiryDays} onChange={(e) => setField("rewardPointsExpiryDays", Number(e.target.value))} placeholder="e.g. 365" />
            </div>
            <div className="space-y-2">
              <Label>Annual Charges (₹)</Label>
              <Input type="number" value={form.annualCharges} onChange={(e) => setField("annualCharges", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Bill Generation Day</Label>
              <Input type="number" min={1} max={31} value={form.billGenerationDay} onChange={(e) => setField("billGenerationDay", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Bill Payment Day</Label>
              <Input type="number" min={1} max={31} value={form.billPaymentDate} onChange={(e) => setField("billPaymentDate", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Annual Cycle Reset</Label>
              <Input type="date" value={form.annualCycleReset} onChange={(e) => setField("annualCycleReset", e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.cardStatus === "Active"} onCheckedChange={(v) => setField("cardStatus", v ? "Active" : "Inactive")} />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.limitShared} onCheckedChange={(v) => setField("limitShared", v)} />
              <Label>Limit Shared</Label>
            </div>

            {/* Target Milestones */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Target Milestones</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMilestone} className="gap-1">
                  <Plus size={14} /> Add Level
                </Button>
              </div>
              {(form.targetMilestones || []).map((m, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-body-xs">Spend (₹)</Label>
                    <Input type="number" value={m.spend} onChange={(e) => updateMilestone(i, "spend", Number(e.target.value))} />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <Label className="text-body-xs">Reward</Label>
                    <Input value={m.reward} onChange={(e) => updateMilestone(i, "reward", e.target.value)} placeholder="e.g. 5X points + lounge access" />
                  </div>
                  {(form.targetMilestones || []).length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive mt-5" onClick={() => removeMilestone(i)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Rich Text Editors */}
            <div className="col-span-2 space-y-2">
              <Label>Milestone Rewards</Label>
              <RichTextEditor value={form.milestoneRewards} onChange={(v) => setField("milestoneRewards", v)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>General Rewards</Label>
              <RichTextEditor value={form.generalRewards} onChange={(v) => setField("generalRewards", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCard ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      {(() => {
        const linkedPaymentsCount = payments.filter((p) => p.cardId === deleteId).length;
        return (
          <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Card?</AlertDialogTitle>
                {linkedPaymentsCount > 0 ? (
                  <AlertDialogDescription className="text-destructive font-medium">
                    Cannot delete this card. It has {linkedPaymentsCount} payment record{linkedPaymentsCount !== 1 ? "s" : ""} linked to it.
                    Please delete those payments first before removing this card.
                  </AlertDialogDescription>
                ) : (
                  <AlertDialogDescription>This will permanently delete this card and cannot be undone.</AlertDialogDescription>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{linkedPaymentsCount > 0 ? "OK" : "Cancel"}</AlertDialogCancel>
                {linkedPaymentsCount === 0 && (
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

export default BasicDetails;
