import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plug, CreditCard, Users } from "lucide-react";

const settingsTabs = [
  { name: "Integrations", path: "/settings/integrations", icon: Plug },
  { name: "Billing", path: "/settings/billing", icon: CreditCard },
  { name: "Team", path: "/settings/team", icon: Users },
];

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h2 className="text-3xl font-bold">Settings</h2>
      </div>

      <div className="flex gap-6">
        {/* Tabs sidebar */}
        <div className="w-48 space-y-1">
          {settingsTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "hover:bg-accent/50"
                }`
              }
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </NavLink>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Settings;
