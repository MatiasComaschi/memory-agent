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
    const { leadId, messageType, context } = await req.json();
    
    console.log("Generating message for lead:", leadId, "type:", messageType);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's org_id
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );
    
    if (!user) {
      throw new Error("Unauthorized");
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Get lead details
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('org_id', profile.org_id)
      .single();

    if (!lead) {
      throw new Error("Lead not found");
    }

    // Get latest intent snapshot
    const { data: intent } = await supabase
      .from('intent_snapshots')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get recent interactions
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('ts', { ascending: false })
      .limit(5);

    // Build context for AI
    const leadContext = `
Lead Profile:
- Name: ${lead.full_name}
- Stage: ${lead.stage}
- Location: ${lead.city || 'Unknown'}
- Budget: ${lead.budget_min ? `$${lead.budget_min} - $${lead.budget_max}` : 'Not specified'}
- Property Requirements: ${lead.beds || 'Any'} beds, ${lead.baths || 'Any'} baths
- Lead Source: ${lead.source}

${intent ? `AI Intent Analysis:
- Urgency Score: ${intent.urgency_score}/100
- Sentiment: ${intent.sentiment}
- Purchase Window: ${intent.purchase_window}
- Gating Factor: ${intent.gating_factor}` : ''}

Recent Communication History:
${interactions?.map((i, idx) => `
${idx + 1}. [${i.channel}] ${new Date(i.ts).toLocaleDateString()}
   ${i.subject ? `Subject: ${i.subject}` : ''}
   ${i.body ? `Preview: ${i.body.substring(0, 150)}...` : ''}
`).join('\n') || 'No recent interactions'}

Agent Name: ${profile.full_name}

Additional Context: ${context || 'None provided'}
`;

    const messageTypePrompts: Record<string, string> = {
      email: `Generate a professional, personalized email that:
- Has a compelling subject line (max 60 chars)
- Addresses their specific needs and concerns
- Provides value (market insights, new listings, answers to questions)
- Includes a clear call-to-action
- Maintains a warm, professional tone
- Is concise (2-3 short paragraphs)

Format as JSON:
{
  "subject": "email subject",
  "body": "email body"
}`,
      sms: `Generate a friendly, concise SMS message (max 160 chars) that:
- Feels personal and conversational
- References their needs
- Has a clear purpose
- Invites a response
- Uses appropriate emojis if helpful

Format as JSON:
{
  "message": "sms text"
}`
    };

    // Call Lovable AI to generate message
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
            content: `You are an expert real estate agent assistant. Generate personalized outreach messages based on lead data and history.

Key principles:
- Be authentic and conversational
- Reference specific lead details when relevant
- Provide value in every message
- Adapt tone based on lead stage and sentiment
- Keep messages concise and actionable

${messageTypePrompts[messageType] || messageTypePrompts.email}`
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
      const error = await aiResponse.text();
      console.error("AI Gateway error:", error);
      throw new Error("AI message generation failed");
    }

    const aiData = await aiResponse.json();
    const messageContent = aiData.choices[0].message.content;
    
    console.log("Generated message:", messageContent);

    // Parse AI response
    let generatedMessage;
    try {
      generatedMessage = JSON.parse(messageContent);
    } catch (e) {
      console.error("Failed to parse AI response:", messageContent);
      throw new Error("Invalid AI response format");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: generatedMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in generate-message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
