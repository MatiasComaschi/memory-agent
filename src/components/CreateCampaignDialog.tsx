import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateCampaignDialog({ open, onOpenChange, onSuccess }: CreateCampaignDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger_type: "price_drop",
    message_template: "",
    target_city: "",
    target_zip: "",
    min_budget: "",
    max_budget: "",
    channels: ["email"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) throw new Error("Organization not found");

      const targetCriteria: any = {};
      if (formData.target_city) targetCriteria.city = formData.target_city;
      if (formData.target_zip) targetCriteria.zip = formData.target_zip;
      if (formData.min_budget) targetCriteria.budget_min = parseFloat(formData.min_budget);
      if (formData.max_budget) targetCriteria.budget_max = parseFloat(formData.max_budget);

      const { error } = await supabase.from("campaigns").insert({
        org_id: profile.org_id,
        created_by: user.id,
        name: formData.name,
        description: formData.description,
        trigger_type: formData.trigger_type,
        message_template: formData.message_template,
        target_criteria: targetCriteria,
        channels: formData.channels,
        status: "draft",
      });

      if (error) throw error;

      toast({
        title: "Campaign created",
        description: "Your campaign has been created successfully.",
      });

      onSuccess();
      onOpenChange(false);
      setFormData({
        name: "",
        description: "",
        trigger_type: "price_drop",
        message_template: "",
        target_city: "",
        target_zip: "",
        min_budget: "",
        max_budget: "",
        channels: ["email"],
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Smart Campaign</DialogTitle>
          <DialogDescription>
            Your campaign will automatically trigger personalized AI-composed messages when conditions are met.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Price Drop Alert - Downtown"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this campaign about?"
            />
          </div>

          <div>
            <Label htmlFor="trigger_type">Trigger Type</Label>
            <Select
              value={formData.trigger_type}
              onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_drop">Price Drop</SelectItem>
                <SelectItem value="new_listing">New Listing</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="message_template">Message Template</Label>
            <Textarea
              id="message_template"
              value={formData.message_template}
              onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
              placeholder="Use {lead_name}, {city}, {price} as placeholders. AI will compose personalized messages."
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target_city">Target City (Optional)</Label>
              <Input
                id="target_city"
                value={formData.target_city}
                onChange={(e) => setFormData({ ...formData, target_city: e.target.value })}
                placeholder="e.g., New York"
              />
            </div>
            <div>
              <Label htmlFor="target_zip">Target ZIP (Optional)</Label>
              <Input
                id="target_zip"
                value={formData.target_zip}
                onChange={(e) => setFormData({ ...formData, target_zip: e.target.value })}
                placeholder="e.g., 10001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min_budget">Min Budget (Optional)</Label>
              <Input
                id="min_budget"
                type="number"
                value={formData.min_budget}
                onChange={(e) => setFormData({ ...formData, min_budget: e.target.value })}
                placeholder="e.g., 250000"
              />
            </div>
            <div>
              <Label htmlFor="max_budget">Max Budget (Optional)</Label>
              <Input
                id="max_budget"
                type="number"
                value={formData.max_budget}
                onChange={(e) => setFormData({ ...formData, max_budget: e.target.value })}
                placeholder="e.g., 500000"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Campaign
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}