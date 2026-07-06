-- Separate live sends from simulated email job outcomes.

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS send_mode TEXT;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_status_check;

UPDATE public.email_jobs
SET
  status = 'mocked',
  send_mode = COALESCE(send_mode, 'mock'),
  provider = COALESCE(provider, 'mock')
WHERE status = 'sent'
  AND error_message ILIKE 'mock mode:%';

UPDATE public.email_jobs
SET
  status = 'dry_run',
  send_mode = COALESCE(send_mode, 'dry_run'),
  provider = COALESCE(provider, 'dry_run')
WHERE status = 'sent'
  AND error_message ILIKE 'dry_run mode:%';

UPDATE public.email_jobs
SET
  status = 'processing'
WHERE status = 'sending';

UPDATE public.email_jobs
SET
  status = 'sent',
  send_mode = COALESCE(send_mode, 'live')
WHERE status IN ('opened', 'replied');

UPDATE public.email_jobs
SET send_mode = 'live'
WHERE status = 'sent'
  AND send_mode IS NULL;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT email_jobs_status_check
  CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'mocked', 'dry_run', 'cancelled'));

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_send_mode_check;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT email_jobs_send_mode_check
  CHECK (send_mode IS NULL OR send_mode IN ('mock', 'dry_run', 'live'));

ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_provider_check;

ALTER TABLE public.email_jobs
  ADD CONSTRAINT email_jobs_provider_check
  CHECK (provider IS NULL OR provider IN ('smtp', 'resend', 'mock', 'dry_run'));

CREATE INDEX IF NOT EXISTS idx_email_jobs_workspace_status
  ON public.email_jobs(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_email_jobs_send_mode
  ON public.email_jobs(send_mode);

NOTIFY pgrst, 'reload schema';
