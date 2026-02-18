-- ============================================================
-- Statement Chunks – pgvector for PDF RAG
-- ============================================================
-- Enables AI-powered "chat with your statement" feature.
-- Run this AFTER 20260218000001_initial_schema.sql
-- ============================================================

-- Enable the pgvector extension (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS statement_chunks (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  TEXT    NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT    NOT NULL,
  embedding   vector(1536),          -- text-embedding-3-small dimensions
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE statement_chunks DISABLE ROW LEVEL SECURITY;

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_statement_chunks_payment_id
  ON statement_chunks(payment_id);

-- IVFFlat index for fast approximate nearest-neighbor search
-- (adjust lists = 100 if you have thousands of chunks)
CREATE INDEX IF NOT EXISTS idx_statement_chunks_embedding
  ON statement_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── Similarity search function ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_statement_chunks(
  query_embedding  vector(1536),
  payment_id_filter TEXT,
  match_count      INT DEFAULT 5
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
