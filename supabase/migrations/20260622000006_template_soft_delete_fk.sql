-- Make campaigns.template_id nullable and set ON DELETE SET NULL
ALTER TABLE public.campaigns ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_template_id_fkey,
  ADD CONSTRAINT campaigns_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;

-- Make email_jobs.template_id nullable and set ON DELETE SET NULL
ALTER TABLE public.email_jobs ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE public.email_jobs
  DROP CONSTRAINT IF EXISTS email_jobs_template_id_fkey,
  ADD CONSTRAINT email_jobs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;

