-- Create views for dashboard metrics

-- 1) Latest intent snapshot per lead
CREATE OR REPLACE VIEW public.v_latest_intent AS
SELECT DISTINCT ON (lead_id)
  lead_id,
  urgency_score,
  sentiment,
  purchase_window,
  created_at as intent_at
FROM public.intent_snapshots
ORDER BY lead_id, created_at DESC;

-- 2) First contact timestamp per lead
CREATE OR REPLACE VIEW public.v_first_contact AS
SELECT
  l.id as lead_id,
  l.org_id,
  MIN(i.ts) as first_contact_at
FROM public.leads l
LEFT JOIN public.interactions i ON i.lead_id = l.id
GROUP BY l.id, l.org_id;

-- 3) Leads per day with source
CREATE OR REPLACE VIEW public.v_leads_daily AS
SELECT
  org_id,
  DATE_TRUNC('day', created_at)::date as day,
  source,
  COUNT(*) as leads
FROM public.leads
WHERE deleted_at IS NULL
GROUP BY org_id, day, source;

-- 4) Stage counts (current snapshot)
CREATE OR REPLACE VIEW public.v_stage_counts AS
SELECT
  org_id,
  stage,
  COUNT(*) as cnt
FROM public.leads
WHERE deleted_at IS NULL
GROUP BY org_id, stage;

-- 5) Last interaction per lead
CREATE OR REPLACE VIEW public.v_last_interaction AS
SELECT
  l.id as lead_id,
  l.org_id,
  MAX(i.ts) as last_interaction_at
FROM public.leads l
LEFT JOIN public.interactions i ON i.lead_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.id, l.org_id;

-- 6) Campaign performance metrics
CREATE OR REPLACE VIEW public.v_campaign_perf AS
SELECT
  c.org_id,
  c.id as campaign_id,
  c.name,
  c.status,
  COUNT(cs.id) FILTER (WHERE cs.status = 'sent') as sent,
  COUNT(cs.id) FILTER (WHERE cs.status = 'delivered') as delivered,
  COUNT(cs.id) FILTER (WHERE cs.status = 'failed') as failed
FROM public.campaigns c
LEFT JOIN public.campaign_sends cs ON cs.campaign_id = c.id
GROUP BY c.org_id, c.id, c.name, c.status;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_org_deleted ON public.leads(org_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_interactions_lead_ts ON public.interactions(lead_id, ts);
CREATE INDEX IF NOT EXISTS idx_intent_snapshots_lead_created ON public.intent_snapshots(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON public.campaign_sends(campaign_id, status);

-- Enable realtime for dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intent_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;