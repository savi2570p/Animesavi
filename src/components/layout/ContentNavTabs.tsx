import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Tv, Play, Film, Clock, LayoutGrid } from 'lucide-react';

interface NavTab {
  to: string;
  label: string;
  icon: typeof Tv;
  requiresAuth?: boolean;
  requiresUploader?: boolean;
}

export function ContentNavTabs() {
  const location = useLocation();
  const { isUploader, isAdmin, isRolesLoaded } = useAuth();

  const canAccessPending = isUploader || isAdmin;

  const tabs: NavTab[] = [
    { to: '/browse', label: 'Browse', icon: LayoutGrid },
    { to: '/latest-series', label: 'Latest Series', icon: Tv },
    { to: '/latest-episodes', label: 'Latest Episodes', icon: Play },
    { to: '/latest-movies', label: 'Latest Movies', icon: Film },
    ...(isRolesLoaded && canAccessPending
      ? [{ to: '/pending-upload', label: 'Pending Upload', icon: Clock, requiresUploader: true }]
      : []),
  ];

  const isActiveTab = (path: string) => {
    if (path === '/browse') {
      return location.pathname === '/browse' || location.pathname.startsWith('/browse?');
    }
    return location.pathname === path;
  };

  return (
    <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-md border-b border-border/50 safe-area-top">
      <div className="container">
        <nav className="flex gap-1 overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = isActiveTab(tab.to);
            
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
