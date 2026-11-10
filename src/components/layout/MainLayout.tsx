import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { SideRail } from './SideRail';
import { ContinueWatchingNotification } from '@/components/home/ContinueWatchingNotification';
import { AnimatedPage } from './AnimatedPage';

const RAIL_KEY = 'side_rail_hidden';

export function MainLayout() {
  const location = useLocation();
  const [railHidden, setRailHidden] = useState(() => {
    try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
  });
  const toggleRail = () => setRailHidden(prev => {
    const next = !prev;
    try { localStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
    return next;
  });

  // Animate home page "/" only the first time it is visited; afterwards render instantly.
  const isHome = location.pathname === '/';
  const homeAlreadyAnimated =
    typeof window !== 'undefined' && localStorage.getItem('home_animated_once') === '1';
  const shouldAnimate = !isHome || !homeAlreadyAnimated;

  if (isHome && !homeAlreadyAnimated && typeof window !== 'undefined') {
    localStorage.setItem('home_animated_once', '1');
  }

  return (
    <div className="min-h-screen flex flex-col app-shell-ra" data-rail={railHidden ? 'hidden' : 'shown'}>
      <Header />
      <SideRail hidden={railHidden} onToggle={toggleRail} />
      <main className="flex-1">
        {shouldAnimate ? (
          <AnimatedPage key={location.pathname}>
            <Outlet />
          </AnimatedPage>
        ) : (
          <Outlet />
        )}
      </main>
      <Footer />
      <ContinueWatchingNotification />
    </div>
  );
}
