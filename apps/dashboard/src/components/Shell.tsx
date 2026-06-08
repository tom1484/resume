import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Search,
  Bot,
  Heart,
  ShieldAlert,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/review', label: 'Review', icon: Inbox },
  { to: '/resume', label: 'Résumé', icon: FileText },
  { to: '/scrawling', label: 'Scrawling', icon: Search },
  { to: '/llm', label: 'LLM', icon: Bot },
  { to: '/preferences', label: 'Preferences', icon: Heart },
  { to: '/constraints', label: 'Constraints', icon: ShieldAlert },
  { to: '/answers', label: 'Answers', icon: MessageSquare },
];

export function Shell() {
  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar — chrome, hidden when printing. */}
      <aside className="print-hide sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-5 font-semibold tracking-tight">
          Job Pipeline
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          jobs.churong.cc · behind NPM auth
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar nav (chrome). */}
        <header className="print-hide flex items-center gap-1 overflow-x-auto border-b bg-background px-3 py-2 md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                )
              }
            >
              <Icon className="size-3" />
              {label}
            </NavLink>
          ))}
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
