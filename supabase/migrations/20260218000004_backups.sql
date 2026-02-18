-- Auto-backup snapshots table
CREATE TABLE IF NOT EXISTS public.backups (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL DEFAULT auth.uid(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  cards_count  INT          NOT NULL DEFAULT 0,
  payments_count INT        NOT NULL DEFAULT 0,
  snapshot     JSONB        NOT NULL DEFAULT '{}'
);

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own backups"
  ON public.backups FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user lookup ordered by most recent
CREATE INDEX IF NOT EXISTS backups_user_created_idx
  ON public.backups (user_id, created_at DESC);

-- Keep only the latest 30 backups per user (optional cleanup function)
CREATE OR REPLACE FUNCTION public.prune_old_backups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.backups
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.backups
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 30
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_backups ON public.backups;
CREATE TRIGGER trg_prune_backups
  AFTER INSERT ON public.backups
  FOR EACH ROW EXECUTE FUNCTION public.prune_old_backups();
