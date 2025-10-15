import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

async function aiClassify(reason_code: string, reason_text: string): Promise<{ai_topic: string, ai_summary: string}> {
  try {
    const prompt = `Classify this deletion reason for a real estate lead into a short topic and write a 1-line insight (<=140 chars).
Return strict JSON { "ai_topic": "...", "ai_summary": "..." }.
reason_code: ${reason_code}
reason_text: ${reason_text}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
      })
    });

    if (!res.ok) {
      console.error("AI classification failed:", await res.text());
      throw new Error("AI failed");
    }

    const json = await res.json();
    const content = json.choices[0].message.content;
    
    // Try to parse JSON from the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ai_topic: parsed.ai_topic || reason_code,
        ai_summary: (parsed.ai_summary || reason_text).slice(0, 140)
      };
    }
    
    throw new Error("No JSON found");
  } catch (error) {
    console.error("AI classification error:", error);
    return {
      ai_topic: reason_code,
      ai_summary: reason_text.slice(0, 140)
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { lead_id, reason_code, reason_text, org_id, user_id } = await req.json();

    if (!lead_id || !reason_code || !reason_text || !org_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reason_text.length > 100) {
      return new Response(
        JSON.stringify({ error: "Reason must be 100 characters or less" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, org_id, full_name, email, phone, city, zip, stage, source, created_at, updated_at")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      console.error("Lead fetch error:", leadErr);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (lead.org_id !== org_id) {
      return new Response(
        JSON.stringify({ error: "Organization mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI classify (async, don't block on failure)
    const { ai_topic, ai_summary } = await aiClassify(reason_code, reason_text);

    // Log deletion
    const { error: insErr } = await supabase.from("lead_deletions").insert({
      org_id,
      lead_id,
      user_id: user_id || null,
      reason_code,
      reason_text,
      ai_topic,
      ai_summary,
      lead_snapshot: lead
    });

    if (insErr) {
      console.error("Insert deletion log error:", insErr);
      throw insErr;
    }

    // Soft delete
    const { error: delErr } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", lead_id);

    if (delErr) {
      console.error("Soft delete error:", delErr);
      throw delErr;
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      org_id,
      user_id: user_id || null,
      action: "DELETE_LEAD",
      entity: "lead",
      entity_id: lead_id,
      meta: { reason_code, reason_text, ai_topic, ai_summary }
    });

    return new Response(
      JSON.stringify({ ok: true, ai_topic, ai_summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: String(error?.message || error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
