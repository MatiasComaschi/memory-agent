import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    console.log("Gmail OAuth callback received", { code: !!code, state, error });

    // Handle OAuth errors
    if (error) {
      const siteUrl = Deno.env.get("SITE_URL");
      return Response.redirect(
        `${siteUrl}/settings/integrations?error=${encodeURIComponent(error)}`,
        302
      );
    }

    // Validate state
    if (state !== "gmail_integration") {
      throw new Error("Invalid state parameter");
    }

    if (!code) {
      throw new Error("No authorization code provided");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("ClientID") ?? "",
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
        redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-gmail-oauth`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    console.log("Tokens received", { 
      hasAccessToken: !!tokens.access_token, 
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope 
    });

    if (!tokens.access_token) {
      throw new Error("Failed to obtain access token");
    }

    // Create Supabase client with service role key for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get session from cookie or create anonymous session for now
    // In production, you'd want to implement proper session handling
    // For now, we'll store it temporarily and let the frontend pick it up
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens temporarily - frontend will complete the connection
    // This is a workaround since we can't easily access the user's session here
    const tempData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokenExpiresAt,
      scope: tokens.scope,
    };

    console.log("Tokens stored, testing Gmail send...");

    // Test Gmail send with a simple API call
    try {
      const testResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (testResponse.ok) {
        const profile = await testResponse.json();
        console.log("Gmail API test successful:", profile.emailAddress);
      } else {
        console.warn("Gmail API test failed:", await testResponse.text());
      }
    } catch (testError) {
      console.error("Gmail test error:", testError);
    }

    // Redirect back to the app with success and token data in URL
    // Frontend will pick this up and complete the integration
    const siteUrl = Deno.env.get("SITE_URL");
    const redirectUrl = new URL(`${siteUrl}/settings/integrations`);
    redirectUrl.searchParams.set("gmail", "connected");
    redirectUrl.searchParams.set("temp_token", btoa(JSON.stringify(tempData)));

    console.log("Redirecting to:", redirectUrl.toString().split("?")[0]);

    return Response.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    console.error("Error handling Gmail OAuth:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Redirect to settings with error
    const siteUrl = Deno.env.get("SITE_URL");
    return Response.redirect(
      `${siteUrl}/settings/integrations?error=${encodeURIComponent(errorMessage)}`,
      302
    );
  }
});