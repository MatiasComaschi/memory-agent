import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail } from "lucide-react";
import { useState } from "react";

const Team = () => {
  const [email, setEmail] = useState("");

  const handleInvite = () => {
    // TODO: Implement invite functionality
    console.log("Inviting:", email);
    setEmail("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-2">Team</h3>
        <p className="text-muted-foreground">Invite and manage team members</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>
            Send an invitation to add a new member to your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="email" className="sr-only">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button onClick={handleInvite}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h4 className="text-lg font-semibold mb-4">Team Members</h4>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">You</p>
                    <p className="text-sm text-muted-foreground">your@email.com</p>
                  </div>
                </div>
                <Badge variant="default">Owner</Badge>
              </div>
              <p className="text-center text-sm text-muted-foreground py-4">
                No other team members yet. Invite colleagues to collaborate!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Team;
