-- Add soft delete column to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);

-- Create lead deletions tracking table
CREATE TABLE IF NOT EXISTS public.lead_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason_code text CHECK (reason_code IN (
    'not_qualified','duplicate','moved_on','price_sensitivity','timing','service_issue','unresponsive','other'
  )) NOT NULL,
  reason_text text NOT NULL CHECK (char_length(reason_text) <= 100),
  ai_topic text,
  ai_summary text,
  lead_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_deletions_org ON public.lead_deletions(org_id);
CREATE INDEX IF NOT EXISTS idx_lead_deletions_lead ON public.lead_deletions(lead_id);

-- Enable RLS on lead_deletions
ALTER TABLE public.lead_deletions ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_deletions
CREATE POLICY "org_read_lead_deletions" ON public.lead_deletions
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "org_insert_lead_deletions" ON public.lead_deletions
  FOR INSERT WITH CHECK (org_id = get_user_org_id(auth.uid()));