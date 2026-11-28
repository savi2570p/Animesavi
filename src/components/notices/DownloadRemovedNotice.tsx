import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { disableDownloadNotice } from '@/lib/downloadNotice';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { CheckCircle2, DownloadCloud, HardDrive, Info, MinusCircle, Send } from 'lucide-react';

const REMOVED = [
  'Download (Save Offline) button on the video page',
  'Downloads page in the menu',
  'Download option on the SUB (XCZ) server',
];

const STILL_WORKS = [
  'Stream every episode online in up to 4K',
  'Favorites, Watchlist and Continue Watching',
  'DUB and SUB servers, subtitles and Watch Party',
];

/** Notice about removed downloads, shown at most once every 48 hours. */
export function DownloadRemovedNotice() {
  const { activePopup, dismissPopup } = usePopupQueue();
  const open = activePopup === 'downloadNotice';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismissPopup(); }}>
      <DialogContent className="download-notice w-[calc(100vw-2rem)] max-w-[26rem] gap-0 p-0" style={{ zIndex: 9997 }}>
        <div className="download-notice-body">
          <div className="download-notice-head">
            <span className="download-notice-icon" aria-hidden="true"><DownloadCloud /></span>
            <div className="min-w-0">
              <p className="download-notice-kicker"><Info aria-hidden="true" /> Important notice</p>
              <DialogTitle className="download-notice-title">Downloads have been removed</DialogTitle>
            </div>
          </div>

          <DialogDescription className="download-notice-text">
            Due to some restrictions, we've had to remove downloading and offline saving from AnimeSavi+.
            Streaming is not affected — you can keep watching everything online as usual.
          </DialogDescription>

          <section className="download-notice-section" aria-label="What was removed">
            <h3 className="download-notice-section-title">What's removed</h3>
            <ul className="download-notice-list">
              {REMOVED.map((item) => (
                <li key={item}><MinusCircle className="download-notice-bullet is-removed" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </section>

          <section className="download-notice-section" aria-label="What still works">
            <h3 className="download-notice-section-title">Still available</h3>
            <ul className="download-notice-list">
              {STILL_WORKS.map((item) => (
                <li key={item}><CheckCircle2 className="download-notice-bullet is-kept" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </section>

          <p className="download-notice-tip">
            <HardDrive aria-hidden="true" />
            <span>Episodes you saved earlier stay on your device until you clear your browser data.</span>
          </p>
        </div>

        <div className="download-notice-actions">
          <Button className="w-full" onClick={dismissPopup}>Got it</Button>
          <Button variant="outline" className="w-full" onClick={() => { disableDownloadNotice(); dismissPopup(); }}>Don't show again</Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/notices" onClick={dismissPopup}>View all notices</Link>
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <a href="https://t.me/AnimeSaviInhindiDUB" target="_blank" rel="noopener noreferrer">
              <Send className="h-4 w-4" aria-hidden="true" /> Get updates on Telegram
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
