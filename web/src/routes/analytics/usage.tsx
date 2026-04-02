import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, Hash } from 'lucide-react';
import { api } from '@/lib/api';

interface UsageRow {
  date: string;
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
}

interface UsageStats {
  total_tokens_today: number;
  total_requests_today: number;
}

export function UsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [stats, setStats] = useState<UsageStats>({ total_tokens_today: 0, total_requests_today: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<UsageRow[]>('/api/analytics/usage'),
      api<UsageStats>('/api/analytics/usage/stats'),
    ])
      .then(([usageData, statsData]) => {
        setRows(usageData);
        setStats(statsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load usage data'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage Analytics</h1>
        <p className="text-muted-foreground">Token and request usage metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens Today</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.total_tokens_today.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Requests Today</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.total_requests_today.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
          <BarChart3 className="mr-2 h-5 w-5" />
          Chart visualization coming soon
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading usage data...</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No usage data available yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Input Tokens</TableHead>
                  <TableHead className="text-right">Output Tokens</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={`${row.date}-${row.model}-${i}`}>
                    <TableCell className="text-xs">{row.date}</TableCell>
                    <TableCell className="font-mono text-xs">{row.model}</TableCell>
                    <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.input_tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.output_tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${row.total_cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
