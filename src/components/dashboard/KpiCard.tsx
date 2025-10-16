import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number | string;
  delta?: number;
  trend?: number[];
  onClick?: () => void;
  loading?: boolean;
}

export const KpiCard = ({ title, value, delta, trend, onClick, loading }: KpiCardProps) => {
  const deltaPositive = delta && delta > 0;
  const deltaNegative = delta && delta < 0;
  const deltaZero = delta === 0;

  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-lg",
        onClick && "cursor-pointer hover:scale-105"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-10 animate-pulse bg-muted rounded" />
        ) : (
          <>
            <div className="text-3xl font-bold">{value}</div>
            {delta !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                {deltaPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
                {deltaNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
                {deltaZero && <Minus className="h-4 w-4 text-muted-foreground" />}
                <span
                  className={cn(
                    "text-sm font-medium",
                    deltaPositive && "text-green-500",
                    deltaNegative && "text-red-500",
                    deltaZero && "text-muted-foreground"
                  )}
                >
                  {delta > 0 ? "+" : ""}{delta}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">vs prev period</span>
              </div>
            )}
            {trend && trend.length > 0 && (
              <div className="mt-2 h-8 flex items-end gap-0.5">
                {trend.slice(-7).map((value, i) => {
                  const maxValue = Math.max(...trend);
                  const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-primary/20 rounded-sm transition-all"
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
