-- Add deterministic email job idempotency for the initial campaign step.
-- Follow-ups are not implemented here; sequence_index is reserved so future
-- steps can use campaign_id:contact_id:sequence_index without changing the key.

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS sequence_index INTEGER DEFAULT 0;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

UPDATE public.email_jobs
SET sequence_index = 0
WHERE sequence_index IS NULL;

UPDATE public.email_jobs
SET idempotency_key = campaign_id::text || ':' || contact_id::text || ':' || sequence_index::text
WHERE idempotency_key IS NULL OR btrim(idempotency_key) = '';

-- Resolve legacy duplicates before enforcing uniqueness. The kept row is chosen
-- deterministically: most advanced status first, then oldest created_at, then id.
-- Duplicate rows are preserved for audit history but cancelled and excluded from
-- the active unique indexes below.
WITH ranked_jobs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, campaign_id, contact_id, sequence_index
      ORDER BY
        CASE status
          WHEN 'sent' THEN 70
          WHEN 'mocked' THEN 60
          WHEN 'dry_run' THEN 60
          WHEN 'processing' THEN 50
          WHEN 'queued' THEN 40
          WHEN 'failed' THEN 30
          WHEN 'cancelled' THEN 0
          ELSE 10
        END DESC,
        created_at ASC,
        id ASC
    ) AS duplicate_rank
  FROM public.email_jobs
)
UPDATE public.email_jobs ej
SET
  status = 'cancelled',
  locked_at = NULL,
  locked_by = NULL,
  last_error = COALESCE(ej.last_error, 'Cancelled duplicate email job during idempotency migration'),
  error_message = COALESCE(ej.error_message, 'Cancelled duplicate email job during idempotency migration'),
  processed_at = COALESCE(ej.processed_at, now())
FROM ranked_jobs rj
WHERE ej.id = rj.id
  AND rj.duplicate_rank > 1;

ALTER TABLE public.email_jobs
  ALTER COLUMN sequence_index SET DEFAULT 0,
  ALTER COLUMN sequence_index SET NOT NULL;

ALTER TABLE public.email_jobs
  ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_sequence_index_check;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT email_jobs_sequence_index_check
  CHECK (sequence_index >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_jobs_workspace_campaign_contact_sequence_active
  ON public.email_jobs(workspace_id, campaign_id, contact_id, sequence_index)
  WHERE status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_jobs_workspace_idempotency_key_active
  ON public.email_jobs(workspace_id, idempotency_key)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_email_jobs_idempotency_key
  ON public.email_jobs(idempotency_key);

NOTIFY pgrst, 'reload schema';
