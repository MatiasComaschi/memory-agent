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
    console.log("Processing active campaigns...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active');

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      throw campaignsError;
    }

    console.log(`Found ${campaigns?.length || 0} active campaigns`);

    let totalTriggered = 0;

    for (const campaign of campaigns || []) {
      console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);

      // Parse trigger config
      const triggerType = campaign.trigger_type;
      const triggerConfig = campaign.trigger_config as any;
      const targetCriteria = campaign.target_criteria as any;

      // Build query for leads
      let leadsQuery = supabase
        .from('leads')
        .select('*')
        .eq('org_id', campaign.org_id);

      // Apply target criteria filters
      if (targetCriteria.stages && targetCriteria.stages.length > 0) {
        leadsQuery = leadsQuery.in('stage', targetCriteria.stages);
      }
      if (targetCriteria.sources && targetCriteria.sources.length > 0) {
        leadsQuery = leadsQuery.in('source', targetCriteria.sources);
      }
      if (targetCriteria.cities && targetCriteria.cities.length > 0) {
        leadsQuery = leadsQuery.in('city', targetCriteria.cities);
      }

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) {
        console.error(`Error fetching leads for campaign ${campaign.id}:`, leadsError);
        continue;
      }

      console.log(`Found ${leads?.length || 0} leads matching criteria`);

      // Check each lead against trigger conditions
      for (const lead of leads || []) {
        let shouldTrigger = false;

        switch (triggerType) {
          case 'silence': {
            const silenceDays = triggerConfig.silence_days || 14;
            const daysSilent = Math.floor(
              (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            
            // Check if already sent to this lead
            const { data: existingSend } = await supabase
              .from('campaign_sends')
              .select('id')
              .eq('campaign_id', campaign.id)
              .eq('lead_id', lead.id)
              .gte('sent_at', new Date(Date.now() - silenceDays * 24 * 60 * 60 * 1000).toISOString())
              .maybeSingle();

            if (!existingSend && daysSilent >= silenceDays) {
              shouldTrigger = true;
              console.log(`Trigger: Lead ${lead.full_name} silent for ${daysSilent} days`);
            }
            break;
          }

          case 'stage_change': {
            const targetStage = triggerConfig.target_stage;
            if (lead.stage === targetStage) {
              // Check if we already sent for this stage change
              const { data: existingSend } = await supabase
                .from('campaign_sends')
                .select('id')
                .eq('campaign_id', campaign.id)
                .eq('lead_id', lead.id)
                .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
                .maybeSingle();

              if (!existingSend) {
                shouldTrigger = true;
                console.log(`Trigger: Lead ${lead.full_name} in stage ${targetStage}`);
              }
            }
            break;
          }

          case 'new_lead': {
            const hoursOld = Math.floor(
              (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60)
            );
            const triggerHours = triggerConfig.hours_after || 1;

            if (hoursOld >= triggerHours && hoursOld <= triggerHours + 1) {
              // Check if already sent
              const { data: existingSend } = await supabase
                .from('campaign_sends')
                .select('id')
                .eq('campaign_id', campaign.id)
                .eq('lead_id', lead.id)
                .maybeSingle();

              if (!existingSend) {
                shouldTrigger = true;
                console.log(`Trigger: New lead ${lead.full_name} after ${hoursOld} hours`);
              }
            }
            break;
          }
        }

        if (shouldTrigger) {
          // Queue message by calling send-campaign-message
          const channels = campaign.channels as string[];
          
          for (const channel of channels) {
            try {
              const { error: sendError } = await supabase.functions.invoke('send-campaign-message', {
                body: {
                  campaignId: campaign.id,
                  leadId: lead.id,
                  channel,
                }
              });

              if (sendError) {
                console.error(`Failed to send ${channel} for campaign ${campaign.id}, lead ${lead.id}:`, sendError);
              } else {
                totalTriggered++;
                console.log(`Queued ${channel} for lead ${lead.full_name}`);
              }
            } catch (error) {
              console.error(`Error sending campaign message:`, error);
            }
          }
        }
      }
    }

    console.log(`Campaign processing complete. Triggered ${totalTriggered} messages.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaigns_processed: campaigns?.length || 0,
        messages_triggered: totalTriggered 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in process-campaigns:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
