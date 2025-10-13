import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

const Campaigns = () => {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Campaigns</h2>
          <p className="text-muted-foreground">Create and manage automated outreach campaigns</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No campaigns yet. Create your first campaign to automate lead outreach!</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Campaigns;
