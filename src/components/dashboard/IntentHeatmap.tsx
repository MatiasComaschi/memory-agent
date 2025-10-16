import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HeatmapCell {
  day: number;
  hour: number;
  avgUrgency: number;
  count: number;
}

interface IntentHeatmapProps {
  data: HeatmapCell[];
  loading?: boolean;
}

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hours = Array.from({ length: 24 }, (_, i) => i);

const getHeatColor = (urgency: number) => {
  if (urgency >= 0.8) return "bg-red-500";
  if (urgency >= 0.6) return "bg-orange-500";
  if (urgency >= 0.4) return "bg-yellow-500";
  if (urgency >= 0.2) return "bg-green-500";
  return "bg-blue-500";
};

export const IntentHeatmap = ({ data, loading }: IntentHeatmapProps) => {
  const getCellData = (day: number, hour: number) => {
    return data.find(d => d.day === day && d.hour === hour);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Intent Heatmap</CardTitle>
        <p className="text-sm text-muted-foreground">
          Average urgency score by day and hour
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] animate-pulse bg-muted rounded" />
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-1">
                {/* Header row with hours */}
                <div className="text-xs text-muted-foreground" />
                {hours.map(hour => (
                  <div key={hour} className="text-xs text-center text-muted-foreground">
                    {hour}
                  </div>
                ))}
                
                {/* Data rows */}
                {days.map((day, dayIndex) => (
                  <>
                    <div key={`label-${dayIndex}`} className="text-xs text-muted-foreground py-1">
                      {day}
                    </div>
                    {hours.map(hour => {
                      const cell = getCellData(dayIndex, hour);
                      const urgency = cell?.avgUrgency || 0;
                      const count = cell?.count || 0;
                      
                      return (
                        <div
                          key={`${dayIndex}-${hour}`}
                          className={cn(
                            "aspect-square rounded transition-all hover:scale-110",
                            count > 0 ? getHeatColor(urgency) : "bg-muted",
                            count > 0 && "cursor-pointer"
                          )}
                          title={count > 0 ? `${day} ${hour}:00 - Avg urgency: ${urgency.toFixed(2)} (${count} leads)` : "No data"}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-xs">
                <span className="text-muted-foreground">Urgency:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span>Very High</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
