import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Plug,
  BrainCircuit,
  Key,
  ScrollText,
  Server,
  Wrench,
  BarChart3,
  DollarSign,
  ClipboardList,
  Users,
  Shield,
  Settings,
} from 'lucide-react';
import { useNavigate, useLocation } from '@tanstack/react-router';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, href: '/' as const },
    ],
  },
  {
    label: 'AI Gateway',
    items: [
      { title: 'Providers', icon: Plug, href: '/gateway/providers' as const },
      { title: 'Models', icon: BrainCircuit, href: '/gateway/models' as const },
      { title: 'API Keys', icon: Key, href: '/gateway/api-keys' as const },
      { title: 'Request Logs', icon: ScrollText, href: '/gateway/logs' as const },
    ],
  },
  {
    label: 'MCP Gateway',
    items: [
      { title: 'MCP Servers', icon: Server, href: '/mcp/servers' as const },
      { title: 'Tools', icon: Wrench, href: '/mcp/tools' as const },
      { title: 'MCP Logs', icon: ScrollText, href: '/mcp/logs' as const },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { title: 'Usage', icon: BarChart3, href: '/analytics/usage' as const },
      { title: 'Costs', icon: DollarSign, href: '/analytics/costs' as const },
      { title: 'Audit Logs', icon: ClipboardList, href: '/analytics/audit' as const },
    ],
  },
  {
    label: 'Admin',
    items: [
      { title: 'Users', icon: Users, href: '/admin/users' as const },
      { title: 'Roles', icon: Shield, href: '/admin/roles' as const },
      { title: 'Settings', icon: Settings, href: '/admin/settings' as const },
    ],
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <button
          onClick={() => navigate({ to: '/' })}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">AgentBastion</span>
        </button>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? currentPath === '/'
                      : currentPath.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => navigate({ to: item.href })}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-4 text-xs text-muted-foreground">
        AgentBastion v0.1.0
      </SidebarFooter>
    </Sidebar>
  );
}
