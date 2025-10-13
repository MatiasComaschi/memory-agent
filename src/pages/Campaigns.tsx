import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Trash2 } from "lucide-react";
import { CreateCampaignDialog } from "@/components/CreateCampaignDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Campaigns = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campaign updated",
        description: "Campaign status has been changed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Campaign deleted",
        description: "Campaign has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success text-success-foreground";
      case "paused":
        return "bg-warning text-warning-foreground";
      case "draft":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Campaigns</h2>
          <p className="text-muted-foreground">Create and manage automated outreach campaigns</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading campaigns...</p>
          </CardContent>
        </Card>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4">
          {campaigns.map((campaign: any) => (
            <Card key={campaign.id} className="shadow-soft">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{campaign.name}</CardTitle>
                      <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
                    </div>
                    <CardDescription>{campaign.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: campaign.id,
                            currentStatus: campaign.status,
                          })
                        }
                      >
                        {campaign.status === "active" ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(campaign.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Trigger:</span>{" "}
                    <span className="font-medium">{campaign.trigger_type.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Channels:</span>{" "}
                    <span className="font-medium">{campaign.channels.join(", ")}</span>
                  </div>
                  {campaign.target_criteria?.city && (
                    <div>
                      <span className="text-muted-foreground">Target City:</span>{" "}
                      <span className="font-medium">{campaign.target_criteria.city}</span>
                    </div>
                  )}
                  {campaign.target_criteria?.zip && (
                    <div>
                      <span className="text-muted-foreground">Target ZIP:</span>{" "}
                      <span className="font-medium">{campaign.target_criteria.zip}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              No campaigns yet. Create your first campaign to automate lead outreach!
            </p>
          </CardContent>
        </Card>
      )}

      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["campaigns"] })}
      />
    </div>
  );
};

export default Campaigns;