import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Upload, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onSyncToCRM: (provider: string) => void;
  onEnrichLocations: () => void;
  isProcessing?: boolean;
}

export const BulkActionsBar = ({
  selectedCount,
  onClearSelection,
  onSyncToCRM,
  onEnrichLocations,
  isProcessing = false,
}: BulkActionsBarProps) => {
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

  const crmProviders = [
    { name: "HubSpot", provider: "hubspot" },
    { name: "Pipedrive", provider: "pipedrive" },
    { name: "Follow Up Boss", provider: "followupboss" },
  ];

  const connectedCRMs = crmProviders.filter((crm) =>
    connectedIntegrations?.includes(crm.provider)
  );

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-card border shadow-lg rounded-lg px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-semibold">
            {selectedCount}
          </Badge>
          <span className="text-sm font-medium">selected</span>
        </div>

        <div className="h-6 w-px bg-border" />

        {connectedCRMs.length > 0 && (
          <>
            {connectedCRMs.map((crm) => (
              <Button
                key={crm.provider}
                variant="outline"
                size="sm"
                onClick={() => onSyncToCRM(crm.provider)}
                disabled={isProcessing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Sync to {crm.name}
              </Button>
            ))}
            <div className="h-6 w-px bg-border" />
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onEnrichLocations}
          disabled={isProcessing}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Enrich Locations
        </Button>

        <div className="h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isProcessing}
        >
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
    </div>
  );
};
