import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Users2, Sparkles, MapPin } from "lucide-react";

const integrations = [
  {
    category: "Email Integration",
    items: [
      { name: "Gmail", description: "Sync emails and send messages", icon: Mail, connected: false },
      { name: "Microsoft 365", description: "Outlook integration", icon: Mail, connected: false },
    ],
  },
  {
    category: "SMS Integration",
    items: [
      { name: "Twilio", description: "Send and receive SMS", icon: MessageSquare, connected: false },
    ],
  },
  {
    category: "CRM Integration",
    items: [
      { name: "HubSpot", description: "Sync contacts and deals", icon: Users2, connected: false },
      { name: "Pipedrive", description: "CRM integration", icon: Users2, connected: false },
      { name: "Follow Up Boss", description: "Real estate CRM", icon: Users2, connected: false },
    ],
  },
  {
    category: "AI Integration",
    items: [
      { name: "OpenAI", description: "AI message generation", icon: Sparkles, connected: false },
    ],
  },
  {
    category: "Location Integration",
    items: [
      { name: "Google Maps", description: "Location data", icon: MapPin, connected: false },
    ],
  },
];

const Integrations = () => {
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
                    {integration.connected && (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        Connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant={integration.connected ? "outline" : "default"}
                    className="w-full"
                  >
                    {integration.connected ? "Disconnect" : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Integrations;
