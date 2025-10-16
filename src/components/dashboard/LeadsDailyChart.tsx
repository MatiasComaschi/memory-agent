import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeadsDailyChartProps {
  data: Array<{
    date: string;
    [key: string]: string | number;
  }>;
  period: "7d" | "30d" | "90d";
  onPeriodChange: (period: "7d" | "30d" | "90d") => void;
  loading?: boolean;
}

const sourceColors: Record<string, string> = {
  Zillow: "#8b5cf6",
  Realtor: "#3b82f6",
  Facebook: "#10b981",
  Website: "#f59e0b",
  Referral: "#ec4899",
  Import: "#6366f1",
  Unknown: "#94a3b8",
};

export const LeadsDailyChart = ({ data, period, onPeriodChange, loading }: LeadsDailyChartProps) => {
  const sources = Array.from(
    new Set(data.flatMap(d => Object.keys(d).filter(k => k !== 'date')))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leads Over Time</CardTitle>
        <Tabs value={period} onValueChange={(v) => onPeriodChange(v as any)}>
          <TabsList>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
            <TabsTrigger value="90d">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), "MMM d")}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip
                labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              {sources.map((source) => (
                <Area
                  key={source}
                  type="monotone"
                  dataKey={source}
                  stackId="1"
                  stroke={sourceColors[source] || "#94a3b8"}
                  fill={sourceColors[source] || "#94a3b8"}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
