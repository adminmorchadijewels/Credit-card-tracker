-- Add installments JSONB column to payments table
-- Stores an array of { id, date, amount, note } objects for multi-date payment tracking

alter table payments
  add column if not exists installments jsonb default null;

comment on column payments.installments is
  'Array of payment installments: [{id, date, amount, note}]. '
  'When present, paid_amount and payment_paid_on are derived from this array.';
