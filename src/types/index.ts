export interface CreditCard {
  id: string;
  parentId: string;
  cardName: string;
  cardStatus: "Active" | "Inactive";
  ownedBy: string;
  bank: string;
  customerCare: string;
  billGenerationDay: number;
  billPaymentDate: number;
  limitShared: boolean;
  milestoneRewards: string;
  generalRewards: string;
  targetSpend: number;
  annualCharges: number;
  registeredNo: string;
  email: string;
  annualCycleReset: string;
  cardLimit: number;
  rewardPointsExpiry: string;
}

export interface Payment {
  id: string;
  cardId: string;
  cardName: string;
  statementDate: string;
  paymentDue: number;
  paymentDeadline: string;
  paymentPaidOn: string | null;
  paidAmount: number;
  status: "Paid" | "Pending" | "Overdue";
  notes: string;
}

export type PaymentStatus = Payment["status"];
export type CardStatus = CreditCard["cardStatus"];
