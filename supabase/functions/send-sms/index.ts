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
    const { leadId, message } = await req.json();
    
    console.log("Sending SMS to lead:", leadId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('phone, full_name')
      .eq('id', leadId)
      .eq('org_id', profile.org_id)
      .single();

    if (leadError || !lead?.phone) {
      throw new Error("Lead not found or missing phone number");
    }

    // Get Twilio credentials from integrations
    const { data: integration } = await supabase
      .from('integrations')
      .select('metadata')
      .eq('org_id', profile.org_id)
      .eq('provider', 'twilio')
      .single();

    if (!integration?.metadata) {
      throw new Error("Twilio integration not connected. Please connect Twilio in Settings > Integrations.");
    }

    const { account_sid, auth_token, phone_number } = integration.metadata as {
      account_sid: string;
      auth_token: string;
      phone_number: string;
    };

    // Send SMS via Twilio
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${account_sid}:${auth_token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: lead.phone,
          From: phone_number,
          Body: message,
        }),
      }
    );

    if (!twilioResponse.ok) {
      const error = await twilioResponse.text();
      console.error("Twilio API error:", error);
      throw new Error("Failed to send SMS via Twilio");
    }

    // Record interaction
    await supabase.from('interactions').insert({
      lead_id: leadId,
      user_id: user.id,
      channel: 'sms',
      direction: 'outbound',
      body: message,
    });

    console.log("SMS sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "SMS sent successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in send-sms function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
