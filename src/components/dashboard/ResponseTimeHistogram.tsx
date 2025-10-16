import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";

interface ResponseTimeHistogramProps {
  data: Array<{
    bucket: string;
    count: number;
  }>;
  p50?: number;
  p90?: number;
  loading?: boolean;
}

const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
};

export const ResponseTimeHistogram = ({ data, p50, p90, loading }: ResponseTimeHistogramProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Response Time Distribution</CardTitle>
          <div className="flex gap-2">
            {p50 !== undefined && (
              <Badge variant="outline">
                P50: {formatMinutes(p50)}
              </Badge>
            )}
            {p90 !== undefined && (
              <Badge variant="outline">
                P90: {formatMinutes(p90)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[250px] animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="bucket"
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
