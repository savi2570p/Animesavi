import { Button } from '@/components/ui/button';
import { TokenPerks } from '@/components/TokenPerks';
import { Crown, ExternalLink, X, Lock } from 'lucide-react';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { useCastDetection } from '@/hooks/useCastDetection';

export function TokenExpiredGlobalPopup() {
  const { activePopup, dismissPopup } = usePopupQueue();
  const isCasting = useCastDetection();

  // Bypass popup entirely while casting / mirroring to a TV or on embed routes
  if (isCasting) return null;
  if (typeof window !== 'undefined') {
    const p = window.location.pathname;
    if (p.startsWith('/embed/') || p.startsWith('/embed-') || p.startsWith('/s2')) return null;
  }
  if (activePopup !== 'expired') return null;

  return (
    <div data-scroll-lock="active" className="app-global-overlay utility-overlay-v6 fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="global-token-title" aria-describedby="global-token-description" className="token-panel-v7 utility-glass-v6">
        <Button variant="ghost" size="icon" className="token-close-v7" onClick={dismissPopup} aria-label="Dismiss"><X /></Button>
        <header className="token-header-v7" data-status="expired">
          <div className="token-status-icon-v7"><Lock /></div>
          <span className="token-eyebrow-v7">Premium expired</span>
          <h2 id="global-token-title">Your Premium Access Ended</h2>
          <p id="global-token-description">Reactivate your token to keep ad-free 4K streaming.</p>
        </header>
        <div className="token-body-v7"><TokenPerks labels={['4K Ultra HD', 'Ad-Free', 'Multi-Audio', '4K Downloads']} /></div>
        <footer className="token-actions-v7">
          <Button asChild className="w-full"><a href="https://t.me/getunlocktoken" target="_blank" rel="noopener noreferrer"><Crown />Reactivate Premium<ExternalLink /></a></Button>
          <Button variant="glass" className="w-full" onClick={dismissPopup}>Continue with Limited Access</Button>
        </footer>
      </section>
    </div>
  );
}
