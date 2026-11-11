import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Search, Tv, CalendarDays, Users,
  Upload, Shield, ChevronLeft, ChevronRight, type LucideIcon,
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
  const { isAdmin, isUploader } = useAuth();
  const { pathname, search } = useLocation();
  const [partiesOpen, setPartiesOpen] = useState(false);

  const main: RailLink[] = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/browse', label: 'Search & Browse', icon: Search },
    { to: '/browse?type=series', label: 'TV Series', icon: Tv },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  ];
  const tools: RailLink[] = [
    ...(isUploader || isAdmin ? [{ to: '/upload', label: 'Upload', icon: Upload }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin Panel', icon: Shield }] : []),
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
          {tools.length > 0 && <span className="side-rail-sep" aria-hidden />}
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
