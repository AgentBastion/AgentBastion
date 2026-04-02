import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { SimpleBarChart } from '@/components/ui/simple-chart';

interface CostRow {
  model_id: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: string;
}

interface CostStats {
  total_cost_mtd: number;
  budget_usage_pct: number | null;
}

export function CostsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CostRow[]>([]);
  const [stats, setStats] = useState<CostStats>({ total_cost_mtd: 0, budget_usage_pct: null });
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

  // Chart: cost by model
  const chartData = useMemo(() => {
    return rows
      .sort((a, b) => parseFloat(b.total_cost) - parseFloat(a.total_cost))
      .map((row) => ({
        label: row.model_id.length > 16 ? row.model_id.slice(0, 14) + '..' : row.model_id,
        value: parseFloat(row.total_cost),
      }));
  }, [rows]);

  const totalCost = useMemo(() => rows.reduce((sum, r) => sum + parseFloat(r.total_cost), 0), [rows]);
  const budgetPct = stats.budget_usage_pct ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('analyticsCosts.title')}</h1>
        <p className="text-muted-foreground">{t('analyticsCosts.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('analyticsCosts.totalCostMtd')}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{t('analyticsCosts.budgetUsage')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.budget_usage_pct != null ? `${budgetPct.toFixed(1)}%` : '—'}
            </div>
            {stats.budget_usage_pct != null && (
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('analyticsCosts.costByModel')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">{t('common.loading')}</div>
          ) : chartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">{t('analyticsCosts.noCosts')}</div>
          ) : (
            <SimpleBarChart data={chartData} formatValue={(v) => `$${v.toFixed(4)}`} />
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('analyticsCosts.costTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('analyticsCosts.loadingCosts')}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">{t('analyticsCosts.noCosts')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('analyticsCosts.model')}</TableHead>
                  <TableHead className="text-right">{t('analyticsCosts.requests')}</TableHead>
                  <TableHead className="text-right">{t('analyticsCosts.inputTokens')}</TableHead>
                  <TableHead className="text-right">{t('analyticsCosts.outputTokens')}</TableHead>
                  <TableHead className="text-right">{t('analyticsCosts.totalCost')}</TableHead>
                  <TableHead className="text-right">{t('analyticsCosts.percentOfTotal')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const cost = parseFloat(row.total_cost);
                  const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                  return (
                    <TableRow key={row.model_id}>
                      <TableCell className="font-mono text-xs">{row.model_id}</TableCell>
                      <TableCell className="text-right">{row.request_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.input_tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.output_tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${cost.toFixed(4)}</TableCell>
                      <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
