import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const NUM_FIELDS = new Set(["budget_min", "budget_max", "beds", "baths", "min_sqft", "min_lot_sqft"]);

function sanitize(input: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === "" || v === undefined) {
      out[k] = null;
      continue;
    }
    if (NUM_FIELDS.has(k)) {
      const n = Number(String(v).replace(/[$,]/g, ""));
      out[k] = Number.isFinite(n) ? n : null;
    } else if (k === "postal_code") {
      out[k] = String(v).trim();
    } else if (k === "email") {
      out[k] = String(v).trim().toLowerCase();
    } else if (k === "phone") {
      out[k] = String(v).replace(/[^\d+]/g, "");
    } else if (Array.isArray(v)) {
      out[k] = v.filter((x) => String(x || "").trim() !== "");
    } else if (typeof v === "string") {
      out[k] = v.trim();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function computeDiffs(before: Record<string, any>, after: Record<string, any>) {
  const changes: Array<{ field: string; from: any; to: any }> = [];
  for (const [k, newVal] of Object.entries(after)) {
    const oldVal = before[k];
    const a = newVal === undefined ? null : newVal;
    const b = oldVal === undefined ? null : oldVal;
    const same = JSON.stringify(a) === JSON.stringify(b);
    if (!same) changes.push({ field: k, from: b, to: a });
  }
  return changes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { lead_id, org_id, user_id, payload, note } = await req.json();

    if (!lead_id || !org_id || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current lead
    const { data: before, error: getErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (getErr || !before) {
      console.error("Lead fetch error:", getErr);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (before.org_id !== org_id) {
      return new Response(
        JSON.stringify({ error: "Organization mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize incoming updates
    const clean = sanitize(payload);

    // Basic validation: email format if present
    if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute diffs (only for keys present in payload)
    const diffs = computeDiffs(before, clean);
    if (!diffs.length) {
      return new Response(
        JSON.stringify({ ok: true, changed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update lead
    const { error: updErr } = await supabase
      .from("leads")
      .update(clean)
      .eq("id", lead_id);

    if (updErr) {
      console.error("Lead update error:", updErr);
      throw updErr;
    }

    // Insert change history
    await supabase.from("lead_change_history").insert({
      org_id,
      lead_id,
      user_id: user_id || null,
      changes: diffs,
      note: note || null
    });

    // Insert audit log
    await supabase.from("audit_logs").insert({
      org_id,
      user_id: user_id || null,
      action: "UPDATE_LEAD",
      entity: "lead",
      entity_id: lead_id,
      meta: { fields: diffs.map(d => d.field) }
    });

    // Check for duplicates if email or phone changed
    const emailChanged = diffs.some(d => d.field === "email");
    const phoneChanged = diffs.some(d => d.field === "phone");
    let duplicates: Array<{ id: string; full_name: string }> = [];

    if (emailChanged || phoneChanged) {
      const { data: dupes } = await supabase
        .from("leads")
        .select("id, full_name")
        .eq("org_id", org_id)
        .neq("id", lead_id)
        .or(`email.eq.${clean.email || ""},phone.eq.${clean.phone || ""}`)
        .limit(3);
      
      if (dupes && dupes.length > 0) {
        duplicates = dupes;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, changed: diffs.length, duplicates }),
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
