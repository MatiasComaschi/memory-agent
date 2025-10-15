-- Add missing columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS opt_out boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Chicago';

-- Create message_templates table
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  llm_prompt text NOT NULL,
  fallback_copy text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(org_id, name, channel)
);

-- Create triggers table
CREATE TABLE public.triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('price_drop', 'new_listing', 'days_silent', 'rate_change', 'custom_criteria')),
  params jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  meta jsonb DEFAULT '{}'::jsonb,
  ts timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for message_templates
CREATE INDEX idx_message_templates_org_id ON public.message_templates(org_id);
CREATE INDEX idx_message_templates_channel ON public.message_templates(channel);

-- Create indexes for triggers
CREATE INDEX idx_triggers_org_id ON public.triggers(org_id);
CREATE INDEX idx_triggers_lead_id ON public.triggers(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_triggers_kind ON public.triggers(kind);
CREATE INDEX idx_triggers_active ON public.triggers(active) WHERE active = true;

-- Create indexes for audit_logs
CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity);
CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_audit_logs_ts ON public.audit_logs(ts DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_templates
CREATE POLICY "Users can view message templates in their org"
  ON public.message_templates FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can create message templates in their org"
  ON public.message_templates FOR INSERT
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update message templates in their org"
  ON public.message_templates FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete message templates in their org"
  ON public.message_templates FOR DELETE
  USING (org_id = get_user_org_id(auth.uid()));

-- RLS Policies for triggers
CREATE POLICY "Users can view triggers in their org"
  ON public.triggers FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can create triggers in their org"
  ON public.triggers FOR INSERT
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update triggers in their org"
  ON public.triggers FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete triggers in their org"
  ON public.triggers FOR DELETE
  USING (org_id = get_user_org_id(auth.uid()));

-- RLS Policies for audit_logs
CREATE POLICY "Users can view audit logs in their org"
  ON public.audit_logs FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "System can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

-- Add update triggers for updated_at columns
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_triggers_updated_at
  BEFORE UPDATE ON public.triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();