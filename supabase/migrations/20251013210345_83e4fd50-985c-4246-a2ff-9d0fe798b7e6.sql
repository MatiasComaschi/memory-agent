-- Schedule message queue processing every 5 minutes
SELECT cron.schedule(
  'process-message-queue-every-5-min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://izazjxvjxgtduiyojxbu.supabase.co/functions/v1/process-message-queue',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6YXpqeHZqeGd0ZHVpeW9qeGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMjcyNzIsImV4cCI6MjA3NTkwMzI3Mn0.s2HDFL_eMHq-IUK1B2veCVrYXhk2PiVwIv9y0QWeMdM"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Create view for message queue statistics
CREATE OR REPLACE VIEW message_queue_stats AS
SELECT 
  status,
  channel,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries,
  MAX(created_at) as last_created
FROM message_queue
GROUP BY status, channel;

-- Grant access
GRANT SELECT ON message_queue_stats TO authenticated;

-- Set security invoker for the view
ALTER VIEW message_queue_stats SET (security_invoker = true);