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
import { Plus, Copy, Check, Ban } from 'lucide-react';
import { api, apiPost, apiDelete } from '@/lib/api';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  team_name: string | null;
  rate_limit_rpm: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface CreateKeyResponse {
  id: string;
  api_key: string;
}

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState('');
  const [allowedModels, setAllowedModels] = useState('');
  const [rateLimitRpm, setRateLimitRpm] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');

  const fetchKeys = async () => {
    try {
      const data = await api<ApiKey[]>('/api/keys');
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const resetForm = () => {
    setName('');
    setAllowedModels('');
    setRateLimitRpm('');
    setExpiresInDays('');
    setFormError('');
    setCreatedKey(null);
    setCopied(false);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const models = allowedModels.split(',').map((m) => m.trim()).filter(Boolean);
      const res = await apiPost<CreateKeyResponse>('/api/keys', {
        name,
        allowed_models: models.length > 0 ? models : undefined,
        rate_limit_rpm: rateLimitRpm ? parseInt(rateLimitRpm, 10) : undefined,
        expires_in_days: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
      });
      setCreatedKey(res.api_key);
      await fetchKeys();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await apiDelete(`/api/keys/${id}`);
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage gateway API keys</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4" />
            Create API Key
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
              <DialogDescription>
                {createdKey
                  ? 'Copy this key now. It will not be shown again.'
                  : 'Generate a new API key for the gateway.'}
              </DialogDescription>
            </DialogHeader>
            {createdKey ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted p-3">
                  <code className="text-sm break-all">{createdKey}</code>
                </div>
                <Button variant="outline" className="w-full" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Button>
                <DialogFooter>
                  <Button onClick={() => handleDialogChange(false)}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                {formError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-service-key" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-models">Allowed Models</Label>
                  <Input id="key-models" value={allowedModels} onChange={(e) => setAllowedModels(e.target.value)} placeholder="gpt-4o, claude-sonnet-4 (comma-separated)" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-rate">Rate Limit (RPM)</Label>
                  <Input id="key-rate" type="number" value={rateLimitRpm} onChange={(e) => setRateLimitRpm(e.target.value)} placeholder="60" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-expires">Expires In (days)</Label>
                  <Input id="key-expires" type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder="90" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading keys...</p>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No API keys created yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Create a key to start making requests through the gateway.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{k.key_prefix}</code>
                    </TableCell>
                    <TableCell className="text-sm">{k.team_name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{k.rate_limit_rpm ? `${k.rate_limit_rpm}/min` : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.is_active ? 'default' : 'destructive'}>
                        {k.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {k.is_active && (
                        <Button variant="ghost" size="icon-sm" onClick={() => handleRevoke(k.id)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
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
