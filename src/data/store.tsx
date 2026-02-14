import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CreditCard, Payment } from "@/types";
import { sampleCards, samplePayments } from "./sampleData";

interface StoreContextType {
  cards: CreditCard[];
  payments: Payment[];
  addCard: (card: CreditCard) => void;
  updateCard: (card: CreditCard) => void;
  deleteCard: (id: string) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (payment: Payment) => void;
  deletePayment: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [cards, setCards] = useState<CreditCard[]>(() => loadFromStorage("cc_cards", sampleCards));
  const [payments, setPayments] = useState<Payment[]>(() => loadFromStorage("cc_payments", samplePayments));

  useEffect(() => { localStorage.setItem("cc_cards", JSON.stringify(cards)); }, [cards]);
  useEffect(() => { localStorage.setItem("cc_payments", JSON.stringify(payments)); }, [payments]);

  const addCard = (card: CreditCard) => setCards((prev) => [...prev, card]);
  const updateCard = (card: CreditCard) => setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
  const deleteCard = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));

  const addPayment = (payment: Payment) => setPayments((prev) => [...prev, payment]);
  const updatePayment = (payment: Payment) => setPayments((prev) => prev.map((p) => (p.id === payment.id ? payment : p)));
  const deletePayment = (id: string) => setPayments((prev) => prev.filter((p) => p.id !== id));

  return (
    <StoreContext.Provider value={{ cards, payments, addCard, updateCard, deleteCard, addPayment, updatePayment, deletePayment }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
