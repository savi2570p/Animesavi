import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { ContinueWatchingNotification } from '@/components/home/ContinueWatchingNotification';
import { AnimatedPage } from './AnimatedPage';

export function MainLayout() {
  const location = useLocation();

  // Animate home page "/" only the first time it is visited; afterwards render instantly.
  const isHome = location.pathname === '/';
  const homeAlreadyAnimated =
    typeof window !== 'undefined' && localStorage.getItem('home_animated_once') === '1';
  const shouldAnimate = !isHome || !homeAlreadyAnimated;

  if (isHome && !homeAlreadyAnimated && typeof window !== 'undefined') {
    localStorage.setItem('home_animated_once', '1');
  }

  // Hide the global navbar on immersive pages (anime detail, watch, embed players).
  const hideHeader = /^\/(anime|watch|embed|flox\/watch)\//.test(location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && <Header />}
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
