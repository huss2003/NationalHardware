ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ui_config jsonb NOT NULL DEFAULT '{}'::jsonb;