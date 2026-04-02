import { useEffect, useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Search } from 'lucide-react';
import { api, apiPost, apiDelete } from '@/lib/api';

interface McpServer {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  transport_type: string;
  status: string;
  last_health_check: string | null;
  tools_count: number;
  created_at: string;
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  connected: 'default',
  disconnected: 'destructive',
  pending: 'outline',
};

export function McpServersPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [transportType, setTransportType] = useState('streamable_http');
  const [authType, setAuthType] = useState('none');
  const [authSecret, setAuthSecret] = useState('');

  const fetchServers = async () => {
    try {
      const data = await api<McpServer[]>('/api/mcp/servers');
      setServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServers(); }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setEndpointUrl('');
    setTransportType('streamable_http');
    setAuthType('none');
    setAuthSecret('');
    setFormError('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await apiPost('/api/mcp/servers', {
        name,
        description,
        endpoint_url: endpointUrl,
        transport_type: transportType,
        auth_type: authType,
        auth_secret: authSecret || undefined,
      });
      setDialogOpen(false);
      resetForm();
      await fetchServers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to register server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) return;
    try {
      await apiDelete(`/api/mcp/servers/${id}`);
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server');
    }
  };

  const handleDiscover = async (id: string) => {
    try {
      await apiPost(`/api/mcp/servers/${id}/discover`, {});
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover tools');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground">Manage Model Context Protocol servers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4" />
            Register Server
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Register MCP Server</DialogTitle>
              <DialogDescription>Connect a new MCP server to the gateway.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mcp-name">Name</Label>
                <Input id="mcp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-mcp-server" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-desc">Description</Label>
                <Input id="mcp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Code analysis tools" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-url">Endpoint URL</Label>
                <Input id="mcp-url" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="http://localhost:8081/mcp" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-transport">Transport Type</Label>
                <select
                  id="mcp-transport"
                  value={transportType}
                  onChange={(e) => setTransportType(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="streamable_http">Streamable HTTP</option>
                  <option value="sse">SSE</option>
                  <option value="stdio">Stdio</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-auth">Auth Type</Label>
                <select
                  id="mcp-auth"
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="none">None</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key">API Key</option>
                </select>
              </div>
              {authType !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="mcp-secret">Auth Secret</Label>
                  <Input id="mcp-secret" type="password" value={authSecret} onChange={(e) => setAuthSecret(e.target.value)} placeholder="Secret or token" required />
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Server'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All MCP Servers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading servers...</p>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No MCP servers registered yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Register a server to start using MCP tools.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Endpoint URL</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Health Check</TableHead>
                  <TableHead>Tools</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.endpoint_url}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.transport_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[s.status] ?? 'outline'}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.last_health_check ? new Date(s.last_health_check).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{s.tools_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDiscover(s.id)} title="Discover Tools">
                          <Search className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(s.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
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
