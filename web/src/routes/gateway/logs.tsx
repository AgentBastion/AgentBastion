import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText } from 'lucide-react';

export function GatewayLogsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Request Logs</h1>
          <p className="text-muted-foreground">Gateway request and response logs</p>
        </div>
        <Badge variant="secondary">Coming in Phase 5</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Tokens In</TableHead>
                <TableHead>Tokens Out</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody />
          </Table>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Request logging will be available in Phase 5.</p>
            <p className="text-xs text-muted-foreground mt-1">Logs will include token usage, cost tracking, and latency metrics.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
