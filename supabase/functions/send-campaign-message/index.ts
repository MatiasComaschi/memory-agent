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
    const { campaignId, leadId, channel } = await req.json();
    
    console.log(`Sending campaign message: campaign=${campaignId}, lead=${leadId}, channel=${channel}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign details and verify org ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, org_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign not found:", campaignError);
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user's org_id from JWT
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single();
        
        // Verify user belongs to campaign's organization
        if (profile?.org_id !== campaign.org_id) {
          console.error("Unauthorized: User org does not match campaign org");
          return new Response(
            JSON.stringify({ error: "Unauthorized access" }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // Get recent interactions for context
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('ts', { ascending: false })
      .limit(5);

    // Get latest intent snapshot
    const { data: intent } = await supabase
      .from('intent_snapshots')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build context for AI message generation
    const leadContext = `
Campaign: ${campaign.name}
Campaign Description: ${campaign.description || 'N/A'}

Lead Profile:
- Name: ${lead.full_name}
- Stage: ${lead.stage}
- Location: ${lead.city || 'Unknown'}
- Budget: ${lead.budget_min ? `$${lead.budget_min} - $${lead.budget_max}` : 'Not specified'}
- Requirements: ${lead.beds || 'Any'} beds, ${lead.baths || 'Any'} baths

${intent ? `AI Intent Analysis:
- Urgency Score: ${intent.urgency_score}/100
- Sentiment: ${intent.sentiment}
- Purchase Window: ${intent.purchase_window}
- Gating Factor: ${intent.gating_factor}` : ''}

Recent Communication:
${interactions?.map((i, idx) => `${idx + 1}. [${i.channel}] ${new Date(i.ts).toLocaleDateString()}`).join('\n') || 'No recent interactions'}

Message Template Context:
${campaign.message_template}
`;

    // Generate personalized message using AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: channel === 'email' 
              ? `You are a real estate marketing expert. Generate a personalized email based on the campaign template and lead context. 
              
Return ONLY valid JSON:
{
  "subject": "compelling subject line (max 60 chars)",
  "body": "personalized email body (2-3 paragraphs)"
}`
              : `You are a real estate marketing expert. Generate a personalized SMS based on the campaign template and lead context.
              
Return ONLY valid JSON:
{
  "message": "concise SMS message (max 160 chars)"
}`
          },
          {
            role: 'user',
            content: leadContext
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error("AI message generation failed");
    }

    const aiData = await aiResponse.json();
    const messageContent = aiData.choices[0].message.content;
    
    let generatedMessage;
    try {
      generatedMessage = JSON.parse(messageContent);
      
      // Validate generated content doesn't contain spam patterns
      const content = channel === 'email' ? generatedMessage.body : generatedMessage.message;
      const suspiciousPatterns = /\b(click here now|act immediately|urgent action required|verify account now|claim prize)\b/gi;
      if (suspiciousPatterns.test(content)) {
        console.warn("AI generated suspicious content, rejecting");
        throw new Error("Generated content failed validation");
      }
      
      // Limit URL count in generated content
      const urlCount = (content.match(/https?:\/\//g) || []).length;
      if (urlCount > 3) {
        console.warn("AI generated too many URLs, rejecting");
        throw new Error("Generated content contains too many URLs");
      }
    } catch (e) {
      console.error("Failed to parse or validate AI response:", messageContent);
      throw new Error("Invalid AI response format");
    }

    // Send the message based on channel
    let sendResult;
    
    if (channel === 'email') {
      if (!lead.email) {
        throw new Error("Lead has no email address");
      }

      sendResult = await supabase.functions.invoke('send-email', {
        body: {
          leadId: lead.id,
          subject: generatedMessage.subject,
          message: generatedMessage.body,
        }
      });
    } else if (channel === 'sms') {
      if (!lead.phone) {
        throw new Error("Lead has no phone number");
      }

      sendResult = await supabase.functions.invoke('send-sms', {
        body: {
          leadId: lead.id,
          message: generatedMessage.message,
        }
      });
    }

    if (sendResult?.error) {
      throw new Error(`Failed to send ${channel}: ${sendResult.error.message}`);
    }

    // Record campaign send
    const { error: recordError } = await supabase
      .from('campaign_sends')
      .insert({
        campaign_id: campaignId,
        lead_id: leadId,
        channel: channel,
        message_content: channel === 'email' 
          ? `${generatedMessage.subject}\n\n${generatedMessage.body}`
          : generatedMessage.message,
        status: 'sent',
      });

    if (recordError) {
      console.error("Error recording campaign send:", recordError);
    }

    console.log(`Successfully sent ${channel} to ${lead.full_name}`);

    return new Response(
      JSON.stringify({ success: true, message: "Campaign message sent" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in send-campaign-message:", error);
    
    // Record failed send
    try {
      const { campaignId, leadId, channel } = await req.json();
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('campaign_sends').insert({
        campaign_id: campaignId,
        lead_id: leadId,
        channel: channel,
        message_content: error.message,
        status: 'failed',
      });
    } catch (recordError) {
      console.error("Failed to record error:", recordError);
    }

    // Return generic error to client, keep details in logs
    return new Response(
      JSON.stringify({ error: "Failed to send campaign message" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
