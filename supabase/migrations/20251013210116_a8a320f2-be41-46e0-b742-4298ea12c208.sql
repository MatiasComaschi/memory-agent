-- Create message queue table for reliable message delivery
CREATE TABLE IF NOT EXISTS public.message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  message_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for queue processing
CREATE INDEX idx_message_queue_status_scheduled ON public.message_queue(status, scheduled_for) 
WHERE status IN ('pending', 'processing');

-- Enable RLS
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for message queue
CREATE POLICY "Users can view messages in their org"
  ON public.message_queue FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "System can create messages"
  ON public.message_queue FOR INSERT
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "System can update messages"
  ON public.message_queue FOR UPDATE
  USING (org_id = get_user_org_id(auth.uid()));

-- Create campaign logs table
CREATE TABLE IF NOT EXISTS public.campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  leads_processed INTEGER DEFAULT 0,
  messages_triggered INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  execution_duration_ms INTEGER,
  status TEXT DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for campaign logs
CREATE INDEX idx_campaign_logs_campaign_time ON public.campaign_logs(campaign_id, execution_time DESC);

-- Enable RLS
ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign logs
CREATE POLICY "Users can view logs in their org"
  ON public.campaign_logs FOR SELECT
  USING (org_id = get_user_org_id(auth.uid()));

-- Create trigger for updated_at on message_queue
CREATE TRIGGER update_message_queue_updated_at
  BEFORE UPDATE ON public.message_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant access
GRANT SELECT, INSERT, UPDATE ON public.message_queue TO authenticated;
GRANT SELECT ON public.campaign_logs TO authenticated;