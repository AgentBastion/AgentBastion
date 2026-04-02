import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

interface GatewayLog {
  id: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  latency_ms: number | null;
  status_code: number | null;
  created_at: string;
}

interface GatewayLogsResponse {
  items: GatewayLog[];
  total: number;
}

const PAGE_SIZE = 50;

export function GatewayLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<GatewayLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('model', search);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      const data = await api<GatewayLogsResponse>(`/api/gateway/logs?${params}`);
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset to page 0 when search changes
  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusBadge = (code: number | null) => {
    if (!code) return <Badge variant="outline">—</Badge>;
    if (code >= 200 && code < 300) return <Badge variant="default">{code}</Badge>;
    if (code >= 400) return <Badge variant="destructive">{code}</Badge>;
    return <Badge variant="secondary">{code}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('logs.title')}</h1>
          <p className="text-muted-foreground">{t('logs.subtitle')}</p>
        </div>
        <Input
          placeholder={t('logs.filterModel')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('logs.allRequests')}</CardTitle>
          {total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('common.total')}: {total.toLocaleString()}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t('logs.noLogs')}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('logs.timestamp')}</TableHead>
                    <TableHead>{t('logs.model')}</TableHead>
                    <TableHead className="text-right">{t('logs.tokensIn')}</TableHead>
                    <TableHead className="text-right">{t('logs.tokensOut')}</TableHead>
                    <TableHead className="text-right">{t('logs.cost')}</TableHead>
                    <TableHead className="text-right">{t('logs.latency')}</TableHead>
                    <TableHead>{t('logs.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.model_id}</TableCell>
                      <TableCell className="text-right tabular-nums">{log.input_tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{log.output_tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">${parseFloat(log.cost_usd).toFixed(4)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {log.latency_ms != null ? `${log.latency_ms}ms` : '—'}
                      </TableCell>
                      <TableCell>{statusBadge(log.status_code)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
