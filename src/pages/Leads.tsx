import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Plus, Search, Filter, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string;
  budget_min: number | null;
  budget_max: number | null;
  beds: number | null;
  baths: number | null;
  city: string | null;
  zip: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const Leads = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | "New" | "Conversation" | "Nurture" | "Hot" | "Under_Contract" | "Closed" | "Lost">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState<{
    full_name: string;
    email: string;
    phone: string;
    source: string;
    stage: string;
    city: string;
    zip: string;
    notes: string;
  }>({
    full_name: "",
    email: "",
    phone: "",
    source: "Manual" as const,
    stage: "New" as const,
    city: "",
    zip: "",
    notes: "",
  });

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      let query = supabase.from("leads").select("*").order("updated_at", { ascending: false });

      if (stageFilter !== "all") {
        query = query.eq("stage", stageFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLeads(data || []);
    } catch (error: any) {
      console.error("Error loading leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Get user's org_id
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase.from("leads").insert([
        {
          full_name: newLead.full_name,
          email: newLead.email || null,
          phone: newLead.phone || null,
          source: newLead.source as any,
          stage: newLead.stage as any,
          city: newLead.city || null,
          zip: newLead.zip || null,
          notes: newLead.notes || null,
          org_id: profile.org_id,
          assigned_user_id: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Lead created successfully!");
      setDialogOpen(false);
      setNewLead({
        full_name: "",
        email: "",
        phone: "",
        source: "Manual",
        stage: "New",
        city: "",
        zip: "",
        notes: "",
      });
      loadLeads();
    } catch (error: any) {
      console.error("Error creating lead:", error);
      toast.error(error.message || "Failed to create lead");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
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

  const filteredLeads = leads.filter((lead) =>
    lead.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                EchoLead
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">Leads</h2>
            <p className="text-muted-foreground">Manage your real estate leads</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Lead</DialogTitle>
                <DialogDescription>Add a new lead to your pipeline</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={newLead.full_name}
                      onChange={(e) =>
                        setNewLead({ ...newLead, full_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="source">Source</Label>
                    <Select
                      value={newLead.source}
                      onValueChange={(value) => setNewLead({ ...newLead, source: value })}
                    >
                      <SelectTrigger id="source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Zillow">Zillow</SelectItem>
                        <SelectItem value="Realtor">Realtor</SelectItem>
                        <SelectItem value="FB">Facebook</SelectItem>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="Referral">Referral</SelectItem>
                        <SelectItem value="Manual">Manual</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stage">Stage</Label>
                    <Select
                      value={newLead.stage}
                      onValueChange={(value) => setNewLead({ ...newLead, stage: value })}
                    >
                      <SelectTrigger id="stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Conversation">Conversation</SelectItem>
                        <SelectItem value="Nurture">Nurture</SelectItem>
                        <SelectItem value="Hot">Hot</SelectItem>
                        <SelectItem value="Under_Contract">Under Contract</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                        <SelectItem value="Lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newLead.city}
                      onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={newLead.zip}
                      onChange={(e) => setNewLead({ ...newLead, zip: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newLead.notes}
                      onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Lead</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={stageFilter} onValueChange={(value) => {
            setStageFilter(value as typeof stageFilter);
            setLoading(true);
            setTimeout(() => loadLeads(), 100);
          }}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Conversation">Conversation</SelectItem>
              <SelectItem value="Nurture">Nurture</SelectItem>
              <SelectItem value="Hot">Hot</SelectItem>
              <SelectItem value="Under_Contract">Under Contract</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
              <SelectItem value="Lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Leads Grid */}
        {filteredLeads.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No leads found. Create your first lead to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="shadow-soft hover:shadow-medium transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-lg">{lead.full_name}</h3>
                      <Badge className={getStageColor(lead.stage)}>
                        {lead.stage.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {lead.email && <p>📧 {lead.email}</p>}
                      {lead.phone && <p>📱 {lead.phone}</p>}
                      {lead.city && <p>📍 {lead.city}{lead.zip && `, ${lead.zip}`}</p>}
                      <p>🔖 Source: {lead.source}</p>
                      <p className="text-xs">
                        Updated {formatDistanceToNow(new Date(lead.updated_at))} ago
                      </p>
                    </div>
                    {lead.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
                        {lead.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
