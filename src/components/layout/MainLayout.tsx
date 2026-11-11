import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { SideRail } from './SideRail';
import { ContinueWatchingNotification } from '@/components/home/ContinueWatchingNotification';
import { AnimatedPage } from './AnimatedPage';

export function MainLayout() {
  const location = useLocation();
  // The PC side rail always starts hidden; the arrow tab shows it for this visit.
  const [railHidden, setRailHidden] = useState(true);
  const toggleRail = () => setRailHidden(prev => !prev);

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
