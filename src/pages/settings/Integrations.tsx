import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Users2, Sparkles, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { initiateGmailOAuth, initiateMicrosoft365OAuth } from "@/lib/googleOAuth";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSearchParams } from "react-router-dom";

const integrations = [
  {
    category: "Email Integration",
    items: [
      { 
        name: "Gmail", 
        description: "Sync emails and send messages", 
        icon: Mail, 
        provider: "gmail",
        requiresOAuth: true 
      },
      { 
        name: "Microsoft 365", 
        description: "Outlook integration", 
        icon: Mail, 
        provider: "microsoft365",
        requiresOAuth: true 
      },
    ],
  },
  {
    category: "SMS Integration",
    items: [
      { 
        name: "Twilio", 
        description: "Send and receive SMS", 
        icon: MessageSquare, 
        provider: "twilio",
        requiresOAuth: false 
      },
    ],
  },
  {
    category: "CRM Integration",
    items: [
      { 
        name: "HubSpot", 
        description: "Sync contacts and deals", 
        icon: Users2, 
        provider: "hubspot",
        requiresOAuth: true 
      },
      { 
        name: "Pipedrive", 
        description: "CRM integration", 
        icon: Users2, 
        provider: "pipedrive",
        requiresOAuth: true 
      },
      { 
        name: "Follow Up Boss", 
        description: "Real estate CRM", 
        icon: Users2, 
        provider: "followupboss",
        requiresOAuth: true 
      },
    ],
  },
  {
    category: "AI Integration",
    items: [
      { 
        name: "OpenAI", 
        description: "AI message generation", 
        icon: Sparkles, 
        provider: "openai",
        requiresOAuth: false 
      },
    ],
  },
  {
    category: "Location Integration",
    items: [
      { 
        name: "Google Maps", 
        description: "Location data", 
        icon: MapPin, 
        provider: "googlemaps",
        requiresOAuth: false 
      },
    ],
  },
];

const Integrations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apiKeyDialog, setApiKeyDialog] = useState<{ provider: string; name: string } | null>(null);
  const [apiKey, setApiKey] = useState("");

  // Handle OAuth callback from Gmail
  useEffect(() => {
    const gmailStatus = searchParams.get("gmail");
    const tempToken = searchParams.get("temp_token");
    const error = searchParams.get("error");

    if (error) {
      toast({
        title: "Connection failed",
        description: error,
        variant: "destructive",
      });
      // Clear error from URL
      searchParams.delete("error");
      setSearchParams(searchParams);
      return;
    }

    if (gmailStatus === "connected" && tempToken) {
      // Complete the integration by storing tokens with the user's org_id
      const completeGmailIntegration = async () => {
        try {
          const tokenData = JSON.parse(atob(tempToken));
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          const { data: profile } = await supabase
            .from("profiles")
            .select("org_id")
            .eq("id", user.id)
            .single();

          if (!profile?.org_id) throw new Error("Organization not found");

          const { error: insertError } = await supabase.from("integrations").upsert({
            org_id: profile.org_id,
            provider: "gmail",
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: tokenData.token_expires_at,
            metadata: { scope: tokenData.scope },
          }, {
            onConflict: "org_id,provider",
          });

          if (insertError) throw insertError;

          toast({
            title: "Gmail connected",
            description: "Your Gmail account has been successfully connected.",
          });

          queryClient.invalidateQueries({ queryKey: ["integrations"] });
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          // Clear params from URL
          searchParams.delete("gmail");
          searchParams.delete("temp_token");
          setSearchParams(searchParams);
        }
      };

      completeGmailIntegration();
    }
  }, [searchParams, setSearchParams, toast, queryClient]);

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

  const connectMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey?: string }) => {
      if (provider === "gmail") {
        initiateGmailOAuth();
        return;
      }

      if (provider === "microsoft365") {
        initiateMicrosoft365OAuth();
        return;
      }

      // For API key based services
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!profile?.org_id) throw new Error("Organization not found");

      const { error } = await supabase.from("integrations").insert({
        org_id: profile.org_id,
        provider,
        access_token: apiKey || null,
        metadata: apiKey ? { api_key: apiKey } : {},
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({
        title: "Integration connected",
        description: "Integration has been enabled.",
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

  const disconnectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const { error } = await supabase
        .from("integrations")
        .delete()
        .eq("provider", provider);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({
        title: "Integration disconnected",
        description: "Integration has been disabled.",
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

  const isConnected = (provider: string) => {
    return connectedIntegrations?.includes(provider);
  };

  const handleConnect = (integration: any) => {
    if (isConnected(integration.provider)) {
      disconnectMutation.mutate(integration.provider);
    } else {
      // Check if requires API key
      if (!integration.requiresOAuth && ["twilio", "openai", "googlemaps"].includes(integration.provider)) {
        setApiKeyDialog({ provider: integration.provider, name: integration.name });
        setApiKey("");
      } else if (integration.requiresOAuth && !["gmail", "microsoft365"].includes(integration.provider)) {
        toast({
          title: "Coming soon",
          description: `${integration.name} OAuth integration will be available soon. Contact support for early access.`,
        });
      } else {
        connectMutation.mutate({ provider: integration.provider });
      }
    }
  };

  const handleApiKeySubmit = () => {
    if (!apiKeyDialog || !apiKey.trim()) return;
    connectMutation.mutate({ provider: apiKeyDialog.provider, apiKey: apiKey.trim() });
    setApiKeyDialog(null);
    setApiKey("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-2">Integrations</h3>
        <p className="text-muted-foreground">
          Connect the services you need. Each integration is optional and can be toggled on/off.
        </p>
      </div>

      {integrations.map((section) => (
        <div key={section.category}>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
            {section.category}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items.map((integration) => (
              <Card key={integration.name} className="shadow-soft">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                        <integration.icon className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {integration.description}
                        </CardDescription>
                      </div>
                    </div>
                    {isConnected(integration.provider) && (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        Connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant={isConnected(integration.provider) ? "outline" : "default"}
                    className="w-full"
                    onClick={() => handleConnect(integration)}
                  >
                    {isConnected(integration.provider) ? "Disconnect" : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={!!apiKeyDialog} onOpenChange={() => setApiKeyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {apiKeyDialog?.name}</DialogTitle>
            <DialogDescription>
              Enter your API key to connect {apiKeyDialog?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
            />
            <Button onClick={handleApiKeySubmit} className="w-full">
              Connect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Integrations;