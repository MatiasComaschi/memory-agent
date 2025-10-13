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
    const { leadId } = await req.json();
    
    console.log("Analyzing lead intent for:", leadId);

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
      .select('org_id')
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

    // Get recent interactions
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('ts', { ascending: false })
      .limit(10);

    // Calculate days since last activity
    const daysSilent = Math.floor(
      (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Build context for AI analysis
    const leadContext = `
Lead Information:
- Name: ${lead.full_name}
- Stage: ${lead.stage}
- Source: ${lead.source}
- Location: ${lead.city || 'Unknown'}
- Budget: ${lead.budget_min ? `$${lead.budget_min} - $${lead.budget_max}` : 'Not specified'}
- Beds/Baths: ${lead.beds || 'Any'} beds, ${lead.baths || 'Any'} baths
- Days since last activity: ${daysSilent}
- Notes: ${lead.notes || 'None'}

Recent Interactions (last 10):
${interactions?.map((i, idx) => `
${idx + 1}. [${i.channel}] ${i.direction} - ${new Date(i.ts).toLocaleDateString()}
   ${i.subject ? `Subject: ${i.subject}` : ''}
   ${i.body ? `Message: ${i.body.substring(0, 200)}...` : ''}
`).join('\n') || 'No interactions yet'}
`;

    // Call Lovable AI to analyze intent
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
            content: `You are an expert real estate sales analyst. Analyze lead data and interactions to determine:
1. Urgency Score (0-100): How urgently does this lead need attention?
2. Sentiment (positive/neutral/negative): What's their current sentiment?
3. Purchase Window (immediate/near_term/long_term/unknown): When are they likely to buy?
4. Gating Factor (financing/location/timing/inventory/unknown): What's preventing them from moving forward?

Base your analysis on:
- Communication frequency and recency
- Lead stage and progression
- Expressed needs and concerns
- Budget and requirements clarity
- Days of silence

Respond with ONLY a valid JSON object, no additional text:
{
  "urgency_score": <number 0-100>,
  "sentiment": "<positive|neutral|negative>",
  "purchase_window": "<immediate|near_term|long_term|unknown>",
  "gating_factor": "<financing|location|timing|inventory|unknown>",
  "reasoning": "<brief explanation>"
}`
          },
          {
            role: 'user',
            content: leadContext
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error("AI Gateway error:", error);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices[0].message.content;
    
    console.log("AI Analysis:", analysisText);

    // Parse AI response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      console.error("Failed to parse AI response:", analysisText);
      throw new Error("Invalid AI response format");
    }

    // Store intent snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('intent_snapshots')
      .insert({
        lead_id: leadId,
        urgency_score: analysis.urgency_score,
        sentiment: analysis.sentiment,
        purchase_window: analysis.purchase_window,
        gating_factor: analysis.gating_factor,
        model_version: 'gemini-2.5-flash-v1',
      })
      .select()
      .single();

    if (snapshotError) {
      console.error("Error storing snapshot:", snapshotError);
      throw snapshotError;
    }

    console.log("Intent analysis complete:", snapshot);

    return new Response(
      JSON.stringify({ 
        success: true, 
        snapshot,
        reasoning: analysis.reasoning 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in analyze-lead-intent:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
