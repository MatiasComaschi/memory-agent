import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing message queue...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pending messages scheduled for now or earlier
    const { data: messages, error: messagesError } = await supabase
      .from('message_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50); // Process max 50 at a time

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      throw messagesError;
    }

    console.log(`Found ${messages?.length || 0} pending messages`);

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const message of messages || []) {
      try {
        // Mark as processing
        await supabase
          .from('message_queue')
          .update({ status: 'processing' })
          .eq('id', message.id);

        // Send the message
        let sendResult;
        
        if (message.channel === 'email') {
          sendResult = await supabase.functions.invoke('send-email', {
            body: {
              leadId: message.lead_id,
              subject: message.subject,
              message: message.message_content,
            }
          });
        } else if (message.channel === 'sms') {
          sendResult = await supabase.functions.invoke('send-sms', {
            body: {
              leadId: message.lead_id,
              message: message.message_content,
            }
          });
        }

        if (sendResult?.error) {
          throw new Error(sendResult.error.message);
        }

        // Mark as sent
        await supabase
          .from('message_queue')
          .update({
            status: 'sent',
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', message.id);

        sent++;
        console.log(`Successfully sent ${message.channel} message ${message.id}`);

      } catch (error: any) {
        console.error(`Failed to send message ${message.id}:`, error);

        const newRetryCount = message.retry_count + 1;
        const shouldRetry = newRetryCount < message.max_retries;

        if (shouldRetry) {
          // Schedule retry with exponential backoff
          const retryDelayMinutes = Math.pow(2, newRetryCount) * 5; // 5, 10, 20 minutes
          const scheduledFor = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

          await supabase
            .from('message_queue')
            .update({
              status: 'pending',
              retry_count: newRetryCount,
              scheduled_for: scheduledFor.toISOString(),
              error_message: error.message,
            })
            .eq('id', message.id);

          console.log(`Scheduled retry ${newRetryCount} for message ${message.id} at ${scheduledFor.toISOString()}`);
        } else {
          // Max retries reached, mark as failed
          await supabase
            .from('message_queue')
            .update({
              status: 'failed',
              processed_at: new Date().toISOString(),
              error_message: error.message,
            })
            .eq('id', message.id);

          failed++;
          console.log(`Message ${message.id} failed permanently after ${message.retry_count} retries`);
        }
      }

      processed++;
    }

    console.log(`Queue processing complete. Processed: ${processed}, Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed,
        sent,
        failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in process-message-queue:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
