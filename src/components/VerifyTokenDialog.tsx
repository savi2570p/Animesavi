import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
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

  const handleOpen = async (isOpen: boolean) => {
    if (isOpen) {
      setStatus('loading');
      if (isSuperAdmin(user?.email)) {
        setStatus('active');
        return;
      }
      const result = await fetchTokenAccessFromDB();
      setStatus(result.hasAccess ? 'active' : 'expired');
    }
    onOpenChange(isOpen);
  };

  const handleOk = () => {
    onOpenChange(false);
    if (status === 'expired') {
      navigate('/');
    }
  };

  const isActive = status === 'active';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-xs bg-card border-border text-center">
        <DialogTitle className="sr-only">Verify Token</DialogTitle>
        {status === 'loading' ? (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="flex justify-center">
              {isActive ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500" />
              )}
            </div>
            <p className="text-lg font-bold text-foreground">
              {isActive ? 'Premium Activated' : 'Premium Ended'}
            </p>
            <button
              onClick={handleOk}
              className="w-full py-2 rounded-lg font-medium text-sm text-white transition-colors"
              style={{
                background: isActive
                  ? 'hsl(142, 71%, 45%)'
                  : 'hsl(0, 72%, 45%)',
              }}
            >
              OK
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
