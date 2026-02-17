export interface TargetMilestone {
  spend: number;
  reward: string;
}

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
  targetMilestones: TargetMilestone[];
  annualCharges: number;
  registeredNo: string;
  email: string;
  annualCycleReset: string;
  cardLimit: number;
  rewardPointsExpiryDays: number;
}

export interface Transaction {
  id: string;
  paymentId: string;
  date: string;
  category: string;
  amount: number;
  remark: string;
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
  statementFileUrl?: string;
  statementFileName?: string;
  transactions: Transaction[];
}

export type PaymentStatus = Payment["status"];
export type CardStatus = CreditCard["cardStatus"];
