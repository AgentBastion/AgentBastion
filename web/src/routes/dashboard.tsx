import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, Key, Server, Cpu, Database, MemoryStick, Search } from 'lucide-react';
import { api } from '@/lib/api';

interface HealthStatus {
  postgres: boolean;
  redis: boolean;
  quickwit: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  user_email: string;
  action: string;
  resource: string;
}

const statCards = [
  { title: 'Total Requests', icon: BarChart3, description: 'Today' },
  { title: 'Active Providers', icon: Cpu, description: 'Configured' },
  { title: 'API Keys', icon: Key, description: 'Active keys' },
  { title: 'MCP Servers', icon: Server, description: 'Connected' },
];

const serviceList: { name: string; key: keyof HealthStatus; icon: typeof Database }[] = [
  { name: 'PostgreSQL', key: 'postgres', icon: Database },
  { name: 'Redis', key: 'redis', icon: MemoryStick },
  { name: 'Quickwit', key: 'quickwit', icon: Search },
];

export function DashboardPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    api<HealthStatus>('/api/health')
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoadingHealth(false));

    api<{ items: AuditEntry[] }>('/api/audit/logs?limit=5')
      .then((res) => setRecentActivity(res.items ?? []))
      .catch(() => setRecentActivity([]))
      .finally(() => setLoadingActivity(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your AI API and MCP gateway
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">&mdash;</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{entry.user_email}</TableCell>
                      <TableCell className="text-xs">{entry.action}</TableCell>
                      <TableCell className="text-xs">{entry.resource}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHealth ? (
              <p className="text-sm text-muted-foreground">Checking services...</p>
            ) : (
              <div className="space-y-3">
                {serviceList.map((svc) => {
                  const ok = health?.[svc.key] ?? false;
                  return (
                    <div key={svc.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svc.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{svc.name}</span>
                      </div>
                      <Badge variant={ok ? 'default' : 'destructive'}>
                        {ok ? 'Healthy' : 'Unreachable'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
