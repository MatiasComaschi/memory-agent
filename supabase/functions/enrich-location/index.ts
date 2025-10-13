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
    const { leadId, address } = await req.json();
    
    console.log(`Enriching location for lead ${leadId}: ${address}`);

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

    // Get Google Maps API key from integrations
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('provider', 'google_maps')
      .single();

    if (!integration?.metadata?.api_key) {
      throw new Error("Google Maps integration not connected");
    }

    const apiKey = integration.metadata.api_key;

    // Geocode the address
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );

    if (!geocodeResponse.ok) {
      throw new Error("Failed to geocode address");
    }

    const geocodeData = await geocodeResponse.json();

    if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
      throw new Error("Address not found");
    }

    const result = geocodeData.results[0];
    const location = result.geometry.location;
    const addressComponents = result.address_components;

    // Extract location components
    let city = '';
    let state = '';
    let zip = '';
    let country = '';

    for (const component of addressComponents) {
      if (component.types.includes('locality')) {
        city = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        state = component.short_name;
      }
      if (component.types.includes('postal_code')) {
        zip = component.long_name;
      }
      if (component.types.includes('country')) {
        country = component.long_name;
      }
    }

    // Get nearby points of interest
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=2000&key=${apiKey}`
    );

    let nearbyPlaces = [];
    if (placesResponse.ok) {
      const placesData = await placesResponse.json();
      nearbyPlaces = placesData.results?.slice(0, 10).map((place: any) => ({
        name: place.name,
        type: place.types[0],
        rating: place.rating,
      })) || [];
    }

    // Get current lead tags
    const { data: currentLead } = await supabase
      .from('leads')
      .select('tags')
      .eq('id', leadId)
      .single();

    const existingTags = Array.isArray(currentLead?.tags) ? currentLead.tags : [];

    // Update lead with enriched location data
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        city,
        zip,
        tags: [...existingTags, state, country].filter(Boolean)
      })
      .eq('id', leadId);

    if (updateError) {
      console.error("Error updating lead:", updateError);
      throw updateError;
    }

    console.log(`Successfully enriched location for lead ${leadId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        location: {
          city,
          state,
          zip,
          country,
          latitude: location.lat,
          longitude: location.lng,
          formatted_address: result.formatted_address,
        },
        nearby_places: nearbyPlaces
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in enrich-location:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
