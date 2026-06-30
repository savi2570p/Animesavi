import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Tv, Play, Film, Clock, LayoutGrid, Cherry, ArrowLeft } from 'lucide-react';
import museinLogo from '@/assets/musein-logo.jpg';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import floxLogo from '@/assets/flox-anime-india-logo.jpg';
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
  const isOnFlox = location.pathname === '/flox';

  // On MuseIN, Crunchy, or Flox pages, show NO tabs — only back button
  const hideAllTabs = isOnMuseIN || isOnCrunchy || isOnFlox;

  const tabs: NavTab[] = hideAllTabs
    ? []
    : [
        { to: '/browse', label: 'Browse', icon: LayoutGrid },
        { to: '/latest-series', label: 'Latest Series', icon: Tv },
        { to: '/latest-episodes', label: 'Latest Episodes', icon: Play },
        { to: '/latest-movies', label: 'Latest Movies', icon: Film },
        { to: '/upcoming', label: 'Upcoming', icon: Cherry },
        { to: '/flox', label: 'Flox +', customIcon: floxLogo },
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
        <nav className="flex items-center gap-0.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
            title="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = isActiveTab(tab.to);
            
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap border-b-2 leading-none transition-all duration-200 shrink-0",
                  tab.to === '/flox' && "sm:px-2.5 md:px-3",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {tab.customIcon ? (
                  <img src={tab.customIcon} alt={tab.label} className="h-3 w-3 sm:h-4 sm:w-4 rounded-full object-cover" />
                ) : Icon ? (
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                ) : null}
                <span className="leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
