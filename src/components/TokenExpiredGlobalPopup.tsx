import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { usePopupQueue } from '@/contexts/PopupQueueContext';

export function TokenExpiredGlobalPopup() {
  const { activePopup, dismissPopup } = usePopupQueue();

  if (activePopup !== 'expired') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at center, hsla(0, 60%, 10%, 0.4) 0%, hsla(0, 0%, 0%, 0.88) 70%)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'linear-gradient(165deg, hsla(0, 20%, 8%, 0.95) 0%, hsla(0, 0%, 5%, 0.98) 100%)',
          border: '1px solid hsla(0, 70%, 45%, 0.35)',
          boxShadow: '0 0 50px hsla(0, 70%, 40%, 0.15), 0 20px 40px hsla(0, 0%, 0%, 0.5)',
        }}
      >
        <div className="p-6 space-y-4">
          <div className="text-center">
            <div
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'radial-gradient(circle, hsla(0, 70%, 45%, 0.2) 0%, transparent 70%)' }}
            >
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white">OOPS!!</h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'hsla(0, 0%, 100%, 0.75)' }}>
              Your access expired. To continue watching anime click here to reactivate your Premium access
            </p>
          </div>

          <div className="space-y-2.5">
            <a
              href="https://t.me/getunlocktoken"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, hsl(0, 72%, 45%) 0%, hsl(0, 72%, 35%) 100%)',
                boxShadow: '0 0 15px hsla(0, 72%, 45%, 0.3)',
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Reactivate
            </a>
            <button
              onClick={dismissPopup}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-medium text-sm transition-all duration-200"
              style={{
                border: '1px solid hsla(0, 0%, 100%, 0.15)',
                color: 'hsla(0, 0%, 100%, 0.6)',
              }}
            >
              <X className="h-3.5 w-3.5" />
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
