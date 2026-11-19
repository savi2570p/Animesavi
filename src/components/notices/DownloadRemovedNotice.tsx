import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { DownloadCloud, Info } from 'lucide-react';

/** Small notice shown once per session when the site opens. */
export function DownloadRemovedNotice() {
  const { activePopup, dismissPopup } = usePopupQueue();
  const open = activePopup === 'downloadNotice';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismissPopup(); }}>
      <DialogContent className="download-notice w-[calc(100vw-2rem)] max-w-[22rem] gap-0 p-0" style={{ zIndex: 9997 }}>
        <div className="download-notice-body">
          <span className="download-notice-icon" aria-hidden="true"><DownloadCloud /></span>
          <p className="download-notice-kicker"><Info aria-hidden="true" /> Notice</p>
          <DialogTitle className="download-notice-title">Downloads removed</DialogTitle>
          <DialogDescription className="download-notice-text">
            We've removed the Download (Save Offline) button and the Downloads page due to some restrictions.
            You can still stream every episode online as usual.
          </DialogDescription>
        </div>
        <div className="download-notice-actions">
          <Button className="w-full" onClick={dismissPopup}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
