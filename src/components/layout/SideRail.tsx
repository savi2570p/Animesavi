import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Search, Film, Tv, TrendingUp, CalendarDays, Users, Heart, History,
  Upload, Shield, Settings, ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ViewPartyDialog } from '@/components/WatchParty';

interface RailLink { to: string; label: string; icon: LucideIcon }

const isActive = (to: string, pathname: string, search: string) => {
  const [path, query] = to.split('?');
  if (path !== pathname) return false;
  if (!query) return path === '/' || search === '';
  return search.includes(query);
};

/** PC-only floating icon rail on the left; the user can hide or show it. */
export function SideRail({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const { user, isAdmin, isUploader } = useAuth();
  const { pathname, search } = useLocation();
  const [partiesOpen, setPartiesOpen] = useState(false);

  const main: RailLink[] = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/browse', label: 'Search & Browse', icon: Search },
    { to: '/browse?type=movie', label: 'Movies', icon: Film },
    { to: '/browse?type=series', label: 'TV Series', icon: Tv },
    { to: '/browse?sort=popular', label: 'Most Popular', icon: TrendingUp },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  ];
  const library: RailLink[] = user ? [
    { to: '/favorites', label: 'Favorites', icon: Heart },
    { to: '/history', label: 'History', icon: History },
  ] : [];
  const tools: RailLink[] = [
    ...(isUploader || isAdmin ? [{ to: '/upload', label: 'Upload', icon: Upload }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin Panel', icon: Shield }] : []),
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const renderLink = (item: RailLink) => (
    <Link key={item.to} to={item.to} className="side-rail-link" aria-label={item.label}
      aria-current={isActive(item.to, pathname, search) ? 'page' : undefined}>
      <item.icon aria-hidden />
      <span className="side-rail-tip">{item.label}</span>
    </Link>
  );

  return (
    <nav className="side-rail" aria-label="Quick navigation">
      {hidden ? (
        <button type="button" className="side-rail-tab" onClick={onToggle} aria-label="Show side menu" title="Show side menu">
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="side-rail-panel">
          {main.map(renderLink)}
          <button type="button" className="side-rail-link" aria-label="Watch parties" onClick={() => setPartiesOpen(true)}>
            <Users aria-hidden />
            <span className="side-rail-tip">Watch Parties</span>
          </button>
          {library.length > 0 && <span className="side-rail-sep" aria-hidden />}
          {library.map(renderLink)}
          <span className="side-rail-sep" aria-hidden />
          {tools.map(renderLink)}
          <button type="button" className="side-rail-link" onClick={onToggle} aria-label="Hide side menu">
            <ChevronLeft aria-hidden />
            <span className="side-rail-tip">Hide menu</span>
          </button>
        </div>
      )}
      <ViewPartyDialog trigger={null} open={partiesOpen} onOpenChange={setPartiesOpen} />
    </nav>
  );
}
