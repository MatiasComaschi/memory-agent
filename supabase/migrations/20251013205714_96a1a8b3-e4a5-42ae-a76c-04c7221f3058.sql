-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule campaign processing to run every 15 minutes
SELECT cron.schedule(
  'process-campaigns-every-15-min',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://izazjxvjxgtduiyojxbu.supabase.co/functions/v1/process-campaigns',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YXpqeHZqeGd0ZHVpeW9qeGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMjcyNzIsImV4cCI6MjA3NTkwMzI3Mn0.s2HDFL_eMHq-IUK1B2veCVrYXhk2PiVwIv9y0QWeMdM"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Create a view to see campaign statistics
CREATE OR REPLACE VIEW campaign_stats AS
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

-- Grant access to the view
GRANT SELECT ON campaign_stats TO authenticated;
