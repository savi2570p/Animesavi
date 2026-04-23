import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Shield, Clock, Crown, Zap, Globe, Ban, Download, Tv, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTokenAccessFromDB, isSuperAdmin } from '@/components/AccessBanner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerifyTokenDialog({ open, onOpenChange }: Props) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'active' | 'expired'>('loading');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [role, setRole] = useState<string>('Member');

  useEffect(() => {
    if (!open) return;
    setStatus('loading');
    setExpiresAt(null);
    setDurationHours(null);
    setActivatedAt(null);

    const superAdmin = isSuperAdmin(user?.email);
    if (superAdmin) {
      setStatus('active');
      setRole('Super Admin');
      return;
    }

    if (isAdmin) setRole('Admin');

    // Fetch token details from DB
    const fetchDetails = async () => {
      const result = await fetchTokenAccessFromDB();
      setStatus(result.hasAccess ? 'active' : 'expired');

      if (user?.id) {
        const { data: usage } = await supabase
          .from('token_usage')
          .select('expires_at, used_at, token_id')
          .eq('user_id', user.id)
          .order('used_at', { ascending: false })
          .limit(1)
          .single();

        if (usage) {
          setActivatedAt(new Date(usage.used_at).toLocaleString());
          if (usage.expires_at) {
            const expMs = typeof usage.expires_at === 'number' && usage.expires_at < 1e12
              ? usage.expires_at * 1000
              : usage.expires_at;
            setExpiresAt(new Date(expMs).toLocaleString());

            // Calculate duration
            const activatedMs = new Date(usage.used_at).getTime();
            const hours = Math.round((Number(expMs) - activatedMs) / (1000 * 60 * 60));
            setDurationHours(hours);
          }

          // Fetch token duration
          if (usage.token_id) {
            const { data: hours } = await supabase
              .rpc('get_token_duration', { _token_id: usage.token_id });
            if (typeof hours === 'number' && hours > 0) {
              setDurationHours(hours);
            }
          }
        }

        // Get role
        if (!isAdmin && !superAdmin) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          if (roles && roles.length > 0) {
            const r = roles[0].role;
            setRole(r.charAt(0).toUpperCase() + r.slice(1));
          }
        }
      }
    };

    fetchDetails();
  }, [open, user?.email, user?.id, isAdmin]);

  const handleOk = () => {
    onOpenChange(false);
    if (status === 'expired') {
      navigate('/');
    }
  };

  const isActive = status === 'active';

  const formatDuration = (hours: number) => {
    if (hours >= 720) return `${Math.round(hours / 720)} months`;
    if (hours >= 168) return `${Math.round(hours / 168)} weeks`;
    if (hours >= 24) return `${Math.round(hours / 24)} days`;
    return `${hours} hours`;
  };

  const includedFeatures = [
    { icon: Tv, label: 'HD & 4K Streaming' },
    { icon: Ban, label: 'Ad-Free Experience' },
    { icon: Globe, label: 'Multi-Language Audio' },
    { icon: Download, label: '4K Downloads' },
    { icon: Zap, label: 'Priority Access' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border p-4">
        <DialogTitle className="sr-only">Verify Token</DialogTitle>
        {status === 'loading' ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Checking your access...</p>
          </div>
        ) : (
          <div className="py-2 space-y-3">
            {/* Status Icon */}
            <div className="flex justify-center">
              {isActive ? (
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              )}
            </div>

            {/* Title */}
            <div className="text-center">
              <p className="text-base font-bold text-foreground">
                {isActive ? '✅ Premium Active' : '❌ Premium Ended'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isActive
                  ? 'Your token is verified and working perfectly.'
                  : 'Your access has expired. Renew to continue.'}
              </p>
            </div>

            {/* Account Info */}
            {user && (
              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-medium text-foreground truncate ml-2 max-w-[160px]">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium text-foreground">{role}</span>
                </div>
              </div>
            )}

            {/* Token Details */}
            <div className="rounded-lg bg-muted/50 p-2.5 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Status</span>
                <span className={`font-semibold ml-auto ${isActive ? 'text-green-500' : 'text-destructive'}`}>
                  {isActive ? '● Verified' : '● Expired'}
                </span>
              </div>
              {durationHours && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Crown className="w-3.5 h-3.5 shrink-0" />
                  <span>Plan Duration</span>
                  <span className="font-medium text-foreground ml-auto">{formatDuration(durationHours)}</span>
                </div>
              )}
              {activatedAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span>Activated</span>
                  <span className="font-medium text-foreground ml-auto text-[10px]">{activatedAt}</span>
                </div>
              )}
              {isActive && expiresAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Expires</span>
                  <span className="font-medium text-foreground ml-auto text-[10px]">{expiresAt}</span>
                </div>
              )}
            </div>

            {/* What's Included */}
            {isActive && (
              <div className="rounded-lg bg-muted/30 p-2.5">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">What's Included</p>
                <div className="grid grid-cols-2 gap-1">
                  {includedFeatures.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Icon className="w-3 h-3 text-green-500 shrink-0" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Renew CTA for expired */}
            {!isActive && (
              <a
                href="https://t.me/getunlocktoken"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Get New Token
              </a>
            )}

            <button
              onClick={handleOk}
              className="w-full py-2 rounded-lg font-medium text-xs text-white transition-colors"
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
