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

export function McpLogsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCP Call Logs</h1>
          <p className="text-muted-foreground">MCP tool invocation history</p>
        </div>
        <Badge variant="secondary">Coming in Phase 5</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All MCP Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody />
          </Table>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">MCP call logging will be available in Phase 5.</p>
            <p className="text-xs text-muted-foreground mt-1">Logs will include tool invocations, durations, and error tracking.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
