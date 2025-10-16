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
    const { provider, action, leadData, leadId } = await req.json();
    
    console.log(`CRM sync: provider=${provider}, action=${action}, leadId=${leadId}`);

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

    // Get CRM integration credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('provider', provider)
      .single();

    if (!integration) {
      throw new Error(`${provider} integration not connected`);
    }

    let result;

    switch (provider) {
      case 'hubspot':
        result = await syncHubSpot(integration, action, leadData);
        break;
      case 'pipedrive':
        result = await syncPipedrive(integration, action, leadData);
        break;
      case 'followupboss':
        result = await syncFollowUpBoss(integration, action, leadData);
        break;
      default:
        throw new Error(`Unsupported CRM provider: ${provider}`);
    }

    // Update lead with CRM ID and sync status
    if (leadId && result) {
      const updateData: any = {};
      const crmSync: any = {};

      // Extract CRM ID from result
      if (provider === 'hubspot' && result.id) {
        updateData.hubspot_id = result.id;
        crmSync.hubspot = { status: 'ok', ts: new Date().toISOString() };
      } else if (provider === 'pipedrive' && result.data?.id) {
        updateData.pipedrive_id = result.data.id;
        crmSync.pipedrive = { status: 'ok', ts: new Date().toISOString() };
      } else if (provider === 'followupboss' && result.id) {
        updateData.fub_id = result.id;
        crmSync.followupboss = { status: 'ok', ts: new Date().toISOString() };
      }

      // Get current crm_sync data and merge
      const { data: currentLead } = await supabase
        .from('leads')
        .select('crm_sync')
        .eq('id', leadId)
        .single();

      const existingSync = currentLead?.crm_sync || {};
      updateData.crm_sync = { ...existingSync, ...crmSync };

      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in sync-crm:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncHubSpot(integration: any, action: string, leadData: any) {
  const apiKey = integration.metadata?.api_key;
  if (!apiKey) throw new Error("HubSpot API key not configured");

  if (action === 'create_contact' || action === 'update_contact') {
    const properties = {
      firstname: leadData.first_name,
      lastname: leadData.last_name,
      email: leadData.email,
      phone: leadData.phone,
      city: leadData.city,
      state: leadData.state,
      zip: leadData.postal_code,
      hs_lead_status: leadData.stage,
    };

    // Update existing contact if hubspot_id exists
    if (leadData.hubspot_id && action === 'update_contact') {
      const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${leadData.hubspot_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HubSpot API error: ${error}`);
      }

      return await response.json();
    }

    // Create new contact
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot API error: ${error}`);
    }

    return await response.json();
  }

  throw new Error(`Unsupported HubSpot action: ${action}`);
}

async function syncPipedrive(integration: any, action: string, leadData: any) {
  const apiToken = integration.metadata?.api_token || integration.metadata?.api_key;
  const domain = integration.metadata?.domain || 'api';
  
  if (!apiToken) throw new Error("Pipedrive API token not configured");

  if (action === 'create_person' || action === 'update_person') {
    const personData = {
      name: leadData.full_name,
      email: [{ value: leadData.email, primary: true }],
      phone: [{ value: leadData.phone, primary: true }],
    };

    // Update existing person if pipedrive_id exists
    if (leadData.pipedrive_id && action === 'update_person') {
      const response = await fetch(`https://${domain}.pipedrive.com/v1/persons/${leadData.pipedrive_id}?api_token=${apiToken}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(personData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pipedrive API error: ${error}`);
      }

      return await response.json();
    }

    // Create new person
    const response = await fetch(`https://${domain}.pipedrive.com/v1/persons?api_token=${apiToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(personData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pipedrive API error: ${error}`);
    }

    return await response.json();
  }

  throw new Error(`Unsupported Pipedrive action: ${action}`);
}

async function syncFollowUpBoss(integration: any, action: string, leadData: any) {
  const apiKey = integration.metadata?.api_key;
  if (!apiKey) throw new Error("Follow Up Boss API key not configured");

  if (action === 'create_lead' || action === 'update_lead') {
    const personData = {
      firstName: leadData.first_name,
      lastName: leadData.last_name,
      emails: [{ value: leadData.email }],
      phones: [{ value: leadData.phone }],
      city: leadData.city,
      stage: leadData.stage,
    };

    // Update existing lead if fub_id exists
    if (leadData.fub_id && action === 'update_lead') {
      const response = await fetch(`https://api.followupboss.com/v1/people/${leadData.fub_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${btoa(apiKey + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(personData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Follow Up Boss API error: ${error}`);
      }

      return await response.json();
    }

    // Create new lead
    const response = await fetch('https://api.followupboss.com/v1/people', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(personData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Follow Up Boss API error: ${error}`);
    }

    return await response.json();
  }

  throw new Error(`Unsupported Follow Up Boss action: ${action}`);
}
