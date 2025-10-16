import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

export interface DashboardKPIs {
  newLeadsToday: number;
  newLeads7d: number;
  newLeads30d: number;
  hotLeadCount: number;
  silentLeadCount: number;
  sla15minPct7d: number;
  contactability30d: number;
  activeCampaigns: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  funnel: Array<{ stage: string; count: number; color: string }>;
  leadsDaily: Array<{ date: string; [key: string]: string | number }>;
  responseTimeBuckets: Array<{ bucket: string; count: number }>;
  heatmap: Array<{ day: number; hour: number; avgUrgency: number; count: number }>;
  campaigns: Array<{ id: string; name: string; sent: number; delivered: number; failed: number; status: string }>;
  p50ResponseTime?: number;
  p90ResponseTime?: number;
}

const stageColors: Record<string, string> = {
  New: "bg-blue-500",
  Conversation: "bg-purple-500",
  Nurture: "bg-yellow-500",
  Hot: "bg-orange-500",
  Under_Contract: "bg-green-500",
  Closed: "bg-emerald-600",
  Lost: "bg-gray-500",
};

const stageOrder = ["New", "Conversation", "Nurture", "Hot", "Under_Contract", "Closed", "Lost"];

export const fetchDashboardData = async (orgId: string, period: "7d" | "30d" | "90d" = "30d"): Promise<DashboardData> => {
  const now = new Date();
  const today = startOfDay(now);
  const days7Ago = subDays(now, 7);
  const days30Ago = subDays(now, 30);
  const daysAgo = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const periodStart = subDays(now, daysAgo);

  // Fetch all data in parallel
  const [
    leadsResult,
    latestIntentResult,
    lastInteractionResult,
    firstContactResult,
    stageCounts,
    leadsDaily,
    campaignsData,
    interactionsData,
  ] = await Promise.all([
    supabase.from("leads").select("*").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("v_latest_intent").select("*"),
    supabase.from("v_last_interaction").select("*").eq("org_id", orgId),
    supabase.from("v_first_contact").select("*").eq("org_id", orgId),
    supabase.from("v_stage_counts").select("*").eq("org_id", orgId),
    supabase.from("v_leads_daily").select("*").eq("org_id", orgId).gte("day", format(periodStart, "yyyy-MM-dd")),
    supabase.from("v_campaign_perf").select("*").eq("org_id", orgId).limit(5),
    supabase.from("interactions").select("lead_id, ts, channel, direction").gte("ts", days30Ago.toISOString()),
  ]);

  const leads = leadsResult.data || [];
  const latestIntent = latestIntentResult.data || [];
  const lastInteraction = lastInteractionResult.data || [];
  const firstContact = firstContactResult.data || [];

  // Create maps for quick lookup
  const intentMap = new Map(latestIntent.map(i => [i.lead_id, i]));
  const lastInteractionMap = new Map(lastInteraction.map(i => [i.lead_id, i]));
  const firstContactMap = new Map(firstContact.map(fc => [fc.lead_id, fc]));

  // Calculate KPIs
  const newLeadsToday = leads.filter(l => new Date(l.created_at) >= today).length;
  const newLeads7d = leads.filter(l => new Date(l.created_at) >= days7Ago).length;
  const newLeads30d = leads.filter(l => new Date(l.created_at) >= days30Ago).length;

  const hotLeadCount = leads.filter(l => {
    const intent = intentMap.get(l.id);
    return intent && intent.urgency_score >= 0.7;
  }).length;

  const silentLeadCount = leads.filter(l => {
    const lastInt = lastInteractionMap.get(l.id);
    const lastDate = lastInt?.last_interaction_at ? new Date(lastInt.last_interaction_at) : new Date(l.created_at);
    const daysSilent = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSilent > 7;
  }).length;

  // SLA 15min calculation (leads created in last 7 days)
  const recentLeads = leads.filter(l => new Date(l.created_at) >= days7Ago);
  const slaMetLeads = recentLeads.filter(l => {
    const fc = firstContactMap.get(l.id);
    if (!fc?.first_contact_at) return false;
    const minutesDiff = (new Date(fc.first_contact_at).getTime() - new Date(l.created_at).getTime()) / (1000 * 60);
    return minutesDiff <= 15;
  });
  const sla15minPct7d = recentLeads.length > 0 ? (slaMetLeads.length / recentLeads.length) * 100 : 0;

  // Contactability (% with inbound interaction in last 30d)
  const recent30dLeads = leads.filter(l => new Date(l.created_at) >= days30Ago);
  const inboundInteractions = new Set(
    (interactionsData.data || [])
      .filter(i => i.direction === "inbound")
      .map(i => i.lead_id)
  );
  const contactableLeads = recent30dLeads.filter(l => inboundInteractions.has(l.id));
  const contactability30d = recent30dLeads.length > 0 ? (contactableLeads.length / recent30dLeads.length) * 100 : 0;

  const activeCampaigns = (campaignsData.data || []).filter(c => c.status === "active").length;

  // Funnel data
  const funnelData = stageOrder.map(stage => {
    const stageData = (stageCounts.data || []).find(s => s.stage === stage);
    return {
      stage,
      count: stageData?.cnt || 0,
      color: stageColors[stage] || "bg-gray-500",
    };
  }).filter(s => s.count > 0);

  // Leads daily chart
  const dailyMap = new Map<string, Record<string, number>>();
  (leadsDaily.data || []).forEach(row => {
    const dateKey = row.day as string;
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {});
    }
    const dayData = dailyMap.get(dateKey)!;
    dayData[row.source as string] = row.leads as number;
  });

  const leadsDailyChart = Array.from(dailyMap.entries())
    .map(([date, sources]) => ({ date, ...sources }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Response time histogram
  const responseTimes: number[] = [];
  recentLeads.forEach(l => {
    const fc = firstContactMap.get(l.id);
    if (fc?.first_contact_at) {
      const minutes = (new Date(fc.first_contact_at).getTime() - new Date(l.created_at).getTime()) / (1000 * 60);
      responseTimes.push(minutes);
    }
  });

  const buckets = [
    { label: "0-5m", min: 0, max: 5, count: 0 },
    { label: "5-15m", min: 5, max: 15, count: 0 },
    { label: "15-60m", min: 15, max: 60, count: 0 },
    { label: "1-24h", min: 60, max: 1440, count: 0 },
    { label: "24h+", min: 1440, max: Infinity, count: 0 },
  ];

  responseTimes.forEach(time => {
    const bucket = buckets.find(b => time >= b.min && time < b.max);
    if (bucket) bucket.count++;
  });

  const responseTimeBuckets = buckets.map(b => ({ bucket: b.label, count: b.count }));

  // Calculate percentiles
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p50ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p90ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.9)];

  // Heatmap data (placeholder - would need interaction timestamps with intent)
  const heatmap: Array<{ day: number; hour: number; avgUrgency: number; count: number }> = [];

  return {
    kpis: {
      newLeadsToday,
      newLeads7d,
      newLeads30d,
      hotLeadCount,
      silentLeadCount,
      sla15minPct7d,
      contactability30d,
      activeCampaigns,
    },
    funnel: funnelData,
    leadsDaily: leadsDailyChart,
    responseTimeBuckets,
    heatmap,
    campaigns: (campaignsData.data || []).map(c => ({
      id: c.campaign_id,
      name: c.name,
      sent: c.sent || 0,
      delivered: c.delivered || 0,
      failed: c.failed || 0,
      status: c.status,
    })),
    p50ResponseTime,
    p90ResponseTime,
  };
};
