-- Add CRM IDs and location enrichment columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS hubspot_id text,
  ADD COLUMN IF NOT EXISTS pipedrive_id text,
  ADD COLUMN IF NOT EXISTS fub_id text,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_sync jsonb default '{}'::jsonb;

-- Create index for CRM lookups
CREATE INDEX IF NOT EXISTS idx_leads_hubspot_id ON public.leads(hubspot_id) WHERE hubspot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_pipedrive_id ON public.leads(pipedrive_id) WHERE pipedrive_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_fub_id ON public.leads(fub_id) WHERE fub_id IS NOT NULL;