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
import { DollarSign, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';

interface CostRow {
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  percentage: number;
}

interface CostStats {
  total_cost_mtd: number;
  budget_usage_pct: number;
}

export function CostsPage() {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [stats, setStats] = useState<CostStats>({ total_cost_mtd: 0, budget_usage_pct: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<CostRow[]>('/api/analytics/costs'),
      api<CostStats>('/api/analytics/costs/stats'),
    ])
      .then(([costData, statsData]) => {
        setRows(costData);
        setStats(statsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cost data'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cost Analytics</h1>
        <p className="text-muted-foreground">Cost tracking and budget monitoring</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cost (MTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `$${stats.total_cost_mtd.toFixed(2)}`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `${stats.budget_usage_pct.toFixed(1)}%`}
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(stats.budget_usage_pct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Trend</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
          <TrendingUp className="mr-2 h-5 w-5" />
          Chart visualization coming soon
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost by Model</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading cost data...</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No cost data available yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Input Tokens</TableHead>
                  <TableHead className="text-right">Output Tokens</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.model}>
                    <TableCell className="font-mono text-xs">{row.model}</TableCell>
                    <TableCell className="text-right">{row.requests.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.input_tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.output_tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${row.total_cost.toFixed(4)}</TableCell>
                    <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
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
