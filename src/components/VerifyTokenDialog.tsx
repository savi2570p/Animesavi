import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Shield, Clock, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTokenAccessFromDB, isSuperAdmin } from '@/components/AccessBanner';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerifyTokenDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'active' | 'expired'>('loading');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus('loading');
    setExpiresAt(null);

    if (isSuperAdmin(user?.email)) {
      setStatus('active');
      return;
    }

    fetchTokenAccessFromDB().then((result) => {
      setStatus(result.hasAccess ? 'active' : 'expired');
      // Try to get expiry from localStorage
      const stored = localStorage.getItem('token_access');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.expiresAt) {
            const expDate = new Date(typeof parsed.expiresAt === 'number' && parsed.expiresAt < 1e12 
              ? parsed.expiresAt * 1000 
              : parsed.expiresAt);
            setExpiresAt(expDate.toLocaleString());
          }
        } catch {}
      }
    });
  }, [open, user?.email]);

  const handleOk = () => {
    onOpenChange(false);
    if (status === 'expired') {
      navigate('/');
    }
  };

  const isActive = status === 'active';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogTitle className="sr-only">Verify Token</DialogTitle>
        {status === 'loading' ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Checking your access...</p>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="flex justify-center">
              {isActive ? (
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-lg font-bold text-foreground">
                {isActive ? 'Premium Active' : 'Premium Ended'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isActive
                  ? 'Your token is valid and working.'
                  : 'Your access token has expired. Please renew to continue watching.'}
              </p>
            </div>

            {/* Details section */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Status:</span>
                <span className={`font-medium ml-auto ${isActive ? 'text-green-500' : 'text-destructive'}`}>
                  {isActive ? 'Verified' : 'Expired'}
                </span>
              </div>
              {isActive && expiresAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Expires:</span>
                  <span className="font-medium text-foreground ml-auto text-xs">{expiresAt}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Crown className="w-4 h-4 shrink-0" />
                <span>Plan:</span>
                <span className="font-medium text-foreground ml-auto">
                  {isActive ? 'Premium Access' : 'No Active Plan'}
                </span>
              </div>
            </div>

            <button
              onClick={handleOk}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors"
              style={{
                background: isActive
                  ? 'hsl(142, 71%, 45%)'
                  : 'hsl(0, 72%, 45%)',
              }}
            >
              {isActive ? 'OK' : 'Go to Homepage'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
