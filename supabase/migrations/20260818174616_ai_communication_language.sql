ALTER TABLE public.automation_settings
  ADD COLUMN IF NOT EXISTS communication_language TEXT NOT NULL DEFAULT 'pt-BR';

ALTER TABLE public.automation_settings
  DROP CONSTRAINT IF EXISTS automation_settings_communication_language_check;

ALTER TABLE public.automation_settings
  ADD CONSTRAINT automation_settings_communication_language_check
  CHECK (communication_language IN ('pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'));
