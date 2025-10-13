import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Trial",
    price: "$0",
    description: "14 days free",
    features: ["All features"],
    current: true,
  },
  {
    name: "Solo",
    price: "$149",
    description: "1 agent",
    features: ["2K messages"],
    current: false,
  },
  {
    name: "Team",
    price: "$499",
    description: "Up to 5 seats",
    features: ["10K messages"],
    current: false,
  },
  {
    name: "Broker",
    price: "$1,499",
    description: "20 seats",
    features: ["Priority support"],
    current: false,
  },
];

const Billing = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-2">Billing</h3>
        <p className="text-muted-foreground">Manage your subscription and billing</p>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Current Plan</h4>
        <Card className="shadow-soft border-primary">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">Trial</CardTitle>
                <CardDescription>14 days remaining</CardDescription>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Enjoying EchoLead? Upgrade to continue after your trial ends.
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-4">Available Plans</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`shadow-soft ${plan.current ? "border-primary" : ""}`}
            >
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">{plan.price}</div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.current ? "outline" : "default"}
                  className="w-full"
                  disabled={plan.current}
                >
                  {plan.current ? "Current Plan" : "Select Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Billing;
