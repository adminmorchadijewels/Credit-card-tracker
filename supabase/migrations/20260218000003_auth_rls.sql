-- ============================================================
-- Authentication & Row Level Security
-- ============================================================
-- Run this AFTER 20260218000001_initial_schema.sql
-- Adds per-user data isolation so each user sees only their own
-- cards, payments, transactions, and statement chunks.
-- ============================================================

-- ── Add user_id to card and payment tables ────────────────────────────────
-- DEFAULT auth.uid() automatically fills user_id at INSERT time
-- using the currently authenticated user's UUID.

ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS user_id UUID
  REFERENCES auth.users(id) ON DELETE CASCADE
  DEFAULT auth.uid();

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS user_id UUID
  REFERENCES auth.users(id) ON DELETE CASCADE
  DEFAULT auth.uid();

-- ── Enable Row Level Security ─────────────────────────────────────────────

ALTER TABLE credit_cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_chunks  ENABLE ROW LEVEL SECURITY;

-- ── credit_cards policies ─────────────────────────────────────────────────

CREATE POLICY "Users can view own cards"
  ON credit_cards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cards"
  ON credit_cards FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cards"
  ON credit_cards FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own cards"
  ON credit_cards FOR DELETE
  USING (user_id = auth.uid());

-- ── payments policies ─────────────────────────────────────────────────────

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own payments"
  ON payments FOR DELETE
  USING (user_id = auth.uid());

-- ── transactions policies (cascaded via payments ownership) ───────────────

CREATE POLICY "Users can access own transactions"
  ON transactions FOR ALL
  USING (
    payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid())
  )
  WITH CHECK (
    payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid())
  );

-- ── statement_chunks policies (cascaded via payments ownership) ───────────

CREATE POLICY "Users can access own statement chunks"
  ON statement_chunks FOR ALL
  USING (
    payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid())
  )
  WITH CHECK (
    payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid())
  );
