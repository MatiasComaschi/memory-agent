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
    const { integrationId, provider } = await req.json();
    
    console.log(`Refreshing OAuth token for integration ${integrationId}, provider ${provider}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get integration details
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (integrationError || !integration) {
      throw new Error("Integration not found");
    }

    if (!integration.refresh_token) {
      throw new Error("No refresh token available");
    }

    let newAccessToken;
    let expiresIn;

    if (provider === 'gmail' || provider === 'google') {
      // Refresh Google token
      const clientId = Deno.env.get("ClientID")!;
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        const error = await refreshResponse.text();
        console.error("Google token refresh failed:", error);
        throw new Error("Failed to refresh Google token");
      }

      const refreshData = await refreshResponse.json();
      newAccessToken = refreshData.access_token;
      expiresIn = refreshData.expires_in;

    } else if (provider === 'microsoft365') {
      // Refresh Microsoft token
      const clientId = Deno.env.get("MICROSOFT_CLIENT_ID")!;
      const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

      const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        const error = await refreshResponse.text();
        console.error("Microsoft token refresh failed:", error);
        throw new Error("Failed to refresh Microsoft token");
      }

      const refreshData = await refreshResponse.json();
      newAccessToken = refreshData.access_token;
      expiresIn = refreshData.expires_in;

    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Update integration with new token
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        access_token: newAccessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    if (updateError) {
      console.error("Error updating integration:", updateError);
      throw updateError;
    }

    console.log(`Successfully refreshed token for integration ${integrationId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Token refreshed successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in refresh-oauth-token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
