-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('price_drop', 'new_listing', 'manual', 'scheduled')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  message_template TEXT NOT NULL,
  target_criteria JSONB DEFAULT '{}'::jsonb,
  channels JSONB DEFAULT '["email"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_sends table to track messages
CREATE TABLE public.campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  message_content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'opened', 'clicked'))
);

-- Create integrations table to store OAuth tokens
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'microsoft365', 'twilio', 'hubspot', 'pipedrive', 'followupboss')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider)
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Campaigns policies
CREATE POLICY "Users can view campaigns in their org"
  ON public.campaigns FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can create campaigns in their org"
  ON public.campaigns FOR INSERT
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can update campaigns in their org"
  ON public.campaigns FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can delete campaigns in their org"
  ON public.campaigns FOR DELETE
  USING (org_id = get_user_org_id(auth.uid()));

-- Campaign sends policies
CREATE POLICY "Users can view campaign sends in their org"
  ON public.campaign_sends FOR SELECT
  USING (campaign_id IN (SELECT id FROM public.campaigns WHERE org_id = get_user_org_id(auth.uid())));

CREATE POLICY "System can create campaign sends"
  ON public.campaign_sends FOR INSERT
  WITH CHECK (campaign_id IN (SELECT id FROM public.campaigns WHERE org_id = get_user_org_id(auth.uid())));

-- Integrations policies
CREATE POLICY "Users can view integrations in their org"
  ON public.integrations FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can manage integrations in their org"
  ON public.integrations FOR ALL
  USING (org_id = get_user_org_id(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();