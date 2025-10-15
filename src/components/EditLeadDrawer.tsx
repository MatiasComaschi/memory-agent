import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, parseCurrency, formatPhone, normalizePhone } from "@/lib/format";

interface EditLeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
}

export function EditLeadDrawer({
  open,
  onOpenChange,
  leadId,
  onSuccess,
}: EditLeadDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [changeNote, setChangeNote] = useState("");
  const [agents, setAgents] = useState<any[]>([]);

  // Load lead data and agents
  useEffect(() => {
    if (open && leadId) {
      loadLeadData();
      loadAgents();
    }
  }, [open, leadId]);

  const loadLeadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (error) throw error;
      setOriginalData(data);
      setFormData(data);
    } catch (error: any) {
      toast.error("Failed to load lead data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      const { data: agentList } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("org_id", profile.org_id);

      if (agentList) setAgents(agentList);
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const addChip = (field: string, value: string) => {
    if (!value.trim()) return;
    const current = formData[field] || [];
    if (!current.includes(value.trim())) {
      updateField(field, [...current, value.trim()]);
    }
  };

  const removeChip = (field: string, value: string) => {
    const current = formData[field] || [];
    updateField(field, current.filter((v: string) => v !== value));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Compute changed fields
      const payload: any = {};
      for (const key of Object.keys(formData)) {
        if (JSON.stringify(formData[key]) !== JSON.stringify(originalData[key])) {
          payload[key] = formData[key];
        }
      }

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('update-lead', {
        body: {
          lead_id: leadId,
          org_id: profile.org_id,
          user_id: user.id,
          payload,
          note: changeNote.trim() || null,
        }
      });

      if (error) throw error;

      if (data.duplicates && data.duplicates.length > 0) {
        const names = data.duplicates.map((d: any) => d.full_name).join(", ");
        toast.warning(`Possible duplicates: ${names}`);
      }

      toast.success(`Lead updated (${data.changed} ${data.changed === 1 ? 'field' : 'fields'} changed)`);
      setChangeNote("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update lead");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Lead</SheetTitle>
          <SheetDescription>
            Update lead information and track changes
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="contact" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="assignment">Assignment</TabsTrigger>
          </TabsList>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name || ""}
                  onChange={(e) => updateField("first_name", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name || ""}
                  onChange={(e) => updateField("last_name", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name || ""}
                onChange={(e) => updateField("full_name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formatPhone(formData.phone) || ""}
                onChange={(e) => updateField("phone", normalizePhone(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="contact_preference">Contact Preference</Label>
              <Select
                value={formData.contact_preference || "any"}
                onValueChange={(value) => updateField("contact_preference", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                We'll prioritize this channel for follow-ups.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="do_not_contact"
                checked={formData.do_not_contact || false}
                onCheckedChange={(checked) => updateField("do_not_contact", checked)}
              />
              <Label htmlFor="do_not_contact">Do Not Contact</Label>
            </div>

            <div>
              <Label htmlFor="communication_notes">Communication Notes</Label>
              <Textarea
                id="communication_notes"
                value={formData.communication_notes || ""}
                onChange={(e) => updateField("communication_notes", e.target.value)}
                placeholder="e.g., Only text before 5pm"
                rows={2}
              />
            </div>
          </TabsContent>

          {/* Search & Budget Tab */}
          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city || ""}
                  onChange={(e) => updateField("city", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state || ""}
                  onChange={(e) => updateField("state", e.target.value)}
                  placeholder="TN"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="postal_code">ZIP Code</Label>
              <Input
                id="postal_code"
                value={formData.postal_code || ""}
                onChange={(e) => updateField("postal_code", e.target.value)}
              />
            </div>

            <div>
              <Label>Neighborhoods</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.neighborhoods || []).map((n: string) => (
                  <Badge key={n} variant="secondary">
                    {n}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeChip("neighborhoods", n)}
                    />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Type and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip("neighborhoods", e.currentTarget.value);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budget_min">Min Budget</Label>
                <Input
                  id="budget_min"
                  value={formData.budget_min ? formatCurrency(formData.budget_min) : ""}
                  onChange={(e) => {
                    const val = parseCurrency(e.target.value);
                    updateField("budget_min", val);
                  }}
                  placeholder="$0"
                />
              </div>
              <div>
                <Label htmlFor="budget_max">Max Budget</Label>
                <Input
                  id="budget_max"
                  value={formData.budget_max ? formatCurrency(formData.budget_max) : ""}
                  onChange={(e) => {
                    const val = parseCurrency(e.target.value);
                    updateField("budget_max", val);
                  }}
                  placeholder="$0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="beds">Bedrooms</Label>
                <Input
                  id="beds"
                  type="number"
                  value={formData.beds || ""}
                  onChange={(e) => updateField("beds", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <Label htmlFor="baths">Bathrooms</Label>
                <Input
                  id="baths"
                  type="number"
                  step="0.5"
                  value={formData.baths || ""}
                  onChange={(e) => updateField("baths", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min_sqft">Min Square Feet</Label>
                <Input
                  id="min_sqft"
                  type="number"
                  value={formData.min_sqft || ""}
                  onChange={(e) => updateField("min_sqft", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div>
                <Label htmlFor="min_lot_sqft">Min Lot Size</Label>
                <Input
                  id="min_lot_sqft"
                  type="number"
                  value={formData.min_lot_sqft || ""}
                  onChange={(e) => updateField("min_lot_sqft", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="has_garage"
                checked={formData.has_garage || false}
                onCheckedChange={(checked) => updateField("has_garage", checked)}
              />
              <Label htmlFor="has_garage">Garage Required</Label>
            </div>

            <div>
              <Label>Must Haves</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.must_haves || []).map((m: string) => (
                  <Badge key={m} variant="secondary">
                    {m}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeChip("must_haves", m)}
                    />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Type and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip("must_haves", e.currentTarget.value);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>

            <div>
              <Label>Nice to Haves</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.nice_to_haves || []).map((n: string) => (
                  <Badge key={n} variant="outline">
                    {n}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => removeChip("nice_to_haves", n)}
                    />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Type and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChip("nice_to_haves", e.currentTarget.value);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
          </TabsContent>

          {/* Timeline & Financing Tab */}
          <TabsContent value="timeline" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="move_in_timeline">Move-in Timeline</Label>
              <Select
                value={formData.move_in_timeline || "unknown"}
                onValueChange={(value) => updateField("move_in_timeline", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asap">ASAP</SelectItem>
                  <SelectItem value="0-3m">0-3 months</SelectItem>
                  <SelectItem value="3-6m">3-6 months</SelectItem>
                  <SelectItem value="6-12m">6-12 months</SelectItem>
                  <SelectItem value="12m+">12+ months</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                A realistic timeframe helps focus inventory.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="preapproved"
                checked={formData.preapproved || false}
                onCheckedChange={(checked) => updateField("preapproved", checked)}
              />
              <Label htmlFor="preapproved">Pre-approved</Label>
              <p className="text-xs text-muted-foreground ml-2">If they have a lender letter.</p>
            </div>

            <div>
              <Label htmlFor="financing_status">Financing Status</Label>
              <Select
                value={formData.financing_status || "unknown"}
                onValueChange={(value) => updateField("financing_status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="researching">Researching</SelectItem>
                  <SelectItem value="preapproved">Pre-approved</SelectItem>
                  <SelectItem value="in_process">In Process</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="lender_name">Lender Name</Label>
              <Input
                id="lender_name"
                value={formData.lender_name || ""}
                onChange={(e) => updateField("lender_name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="showing_availability">Showing Availability</Label>
              <Textarea
                id="showing_availability"
                value={formData.showing_availability || ""}
                onChange={(e) => updateField("showing_availability", e.target.value)}
                placeholder="e.g., Weekends 10–2, Evenings"
                rows={2}
              />
            </div>
          </TabsContent>

          {/* Assignment & Next Actions Tab */}
          <TabsContent value="assignment" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="assigned_agent_id">Assigned Agent</Label>
              <Select
                value={formData.assigned_agent_id || ""}
                onValueChange={(value) => updateField("assigned_agent_id", value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name || agent.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={formData.stage || "New"}
                onValueChange={(value) => updateField("stage", value)}
              >
                <SelectTrigger>
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
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source || "Unknown"}
                onValueChange={(value) => updateField("source", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Zillow">Zillow</SelectItem>
                  <SelectItem value="Realtor">Realtor</SelectItem>
                  <SelectItem value="FB">Facebook</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Import">Import</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="next_action">Next Action</Label>
              <Input
                id="next_action"
                value={formData.next_action || ""}
                onChange={(e) => updateField("next_action", e.target.value)}
                placeholder="e.g., Call to schedule showing"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="change_note">Add note to change history (optional)</Label>
            <Input
              id="change_note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value.slice(0, 140))}
              placeholder="Brief note about these changes"
              maxLength={140}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {changeNote.length}/140 characters
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
