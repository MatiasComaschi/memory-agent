import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, TrendingUp, Clock, Zap, Search, MessageSquare, Mail, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Lead {
  id: string;
  full_name: string;
  stage: string;
  source: string;
  city: string | null;
  updated_at: string;
}

interface WhisperCard {
  lead: Lead;
  daysSilent: number;
  urgency: "high" | "medium" | "low";
  trigger?: string;
}

const Dashboard = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [whisperCards, setWhisperCards] = useState<WhisperCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      setLeads(data || []);

      // Generate whisper cards (mock logic for now)
      const cards: WhisperCard[] = (data || []).slice(0, 5).map((lead) => {
        const daysSilent = Math.floor(
          (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        let urgency: "high" | "medium" | "low" = "low";
        if (daysSilent > 30) urgency = "high";
        else if (daysSilent > 14) urgency = "medium";

        return {
          lead,
          daysSilent,
          urgency,
          trigger: daysSilent > 21 ? `Silent for ${daysSilent} days` : undefined,
        };
      });

      setWhisperCards(cards);
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Hot":
        return "bg-destructive text-destructive-foreground";
      case "Under_Contract":
        return "bg-success text-success-foreground";
      case "Closed":
        return "bg-success text-success-foreground";
      case "Lost":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-accent text-accent-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Header content moved to App.tsx layout */}
      <div className="flex items-center justify-between px-8 py-4 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Dashboard
          </h1>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Silent Leads</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{whisperCards.length}</div>
              <p className="text-xs text-muted-foreground">Over 21 days</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter((l) => l.stage === "Hot").length}
              </div>
              <p className="text-xs text-muted-foreground">High urgency</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads.length}</div>
              <p className="text-xs text-muted-foreground">All active</p>
            </CardContent>
          </Card>
        </div>

        {/* Whisper Feed */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Whisper Feed</h2>
              <p className="text-muted-foreground">Leads that need your attention</p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            {whisperCards.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="pt-6 text-center">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No urgent leads right now. Great job staying on top of things!
                  </p>
                </CardContent>
              </Card>
            ) : (
              whisperCards.map((card) => (
                <Card key={card.lead.id} className="shadow-soft hover:shadow-medium transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{card.lead.full_name}</h3>
                          <Badge className={getStageColor(card.lead.stage)}>
                            {card.lead.stage.replace("_", " ")}
                          </Badge>
                          <Badge className={getUrgencyColor(card.urgency)}>
                            {card.urgency}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span>Source: {card.lead.source}</span>
                          {card.lead.city && <span>Location: {card.lead.city}</span>}
                          <span>
                            Last activity: {formatDistanceToNow(new Date(card.lead.updated_at))} ago
                          </span>
                        </div>
                        {card.trigger && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="border-warning text-warning">
                              <Clock className="h-3 w-3 mr-1" />
                              {card.trigger}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" variant="default">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send SMS
                        </Button>
                        <Button size="sm" variant="outline">
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
