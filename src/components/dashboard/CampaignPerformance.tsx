import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface CampaignData {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  failed: number;
  status: string;
}

interface CampaignPerformanceProps {
  data: CampaignData[];
  onCampaignClick?: (id: string) => void;
  loading?: boolean;
}

export const CampaignPerformance = ({ data, onCampaignClick, loading }: CampaignPerformanceProps) => {
  const calculateDeliveryRate = (delivered: number, sent: number): string => {
    if (sent === 0) return "0";
    return ((delivered / sent) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-muted rounded" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active campaigns
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Delivery Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((campaign) => {
                const deliveryRate = calculateDeliveryRate(campaign.delivered, campaign.sent);
                const isGoodRate = parseFloat(deliveryRate) >= 90;

                return (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onCampaignClick?.(campaign.id)}
                  >
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{campaign.sent}</TableCell>
                    <TableCell className="text-right">{campaign.delivered}</TableCell>
                    <TableCell className="text-right">
                      {campaign.failed > 0 && (
                        <span className="text-destructive">{campaign.failed}</span>
                      )}
                      {campaign.failed === 0 && "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isGoodRate ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={isGoodRate ? "text-green-500" : "text-red-500"}>
                          {deliveryRate}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
