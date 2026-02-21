import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Tv, Play, Film, Clock, LayoutGrid, Cherry } from 'lucide-react';

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
    { to: '/crunchy', label: 'Crunchy', icon: Cherry },
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
        <nav className="flex gap-0.5 overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = isActiveTab(tab.to);
            
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
