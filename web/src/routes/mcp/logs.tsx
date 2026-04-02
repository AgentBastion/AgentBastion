import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface McpLog {
  id: string;
  tool_name: string;
  server_name: string;
  user_email: string | null;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface McpLogsResponse {
  items: McpLog[];
  total: number;
}

const PAGE_SIZE = 50;

export function McpLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<McpLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      const data = await api<McpLogsResponse>(`/api/mcp/logs?${params}`);
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('mcpLogs.title')}</h1>
        <p className="text-muted-foreground">{t('mcpLogs.subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('mcpLogs.allCalls')}</CardTitle>
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
              <p className="text-sm text-muted-foreground">{t('mcpLogs.noLogs')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('mcpLogs.noLogsHint')}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('mcpLogs.timestamp')}</TableHead>
                    <TableHead>{t('mcpLogs.tool')}</TableHead>
                    <TableHead>{t('mcpLogs.server')}</TableHead>
                    <TableHead>{t('mcpLogs.user')}</TableHead>
                    <TableHead className="text-right">{t('mcpLogs.duration')}</TableHead>
                    <TableHead>{t('mcpLogs.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.tool_name}</TableCell>
                      <TableCell>{log.server_name}</TableCell>
                      <TableCell className="text-sm">{log.user_email ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'} title={log.error_message ?? undefined}>
                          {log.status}
                        </Badge>
                      </TableCell>
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
