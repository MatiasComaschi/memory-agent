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
    const { leadId, subject, message } = await req.json();
    
    console.log("Sending email to lead:", leadId);

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
      .select('email, full_name')
      .eq('id', leadId)
      .eq('org_id', profile.org_id)
      .single();

    if (leadError || !lead?.email) {
      throw new Error("Lead not found or missing email");
    }

    // Get Gmail OAuth token for the org
    const { data: integration } = await supabase
      .from('integrations')
      .select('id, access_token, refresh_token, token_expires_at')
      .eq('org_id', profile.org_id)
      .eq('provider', 'gmail')
      .single();

    if (!integration) {
      throw new Error("Gmail integration not connected. Please connect Gmail in Settings > Integrations.");
    }

    // Check if token needs refresh
    let accessToken = integration.access_token;
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      console.log("Token expired, refreshing...");
      
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get("ClientID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          refresh_token: integration.refresh_token!,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error("Failed to refresh access token");
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update token in database
      await supabase
        .from('integrations')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('id', integration.id);
    }

    // Create email in RFC 2822 format
    const emailContent = [
      `To: ${lead.email}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      message,
    ].join('\r\n');

    // Encode email in base64url format
    const base64Email = btoa(emailContent)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email via Gmail API
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: base64Email,
      }),
    });

    if (!gmailResponse.ok) {
      const error = await gmailResponse.text();
      console.error("Gmail API error:", error);
      throw new Error("Failed to send email via Gmail");
    }

    // Record interaction
    await supabase.from('interactions').insert({
      lead_id: leadId,
      user_id: user.id,
      channel: 'email',
      direction: 'outbound',
      subject: subject,
      body: message,
    });

    console.log("Email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
