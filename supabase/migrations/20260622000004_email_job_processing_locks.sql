-- Add atomic job claiming, retry metadata, and stuck-job recovery controls.

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS locked_by TEXT;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_attempt_count_check;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT email_jobs_attempt_count_check
  CHECK (attempt_count >= 0);

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_max_attempts_check;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT email_jobs_max_attempts_check
  CHECK (max_attempts > 0);

CREATE INDEX IF NOT EXISTS idx_email_jobs_claim
  ON public.email_jobs(status, locked_at, attempt_count, max_attempts, created_at);

CREATE INDEX IF NOT EXISTS idx_email_jobs_workspace_claim
  ON public.email_jobs(workspace_id, status, locked_at, created_at);

CREATE INDEX IF NOT EXISTS idx_email_jobs_campaign
  ON public.email_jobs(campaign_id);

CREATE INDEX IF NOT EXISTS idx_email_jobs_locked_by
  ON public.email_jobs(locked_by);

CREATE OR REPLACE FUNCTION public.claim_email_jobs(
  target_workspace_id UUID DEFAULT NULL,
  claim_run_id TEXT DEFAULT NULL,
  batch_size INTEGER DEFAULT 25,
  stale_after_minutes INTEGER DEFAULT 15
)
RETURNS SETOF public.email_jobs AS $$
BEGIN
  IF claim_run_id IS NULL OR btrim(claim_run_id) = '' THEN
    RAISE EXCEPTION 'claim_run_id is required';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT ej.id
    FROM public.email_jobs ej
    WHERE (target_workspace_id IS NULL OR ej.workspace_id = target_workspace_id)
      AND ej.attempt_count < ej.max_attempts
      AND (
        ej.status = 'queued'
        OR (
          ej.status = 'processing'
          AND (
            ej.locked_at IS NULL
            OR ej.locked_at < now() - make_interval(mins => stale_after_minutes)
          )
        )
      )
      AND (
        ej.locked_at IS NULL
        OR ej.locked_at < now() - make_interval(mins => stale_after_minutes)
      )
    ORDER BY ej.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(batch_size, 25), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_jobs ej
  SET
    status = 'processing',
    attempt_count = ej.attempt_count + 1,
    locked_at = now(),
    locked_by = claim_run_id
  FROM candidates
  WHERE ej.id = candidates.id
  RETURNING ej.*;
END;
$$ LANGUAGE plpgsql SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_email_jobs(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs(UUID, TEXT, INTEGER, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
