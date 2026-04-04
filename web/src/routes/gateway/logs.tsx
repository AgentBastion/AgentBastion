import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { api } from '@/lib/api';

interface GatewayLog {
  id: string;
  user_id: string | null;
  api_key_id: string | null;
  model_id: string;
  provider: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  latency_ms: number | null;
  status_code: number | null;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
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
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState('');
  const [userId, setUserId] = useState('');
  const [statusCode, setStatusCode] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (model) params.set('model', model);
      if (provider) params.set('provider', provider);
      if (userId) params.set('user_id', userId);
      if (statusCode) params.set('status_code', statusCode);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (sortBy !== 'created_at') params.set('sort', sortBy);
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
  }, [query, model, provider, userId, statusCode, from, to, sortBy, page]);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { setPage(0); }, [query, model, provider, userId, statusCode, from, to, sortBy]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = () => { setPage(0); loadLogs(); };

  const statusBadge = (code: number | null) => {
    if (!code) return <Badge variant="outline">—</Badge>;
    if (code >= 200 && code < 300) return <Badge variant="default">{code}</Badge>;
    if (code >= 400) return <Badge variant="destructive">{code}</Badge>;
    return <Badge variant="secondary">{code}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('logs.title')}</h1>
        <p className="text-muted-foreground">{t('logs.subtitle')}</p>
      </div>

      {/* Search filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">{t('common.search')}</Label>
              <Input placeholder={t('logs.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            </div>
            <div>
              <Label className="text-xs">{t('logs.model')}</Label>
              <Input placeholder="gpt-4o" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('logs.provider')}</Label>
              <Input placeholder="openai" value={provider} onChange={(e) => setProvider(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('logs.statusCode')}</Label>
              <Input placeholder="200" value={statusCode} onChange={(e) => setStatusCode(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('logs.userId')}</Label>
              <Input placeholder="UUID" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('logs.dateFrom')}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('logs.dateTo')}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('logs.sortBy')}</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? 'created_at')}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">{t('logs.timestamp')}</SelectItem>
                  <SelectItem value="cost_usd">{t('logs.cost')}</SelectItem>
                  <SelectItem value="latency_ms">{t('logs.latency')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" onClick={handleSearch}>
              <Search className="mr-1.5 h-4 w-4" />
              {t('common.search')}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    <TableHead className="w-8" />
                    <TableHead>{t('logs.timestamp')}</TableHead>
                    <TableHead>{t('logs.model')}</TableHead>
                    <TableHead>{t('logs.provider')}</TableHead>
                    <TableHead className="text-right">{t('logs.tokensIn')}</TableHead>
                    <TableHead className="text-right">{t('logs.tokensOut')}</TableHead>
                    <TableHead className="text-right">{t('logs.cost')}</TableHead>
                    <TableHead className="text-right">{t('logs.latency')}</TableHead>
                    <TableHead>{t('logs.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <>
                      <TableRow key={log.id}>
                        <TableCell>
                          <Button variant="ghost" size="icon-xs"
                            onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                            {expandedRow === log.id
                              ? <ChevronDown className="h-3 w-3" />
                              : <ChevronRightIcon className="h-3 w-3" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.model_id}</TableCell>
                        <TableCell className="text-sm">{log.provider ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{log.input_tokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{log.output_tokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">${parseFloat(log.cost_usd).toFixed(4)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {log.latency_ms != null ? `${log.latency_ms}ms` : '—'}
                        </TableCell>
                        <TableCell>{statusBadge(log.status_code)}</TableCell>
                      </TableRow>
                      {expandedRow === log.id && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={9}>
                            <div className="grid grid-cols-3 gap-2 text-xs p-2">
                              <div><span className="font-medium">User:</span> {log.user_id ?? '—'}</div>
                              <div><span className="font-medium">API Key:</span> {log.api_key_id ?? '—'}</div>
                              <div><span className="font-medium">IP:</span> {log.ip_address ?? '—'}</div>
                            </div>
                            {log.detail && (
                              <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
                                {JSON.stringify(log.detail, null, 2)}
                              </pre>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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
