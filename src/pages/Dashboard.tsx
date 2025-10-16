import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LeadsFunnel } from "@/components/dashboard/LeadsFunnel";
import { LeadsDailyChart } from "@/components/dashboard/LeadsDailyChart";
import { ResponseTimeHistogram } from "@/components/dashboard/ResponseTimeHistogram";
import { IntentHeatmap } from "@/components/dashboard/IntentHeatmap";
import { CampaignPerformance } from "@/components/dashboard/CampaignPerformance";
import { fetchDashboardData } from "@/lib/dashboardQueries";
import { useRealtimeDashboard } from "@/hooks/useRealtimeDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState<string>("");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    const fetchOrgId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .single();
        if (data?.org_id) {
          setOrgId(data.org_id);
        }
      }
    };
    fetchOrgId();
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", orgId, period],
    queryFn: () => fetchDashboardData(orgId, period),
    enabled: !!orgId,
    staleTime: 30000, // 30 seconds
  });

  const { isLive, lastUpdate } = useRealtimeDashboard({
    orgId,
    onRefresh: () => refetch(),
  });

  const handleStageClick = (stage: string) => {
    navigate(`/leads?stage=${stage}`);
  };

  const handleCampaignClick = (id: string) => {
    navigate(`/campaigns?id=${id}`);
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Real-time insights into your leads and campaigns</p>
        </div>
        <div className="flex items-center gap-4">
          {isLive && (
            <Badge variant="outline" className="gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="New Leads (Today)"
          value={data?.kpis.newLeadsToday || 0}
          onClick={() => navigate("/leads?filter=today")}
          loading={isLoading}
        />
        <KpiCard
          title="Hot Leads"
          value={data?.kpis.hotLeadCount || 0}
          onClick={() => navigate("/leads?filter=hot")}
          loading={isLoading}
        />
        <KpiCard
          title="Silent Leads"
          value={data?.kpis.silentLeadCount || 0}
          onClick={() => navigate("/leads?filter=silent")}
          loading={isLoading}
        />
        <KpiCard
          title="15-Min SLA (7d)"
          value={`${data?.kpis.sla15minPct7d.toFixed(1) || 0}%`}
          loading={isLoading}
        />
        <KpiCard
          title="New Leads (7d)"
          value={data?.kpis.newLeads7d || 0}
          loading={isLoading}
        />
        <KpiCard
          title="New Leads (30d)"
          value={data?.kpis.newLeads30d || 0}
          loading={isLoading}
        />
        <KpiCard
          title="Contactability (30d)"
          value={`${data?.kpis.contactability30d.toFixed(1) || 0}%`}
          loading={isLoading}
        />
        <KpiCard
          title="Active Campaigns"
          value={data?.kpis.activeCampaigns || 0}
          onClick={() => navigate("/campaigns")}
          loading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => navigate("/leads?filter=silent")}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          View Silent Leads
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/campaigns/new")}
          className="gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Start Campaign
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/leads?filter=hot")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Message Hot Leads
        </Button>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsFunnel
          data={data?.funnel || []}
          onStageClick={handleStageClick}
          loading={isLoading}
        />
        <LeadsDailyChart
          data={data?.leadsDaily || []}
          period={period}
          onPeriodChange={setPeriod}
          loading={isLoading}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResponseTimeHistogram
          data={data?.responseTimeBuckets || []}
          p50={data?.p50ResponseTime}
          p90={data?.p90ResponseTime}
          loading={isLoading}
        />
        <IntentHeatmap
          data={data?.heatmap || []}
          loading={isLoading}
        />
      </div>

      {/* Campaign Performance */}
      <CampaignPerformance
        data={data?.campaigns || []}
        onCampaignClick={handleCampaignClick}
        loading={isLoading}
      />
    </div>
  );
}
