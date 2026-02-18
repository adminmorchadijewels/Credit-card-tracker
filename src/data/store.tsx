import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CreditCard, Payment, Transaction } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface StoreContextType {
  cards: CreditCard[];
  payments: Payment[];
  loading: boolean;
  addCard: (card: CreditCard) => void;
  updateCard: (card: CreditCard) => void;
  deleteCard: (id: string) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (payment: Payment) => void;
  deletePayment: (id: string) => void;
  addTransaction: (paymentId: string, transaction: Transaction) => void;
  updateTransaction: (paymentId: string, transaction: Transaction) => void;
  deleteTransaction: (paymentId: string, transactionId: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

// ── DB row → App model mappers ─────────────────────────────────────────────

function mapDbCard(row: Record<string, unknown>): CreditCard {
  return {
    id: row.id as string,
    parentId: (row.parent_id as string) || "",
    cardName: row.card_name as string,
    cardStatus: (row.card_status as "Active" | "Inactive") || "Active",
    ownedBy: (row.owned_by as string) || "",
    bank: row.bank as string,
    customerCare: (row.customer_care as string) || "",
    billGenerationDay: (row.bill_generation_day as number) || 1,
    billPaymentDate: (row.bill_payment_date as number) || 20,
    limitShared: (row.limit_shared as boolean) || false,
    milestoneRewards: (row.milestone_rewards as string) || "",
    generalRewards: (row.general_rewards as string) || "",
    targetMilestones: (row.target_milestones as { spend: number; reward: string }[]) || [],
    annualCharges: (row.annual_charges as number) || 0,
    registeredNo: (row.registered_no as string) || "",
    email: (row.email as string) || "",
    annualCycleReset: (row.annual_cycle_reset as string) || "",
    cardLimit: (row.card_limit as number) || 0,
    rewardPointsExpiryDays: (row.reward_points_expiry_days as number) || 365,
  };
}

function mapDbPayment(row: Record<string, unknown>, txns: Transaction[]): Payment {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    cardName: row.card_name as string,
    statementDate: (row.statement_date as string) || "",
    paymentDue: (row.payment_due as number) || 0,
    paymentDeadline: (row.payment_deadline as string) || "",
    paymentPaidOn: (row.payment_paid_on as string | null) || null,
    paidAmount: (row.paid_amount as number) || 0,
    status: (row.status as "Paid" | "Pending" | "Overdue") || "Pending",
    notes: (row.notes as string) || "",
    statementFileUrl: (row.statement_file_url as string | undefined) || undefined,
    statementFileName: (row.statement_file_name as string | undefined) || undefined,
    transactions: txns,
  };
}

function mapDbTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    paymentId: row.payment_id as string,
    date: row.date as string,
    category: (row.category as string) || "Other",
    amount: (row.amount as number) || 0,
    remark: (row.remark as string) || "",
  };
}

// ── App model → DB insert mappers ─────────────────────────────────────────

function cardToDb(card: CreditCard) {
  return {
    id: card.id,
    parent_id: card.parentId,
    card_name: card.cardName,
    card_status: card.cardStatus,
    owned_by: card.ownedBy,
    bank: card.bank,
    customer_care: card.customerCare,
    bill_generation_day: card.billGenerationDay,
    bill_payment_date: card.billPaymentDate,
    limit_shared: card.limitShared,
    milestone_rewards: card.milestoneRewards,
    general_rewards: card.generalRewards,
    target_milestones: card.targetMilestones,
    annual_charges: card.annualCharges,
    registered_no: card.registeredNo,
    email: card.email,
    annual_cycle_reset: card.annualCycleReset,
    card_limit: card.cardLimit,
    reward_points_expiry_days: card.rewardPointsExpiryDays,
  };
}

function paymentToDb(payment: Payment) {
  return {
    id: payment.id,
    card_id: payment.cardId,
    card_name: payment.cardName,
    statement_date: payment.statementDate,
    payment_due: payment.paymentDue,
    payment_deadline: payment.paymentDeadline,
    payment_paid_on: payment.paymentPaidOn,
    paid_amount: payment.paidAmount,
    status: payment.status,
    notes: payment.notes,
    statement_file_url: payment.statementFileUrl ?? null,
    statement_file_name: payment.statementFileName ?? null,
  };
}

function transactionToDb(txn: Transaction) {
  return {
    id: txn.id,
    payment_id: txn.paymentId,
    date: txn.date,
    category: txn.category,
    amount: txn.amount,
    remark: txn.remark,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all data from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [{ data: cardsData, error: cardsErr }, { data: txnsData, error: txnsErr }, { data: paymentsData, error: paymentsErr }] =
          await Promise.all([
            supabase.from("credit_cards").select("*").order("created_at"),
            supabase.from("transactions").select("*"),
            supabase.from("payments").select("*").order("statement_date", { ascending: false }),
          ]);

        if (cardsErr) throw cardsErr;
        if (paymentsErr) throw paymentsErr;
        if (txnsErr) throw txnsErr;

        const txnsByPayment: Record<string, Transaction[]> = {};
        for (const txn of txnsData ?? []) {
          const t = mapDbTransaction(txn as Record<string, unknown>);
          if (!txnsByPayment[t.paymentId]) txnsByPayment[t.paymentId] = [];
          txnsByPayment[t.paymentId].push(t);
        }

        setCards((cardsData ?? []).map((r) => mapDbCard(r as Record<string, unknown>)));
        setPayments(
          (paymentsData ?? []).map((r) =>
            mapDbPayment(r as Record<string, unknown>, txnsByPayment[(r as { id: string }).id] ?? [])
          )
        );
      } catch (err: unknown) {
        console.error("Failed to load data from Supabase:", err);
        // Silently fall back to empty state – user will see empty lists
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ── Credit card CRUD ────────────────────────────────────────────────────

  const addCard = (card: CreditCard) => {
    setCards((prev) => [...prev, card]);
    supabase
      .from("credit_cards")
      .insert(cardToDb(card))
      .then(({ error }) => {
        if (error) {
          setCards((prev) => prev.filter((c) => c.id !== card.id));
          toast({ title: "Failed to save card", description: error.message, variant: "destructive" });
        }
      });
  };

  const updateCard = (card: CreditCard) => {
    setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    supabase
      .from("credit_cards")
      .update(cardToDb(card))
      .eq("id", card.id)
      .then(({ error }) => {
        if (error) {
          toast({ title: "Failed to update card", description: error.message, variant: "destructive" });
        }
      });
  };

  const deleteCard = (id: string) => {
    const removed = cards.find((c) => c.id === id);
    setCards((prev) => prev.filter((c) => c.id !== id));
    supabase
      .from("credit_cards")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          if (removed) setCards((prev) => [...prev, removed]);
          toast({ title: "Failed to delete card", description: error.message, variant: "destructive" });
        }
      });
  };

  // ── Payment CRUD ────────────────────────────────────────────────────────

  const addPayment = (payment: Payment) => {
    setPayments((prev) => [payment, ...prev]);
    supabase
      .from("payments")
      .insert(paymentToDb(payment))
      .then(({ error }) => {
        if (error) {
          setPayments((prev) => prev.filter((p) => p.id !== payment.id));
          toast({ title: "Failed to save payment", description: error.message, variant: "destructive" });
        }
      });
  };

  const updatePayment = (payment: Payment) => {
    setPayments((prev) => prev.map((p) => (p.id === payment.id ? payment : p)));
    supabase
      .from("payments")
      .update(paymentToDb(payment))
      .eq("id", payment.id)
      .then(({ error }) => {
        if (error) {
          toast({ title: "Failed to update payment", description: error.message, variant: "destructive" });
        }
      });
  };

  const deletePayment = (id: string) => {
    const removed = payments.find((p) => p.id === id);
    setPayments((prev) => prev.filter((p) => p.id !== id));
    supabase
      .from("payments")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          if (removed) setPayments((prev) => [removed, ...prev]);
          toast({ title: "Failed to delete payment", description: error.message, variant: "destructive" });
        }
      });
  };

  // ── Transaction CRUD ────────────────────────────────────────────────────

  const addTransaction = (paymentId: string, transaction: Transaction) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId ? { ...p, transactions: [...(p.transactions || []), transaction] } : p
      )
    );
    supabase
      .from("transactions")
      .insert(transactionToDb(transaction))
      .then(({ error }) => {
        if (error) {
          setPayments((prev) =>
            prev.map((p) =>
              p.id === paymentId
                ? { ...p, transactions: (p.transactions || []).filter((t) => t.id !== transaction.id) }
                : p
            )
          );
          toast({ title: "Failed to save transaction", description: error.message, variant: "destructive" });
        }
      });
  };

  const updateTransaction = (paymentId: string, transaction: Transaction) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, transactions: (p.transactions || []).map((t) => (t.id === transaction.id ? transaction : t)) }
          : p
      )
    );
    supabase
      .from("transactions")
      .update(transactionToDb(transaction))
      .eq("id", transaction.id)
      .then(({ error }) => {
        if (error) {
          toast({ title: "Failed to update transaction", description: error.message, variant: "destructive" });
        }
      });
  };

  const deleteTransaction = (paymentId: string, transactionId: string) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? { ...p, transactions: (p.transactions || []).filter((t) => t.id !== transactionId) }
          : p
      )
    );
    supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .then(({ error }) => {
        if (error) {
          toast({ title: "Failed to delete transaction", description: error.message, variant: "destructive" });
        }
      });
  };

  return (
    <StoreContext.Provider
      value={{
        cards,
        payments,
        loading,
        addCard,
        updateCard,
        deleteCard,
        addPayment,
        updatePayment,
        deletePayment,
        addTransaction,
        updateTransaction,
        deleteTransaction,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
