import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { ContinueWatchingNotification } from '@/components/home/ContinueWatchingNotification';
import { AnimatedPage } from './AnimatedPage';

export function MainLayout() {
  const location = useLocation();
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <AnimatedPage key={location.pathname}>
          <Outlet />
        </AnimatedPage>
      </main>
      <Footer />
      <ContinueWatchingNotification />
    </div>
  );
}
