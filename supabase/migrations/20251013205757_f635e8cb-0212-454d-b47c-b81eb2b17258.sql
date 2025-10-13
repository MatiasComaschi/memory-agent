-- Drop the view with SECURITY DEFINER and recreate without it
DROP VIEW IF EXISTS campaign_stats;

-- Recreate the view without SECURITY DEFINER (will use invoker's permissions)
CREATE VIEW campaign_stats AS
SELECT 
  c.id,
  c.name,
  c.status,
  COUNT(cs.id) as total_sends,
  COUNT(cs.id) FILTER (WHERE cs.status = 'sent') as successful_sends,
  COUNT(cs.id) FILTER (WHERE cs.status = 'failed') as failed_sends,
  MAX(cs.sent_at) as last_sent_at
FROM campaigns c
LEFT JOIN campaign_sends cs ON cs.campaign_id = c.id
GROUP BY c.id, c.name, c.status;

-- Grant access to authenticated users
GRANT SELECT ON campaign_stats TO authenticated;

-- Enable RLS on campaign_stats view (it will inherit from underlying tables)
ALTER VIEW campaign_stats SET (security_invoker = true);