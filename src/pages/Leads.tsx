import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Plus, Search, Filter, ArrowLeft, Upload, MapPin, MoreVertical, Trash2, Edit, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { DeleteLeadModal } from "@/components/DeleteLeadModal";
import { EditLeadDrawer } from "@/components/EditLeadDrawer";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { getCRMUrl, getCRMStatus, shouldShowEnrichLocation, formatRelativeTime } from "@/lib/crmUtils";

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
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | "New" | "Conversation" | "Nurture" | "Hot" | "Under_Contract" | "Closed" | "Lost">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
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

  // Load connected integrations
  const { data: connectedIntegrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("provider");

      if (error) throw error;
      return data?.map((i: any) => i.provider) || [];
    },
  });

  const loadLeads = async () => {
    try {
      let query = supabase
        .from("leads")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

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

  const syncCrmMutation = useMutation({
    mutationFn: async ({ leadId, provider }: { leadId: string; provider: string }) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error("Lead not found");

      const [firstName, ...lastNameParts] = lead.full_name.split(' ');
      
      // Check if we're updating (has external ID) or creating
      const hasExternalId = 
        (provider === 'hubspot' && (lead as any).hubspot_id) ||
        (provider === 'pipedrive' && (lead as any).pipedrive_id) ||
        (provider === 'followupboss' && (lead as any).fub_id);

      const action = hasExternalId
        ? (provider === 'hubspot' ? 'update_contact' : 
           provider === 'pipedrive' ? 'update_person' : 'update_lead')
        : (provider === 'hubspot' ? 'create_contact' : 
           provider === 'pipedrive' ? 'create_person' : 'create_lead');
      
      const { data, error } = await supabase.functions.invoke('sync-crm', {
        body: {
          provider,
          action,
          leadId,
          leadData: {
            first_name: firstName,
            last_name: lastNameParts.join(' ') || '',
            full_name: lead.full_name,
            email: lead.email,
            phone: lead.phone,
            city: lead.city,
            state: (lead as any).state,
            postal_code: (lead as any).postal_code || lead.zip,
            stage: lead.stage,
            hubspot_id: (lead as any).hubspot_id,
            pipedrive_id: (lead as any).pipedrive_id,
            fub_id: (lead as any).fub_id,
          }
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Successfully synced to ${variables.provider}!`);
      loadLeads();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync with CRM");
    }
  });

  const enrichLocationMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error("Lead not found");

      const address = `${lead.city || ''}, ${lead.zip || ''}`.trim();
      if (!address) throw new Error("No location information available");

      const { data, error } = await supabase.functions.invoke('enrich-location', {
        body: { leadId, address }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Location enriched successfully!");
      loadLeads();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to enrich location");
    }
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async ({ leadId, reasonCode, reasonText }: { leadId: string; reasonCode: string; reasonText: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase.functions.invoke('log-lead-deletion', {
        body: {
          lead_id: leadId,
          reason_code: reasonCode,
          reason_text: reasonText,
          org_id: profile.org_id,
          user_id: user.id,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Lead deleted successfully");
      setDeleteModalOpen(false);
      setLeadToDelete(null);
      loadLeads();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete lead");
    }
  });

  const handleDeleteClick = (leadId: string) => {
    setLeadToDelete(leadId);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = (reasonCode: string, reasonText: string) => {
    if (leadToDelete) {
      deleteLeadMutation.mutate({
        leadId: leadToDelete,
        reasonCode,
        reasonText,
      });
    }
  };

  const handleEditClick = (leadId: string) => {
    setLeadToEdit(leadId);
    setEditDrawerOpen(true);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const handleBulkSync = async (provider: string) => {
    setIsProcessingBulk(true);
    const selectedLeadIds = Array.from(selectedLeads);
    let successCount = 0;
    let failCount = 0;

    for (const leadId of selectedLeadIds) {
      try {
        await syncCrmMutation.mutateAsync({ leadId, provider });
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    setIsProcessingBulk(false);
    setSelectedLeads(new Set());
    
    if (successCount > 0) {
      toast.success(`Synced ${successCount} leads to ${provider}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to sync ${failCount} leads`);
    }
  };

  const handleBulkEnrich = async () => {
    setIsProcessingBulk(true);
    const selectedLeadIds = Array.from(selectedLeads);
    let successCount = 0;
    let failCount = 0;

    for (const leadId of selectedLeadIds) {
      try {
        await enrichLocationMutation.mutateAsync(leadId);
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    setIsProcessingBulk(false);
    setSelectedLeads(new Set());
    
    if (successCount > 0) {
      toast.success(`Enriched ${successCount} locations`);
    }
    if (failCount > 0) {
      toast.error(`Failed to enrich ${failCount} locations`);
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
    <div className="min-h-full">
      {/* Header content moved to App.tsx layout */}
      <div className="flex items-center justify-between px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Leads
          </h1>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>

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
          <>
            {selectedLeads.size > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <Checkbox
                  checked={selectedLeads.size === filteredLeads.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedLeads.size === filteredLeads.length ? 'Deselect all' : 'Select all'}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeads.map((lead) => {
                const hubspotStatus = getCRMStatus(lead, 'hubspot');
                const pipedriveStatus = getCRMStatus(lead, 'pipedrive');
                const fubStatus = getCRMStatus(lead, 'followupboss');
                const needsEnrich = shouldShowEnrichLocation(lead);

                return (
                  <Card key={lead.id} className="shadow-soft hover:shadow-medium transition-shadow">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{lead.full_name}</h3>
                                <TooltipProvider>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {connectedIntegrations?.includes('hubspot') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="text-xs">
                                            {hubspotStatus.isLinked ? '✓' : '○'} HubSpot
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {hubspotStatus.isLinked 
                                            ? `Last synced: ${formatRelativeTime(hubspotStatus.lastSynced)}`
                                            : 'Not linked'}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {connectedIntegrations?.includes('pipedrive') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="text-xs">
                                            {pipedriveStatus.isLinked ? '✓' : '○'} Pipedrive
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {pipedriveStatus.isLinked 
                                            ? `Last synced: ${formatRelativeTime(pipedriveStatus.lastSynced)}`
                                            : 'Not linked'}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {connectedIntegrations?.includes('followupboss') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="text-xs">
                                            {fubStatus.isLinked ? '✓' : '○'} FUB
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {fubStatus.isLinked 
                                            ? `Last synced: ${formatRelativeTime(fubStatus.lastSynced)}`
                                            : 'Not linked'}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {!needsEnrich && (lead as any).location_enriched_at && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="text-xs">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Location
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Enriched: {formatRelativeTime((lead as any).location_enriched_at)}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TooltipProvider>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getStageColor(lead.stage)}>
                                  {lead.stage.replace("_", " ")}
                                </Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditClick(lead.id)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit Lead
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {connectedIntegrations?.includes('hubspot') && hubspotStatus.isLinked && (
                                      <>
                                        <DropdownMenuItem 
                                          onClick={() => window.open(getCRMUrl('hubspot', hubspotStatus.externalId!), '_blank')}
                                        >
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Open in HubSpot
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => syncCrmMutation.mutate({ leadId: lead.id, provider: 'hubspot' })}>
                                          <Upload className="h-4 w-4 mr-2" />
                                          Resync to HubSpot
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {connectedIntegrations?.includes('hubspot') && !hubspotStatus.isLinked && (
                                      <DropdownMenuItem onClick={() => syncCrmMutation.mutate({ leadId: lead.id, provider: 'hubspot' })}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Sync to HubSpot
                                      </DropdownMenuItem>
                                    )}
                                    {connectedIntegrations?.includes('pipedrive') && pipedriveStatus.isLinked && (
                                      <>
                                        <DropdownMenuItem 
                                          onClick={() => window.open(getCRMUrl('pipedrive', pipedriveStatus.externalId!), '_blank')}
                                        >
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Open in Pipedrive
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => syncCrmMutation.mutate({ leadId: lead.id, provider: 'pipedrive' })}>
                                          <Upload className="h-4 w-4 mr-2" />
                                          Resync to Pipedrive
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {connectedIntegrations?.includes('pipedrive') && !pipedriveStatus.isLinked && (
                                      <DropdownMenuItem onClick={() => syncCrmMutation.mutate({ leadId: lead.id, provider: 'pipedrive' })}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Sync to Pipedrive
                                      </DropdownMenuItem>
                                    )}
                                    {connectedIntegrations?.includes('followupboss') && fubStatus.isLinked && (
                                      <>
                                        <DropdownMenuItem 
                                          onClick={() => window.open(getCRMUrl('followupboss', fubStatus.externalId!), '_blank')}
                                        >
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Open in Follow Up Boss
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => syncCrmMutation.mutate({ leadId: lead.id, provider: 'followupboss' })}>
                                          <Upload className="h-4 w-4 mr-2" />
                                          Resync to FUB
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {connectedIntegrations?.includes('followupboss') && !fubStatus.isLinked && (
                                      <DropdownMenuItem onClick={() => syncCrmMutation.mutate({ leadId: lead.id, provider: 'followupboss' })}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Sync to Follow Up Boss
                                      </DropdownMenuItem>
                                    )}
                                    {needsEnrich && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => enrichLocationMutation.mutate(lead.id)}>
                                          <MapPin className="h-4 w-4 mr-2" />
                                          Enrich Location
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteClick(lead.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Lead
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground pl-8">
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
                );
              })}
            </div>
          </>
        )}
      </div>

      <DeleteLeadModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteLeadMutation.isPending}
      />

      {leadToEdit && (
        <EditLeadDrawer
          open={editDrawerOpen}
          onOpenChange={setEditDrawerOpen}
          leadId={leadToEdit}
          onSuccess={loadLeads}
        />
      )}

      <BulkActionsBar
        selectedCount={selectedLeads.size}
        onClearSelection={() => setSelectedLeads(new Set())}
        onSyncToCRM={handleBulkSync}
        onEnrichLocations={handleBulkEnrich}
        isProcessing={isProcessingBulk}
      />
    </div>
  );
};

export default Leads;
