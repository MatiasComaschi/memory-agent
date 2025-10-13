import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, TrendingUp, Clock, Zap, Search, MessageSquare, Mail, User, Brain } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";

interface Lead {
  id: string;
  full_name: string;
  stage: string;
  source: string;
  city: string | null;
  updated_at: string;
  email?: string;
  phone?: string;
}

interface IntentSnapshot {
  urgency_score: number;
  sentiment: string;
  purchase_window: string;
  gating_factor: string;
}

interface WhisperCard {
  lead: Lead;
  daysSilent: number;
  urgency: "high" | "medium" | "low";
  trigger?: string;
  intent?: IntentSnapshot;
}

const Dashboard = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [whisperCards, setWhisperCards] = useState<WhisperCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Message composition state
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");

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

      // Get intent snapshots for leads
      const leadIds = (data || []).map(l => l.id);
      const { data: intentData } = await supabase
        .from("intent_snapshots")
        .select("*")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      // Create a map of latest intent per lead
      const intentMap = new Map();
      intentData?.forEach(intent => {
        if (!intentMap.has(intent.lead_id)) {
          intentMap.set(intent.lead_id, intent);
        }
      });

      // Generate whisper cards with AI insights
      const cards: WhisperCard[] = (data || [])
        .slice(0, 10)
        .map((lead) => {
          const daysSilent = Math.floor(
            (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          const intent = intentMap.get(lead.id);
          let urgency: "high" | "medium" | "low" = "low";
          
          // Use AI urgency score if available
          if (intent?.urgency_score) {
            if (intent.urgency_score >= 70) urgency = "high";
            else if (intent.urgency_score >= 40) urgency = "medium";
          } else {
            // Fallback to time-based urgency
            if (daysSilent > 30) urgency = "high";
            else if (daysSilent > 14) urgency = "medium";
          }

          return {
            lead,
            daysSilent,
            urgency,
            trigger: daysSilent > 14 ? `Silent for ${daysSilent} days` : undefined,
            intent,
          };
        })
        .sort((a, b) => {
          // Sort by AI urgency score first, then by days silent
          const scoreA = a.intent?.urgency_score || 0;
          const scoreB = b.intent?.urgency_score || 0;
          return scoreB - scoreA;
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

  const analyzeIntentMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.functions.invoke('analyze-lead-intent', {
        body: { leadId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("AI analysis complete!");
      loadDashboardData(); // Refresh to show new insights
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to analyze lead intent");
    }
  });

  const generateMessageMutation = useMutation({
    mutationFn: async ({ leadId, messageType }: { leadId: string; messageType: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-message', {
        body: { leadId, messageType }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (variables.messageType === 'email' && data.message) {
        setEmailSubject(data.message.subject);
        setEmailMessage(data.message.body);
      } else if (variables.messageType === 'sms' && data.message) {
        setSmsMessage(data.message.message);
      }
      toast.success("AI message generated!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate message");
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ leadId, subject, message }: { leadId: string; subject: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { leadId, subject, message }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent successfully!");
      setEmailDialogOpen(false);
      setEmailSubject("");
      setEmailMessage("");
      loadDashboardData();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send email");
    }
  });

  const sendSmsMutation = useMutation({
    mutationFn: async ({ leadId, message }: { leadId: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { leadId, message }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("SMS sent successfully!");
      setSmsDialogOpen(false);
      setSmsMessage("");
      loadDashboardData();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send SMS");
    }
  });

  const handleOpenSmsDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setSmsMessage(`Hi ${lead.full_name.split(' ')[0]}, `);
    setSmsDialogOpen(true);
  };

  const handleOpenEmailDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setEmailSubject("Following up on your inquiry");
    setEmailMessage(`Hi ${lead.full_name.split(' ')[0]},\n\n`);
    setEmailDialogOpen(true);
  };

  const handleGenerateAiMessage = (messageType: 'email' | 'sms') => {
    if (!selectedLead) return;
    generateMessageMutation.mutate({ leadId: selectedLead.id, messageType });
  };

  const handleSendEmail = () => {
    if (!selectedLead || !emailSubject || !emailMessage) {
      toast.error("Please fill in all fields");
      return;
    }
    sendEmailMutation.mutate({ 
      leadId: selectedLead.id, 
      subject: emailSubject, 
      message: emailMessage 
    });
  };

  const handleSendSms = () => {
    if (!selectedLead || !smsMessage) {
      toast.error("Please enter a message");
      return;
    }
    sendSmsMutation.mutate({ 
      leadId: selectedLead.id, 
      message: smsMessage 
    });
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
                          {card.intent && (
                            <Badge variant="outline" className="border-primary text-primary">
                              <Brain className="h-3 w-3 mr-1" />
                              AI Score: {card.intent.urgency_score}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span>Source: {card.lead.source}</span>
                          {card.lead.city && <span>Location: {card.lead.city}</span>}
                          <span>
                            Last activity: {formatDistanceToNow(new Date(card.lead.updated_at))} ago
                          </span>
                        </div>
                        {card.intent && (
                          <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
                            <Badge variant="secondary">
                              {card.intent.sentiment} sentiment
                            </Badge>
                            <Badge variant="secondary">
                              {card.intent.purchase_window.replace('_', ' ')} timeframe
                            </Badge>
                            <Badge variant="secondary">
                              {card.intent.gating_factor} concern
                            </Badge>
                          </div>
                        )}
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
                        {!card.intent && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => analyzeIntentMutation.mutate(card.lead.id)}
                            disabled={analyzeIntentMutation.isPending}
                          >
                            <Brain className="h-4 w-4 mr-2" />
                            {analyzeIntentMutation.isPending ? "Analyzing..." : "AI Analyze"}
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleOpenSmsDialog(card.lead)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send SMS
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenEmailDialog(card.lead)}
                        >
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

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS to {selectedLead?.full_name}</DialogTitle>
            <DialogDescription>
              Compose your text message below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter your message..."
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Character count: {smsMessage.length} (SMS segments: {Math.ceil(smsMessage.length / 160)})
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleGenerateAiMessage('sms')}
              disabled={generateMessageMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateMessageMutation.isPending ? "Generating..." : "AI Generate"}
            </Button>
            <Button variant="outline" onClick={() => setSmsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendSms}
              disabled={sendSmsMutation.isPending}
            >
              {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Email to {selectedLead?.full_name}</DialogTitle>
            <DialogDescription>
              Compose your email below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Subject</label>
              <Input
                placeholder="Email subject..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Message</label>
              <Textarea
                placeholder="Enter your email message..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={12}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleGenerateAiMessage('email')}
              disabled={generateMessageMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateMessageMutation.isPending ? "Generating..." : "AI Generate"}
            </Button>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending}
            >
              {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
