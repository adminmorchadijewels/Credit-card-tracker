-- ============================================================
-- Credit Card Tracker – Database Schema
-- ============================================================
-- Run this in your Supabase SQL Editor to set up the database.
-- Go to: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_cards (
  id                        TEXT PRIMARY KEY,
  parent_id                 TEXT NOT NULL DEFAULT '',
  card_name                 TEXT NOT NULL,
  card_status               TEXT NOT NULL DEFAULT 'Active'
                              CHECK (card_status IN ('Active', 'Inactive')),
  owned_by                  TEXT NOT NULL DEFAULT '',
  bank                      TEXT NOT NULL,
  customer_care             TEXT NOT NULL DEFAULT '',
  bill_generation_day       INTEGER NOT NULL DEFAULT 1,
  bill_payment_date         INTEGER NOT NULL DEFAULT 20,
  limit_shared              BOOLEAN NOT NULL DEFAULT false,
  milestone_rewards         TEXT NOT NULL DEFAULT '',
  general_rewards           TEXT NOT NULL DEFAULT '',
  target_milestones         JSONB NOT NULL DEFAULT '[]'::jsonb,
  annual_charges            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  registered_no             TEXT NOT NULL DEFAULT '',
  email                     TEXT NOT NULL DEFAULT '',
  annual_cycle_reset        TEXT NOT NULL DEFAULT '',
  card_limit                NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reward_points_expiry_days INTEGER NOT NULL DEFAULT 365,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY,
  card_id             TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  card_name           TEXT NOT NULL,
  statement_date      TEXT NOT NULL,
  payment_due         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_deadline    TEXT NOT NULL DEFAULT '',
  payment_paid_on     TEXT,
  paid_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Paid', 'Pending', 'Overdue')),
  notes               TEXT NOT NULL DEFAULT '',
  statement_file_url  TEXT,
  statement_file_name TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'Other',
  amount     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  remark     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_payments_card_id
  ON payments(card_id);

CREATE INDEX IF NOT EXISTS idx_payments_statement_date
  ON payments(statement_date);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_id
  ON transactions(payment_id);

-- ============================================================
-- Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_credit_cards_updated_at
  BEFORE UPDATE ON credit_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Storage bucket for statement file uploads
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('statements', 'statements', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload statements (no auth for prototype)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Anyone can upload statements'
  ) THEN
    CREATE POLICY "Anyone can upload statements"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'statements');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Anyone can read statements'
  ) THEN
    CREATE POLICY "Anyone can read statements"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'statements');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Anyone can delete statements'
  ) THEN
    CREATE POLICY "Anyone can delete statements"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'statements');
  END IF;
END $$;

-- ============================================================
-- Row Level Security
-- ============================================================
-- Currently disabled (no authentication). Enable and add user-scoped
-- policies when you add Supabase Auth to the project.

ALTER TABLE credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- AI / Vector – Statement Chat (RAG)
-- ============================================================
-- Run this section after the main schema above.
-- Requires the pgvector extension (available on all Supabase projects).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS statement_chunks (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  TEXT    NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT    NOT NULL,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE statement_chunks DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_statement_chunks_payment_id
  ON statement_chunks(payment_id);

CREATE INDEX IF NOT EXISTS idx_statement_chunks_embedding
  ON statement_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_statement_chunks(
  query_embedding   vector(1536),
  payment_id_filter TEXT,
  match_count       INT DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  payment_id TEXT,
  content    TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    payment_id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM statement_chunks
  WHERE payment_id = payment_id_filter
    AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- Authentication & Row Level Security
-- ============================================================
-- Run this section to enable per-user data isolation.
-- Each user will only see and modify their own data.
-- ============================================================

ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS user_id UUID
  REFERENCES auth.users(id) ON DELETE CASCADE
  DEFAULT auth.uid();

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS user_id UUID
  REFERENCES auth.users(id) ON DELETE CASCADE
  DEFAULT auth.uid();

ALTER TABLE credit_cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE statement_chunks  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cards"    ON credit_cards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own cards"  ON credit_cards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own cards"  ON credit_cards FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own cards"  ON credit_cards FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view own payments"   ON payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own payments" ON payments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own payments" ON payments FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can access own transactions"
  ON transactions FOR ALL
  USING (payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid()))
  WITH CHECK (payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid()));

CREATE POLICY "Users can access own statement chunks"
  ON statement_chunks FOR ALL
  USING (payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid()))
  WITH CHECK (payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid()));
