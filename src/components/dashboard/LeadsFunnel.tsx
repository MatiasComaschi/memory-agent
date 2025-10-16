import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FunnelStage {
  stage: string;
  count: number;
  color: string;
}

interface LeadsFunnelProps {
  data: FunnelStage[];
  onStageClick?: (stage: string) => void;
  loading?: boolean;
}

export const LeadsFunnel = ({ data, onStageClick, loading }: LeadsFunnelProps) => {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const calculateConversionRate = (index: number) => {
    if (index === 0 || data[index - 1].count === 0) return null;
    return ((data[index].count / data[index - 1].count) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Stage Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-muted rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((stage, index) => {
              const widthPercent = (stage.count / maxCount) * 100;
              const conversionRate = calculateConversionRate(index);

              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{stage.stage}</span>
                    <div className="flex items-center gap-2">
                      {conversionRate && (
                        <span className="text-xs text-muted-foreground">
                          {conversionRate}% conversion
                        </span>
                      )}
                      <span className="font-semibold">{stage.count}</span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "h-10 rounded-lg transition-all cursor-pointer hover:opacity-80",
                      stage.color
                    )}
                    style={{ width: `${widthPercent}%`, minWidth: '20%' }}
                    onClick={() => onStageClick?.(stage.stage)}
                  >
                    <div className="h-full flex items-center justify-center text-white text-sm font-medium">
                      {stage.count > 0 && stage.stage}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
