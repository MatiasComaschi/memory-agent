-- Add practical real-estate fields to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS contact_preference text CHECK (contact_preference IN ('email','sms','call','any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS do_not_contact boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS preapproved boolean,
  ADD COLUMN IF NOT EXISTS financing_status text CHECK (financing_status IN ('unknown','researching','preapproved','in_process','cash')) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS lender_name text,
  ADD COLUMN IF NOT EXISTS move_in_timeline text CHECK (move_in_timeline IN ('asap','0-3m','3-6m','6-12m','12m+','unknown')) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS property_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS neighborhoods text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_sqft integer,
  ADD COLUMN IF NOT EXISTS min_lot_sqft integer,
  ADD COLUMN IF NOT EXISTS has_garage boolean,
  ADD COLUMN IF NOT EXISTS must_haves text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nice_to_haves text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS showing_availability text,
  ADD COLUMN IF NOT EXISTS communication_notes text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

-- Change history table (field-level diffs)
CREATE TABLE IF NOT EXISTS public.lead_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changes jsonb NOT NULL,
  note text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_change_history_lead ON public.lead_change_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_change_history_org ON public.lead_change_history(org_id);

-- Enable RLS on change history
ALTER TABLE public.lead_change_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for change history
CREATE POLICY "org_read_lead_history" ON public.lead_change_history
  FOR SELECT USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "org_insert_lead_history" ON public.lead_change_history
  FOR INSERT WITH CHECK (org_id = get_user_org_id(auth.uid()));