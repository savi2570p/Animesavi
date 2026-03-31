import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Tv, Play, Film, Clock, LayoutGrid, Cherry, ArrowLeft } from 'lucide-react';
import museinLogo from '@/assets/musein-logo.jpg';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import { Button } from '@/components/ui/button';

interface NavTab {
  to: string;
  label: string;
  icon?: typeof Tv;
  customIcon?: string;
  requiresAuth?: boolean;
  requiresUploader?: boolean;
  isMuseIN?: boolean;
}

export function ContentNavTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isUploader, isAdmin, isRolesLoaded } = useAuth();

  const canAccessPending = isUploader || isAdmin;

  const isOnCrunchy = location.pathname === '/crunchy';
  const isOnMuseIN = location.pathname === '/musein';

  // On MuseIN or Crunchy page, only show that single tab
  const tabs: NavTab[] = isOnMuseIN
    ? [{ to: '/musein', label: 'MuseIN', customIcon: museinLogo, isMuseIN: true }]
    : isOnCrunchy
    ? [{ to: '/crunchy', label: 'Crunchy', customIcon: crunchyrollLogo }]
    : [
        { to: '/browse', label: 'Browse', icon: LayoutGrid },
        { to: '/latest-series', label: 'Latest Series', icon: Tv },
        { to: '/latest-episodes', label: 'Latest Episodes', icon: Play },
        { to: '/latest-movies', label: 'Latest Movies', icon: Film },
        { to: '/upcoming', label: 'Upcoming', icon: Cherry },
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
        <nav className="flex items-center gap-0.5 overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
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
                {tab.customIcon ? (
                  <img src={tab.customIcon} alt={tab.label} className="h-4 w-4 sm:h-5 sm:w-5 rounded-full object-cover" />
                ) : Icon ? (
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : null}
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
