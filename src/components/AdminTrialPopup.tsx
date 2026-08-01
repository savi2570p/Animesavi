import { useEffect, useState } from 'react';
import { Sparkles, Crown, X, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Grant {
  id: string;
  expires_at: string;
  duration_hours: number;
  granted_at: string;
  acknowledged: boolean;
}

type TrialStatus = 'active' | 'expired' | 'used';

/** Per-grant guard so a refresh (or a race with the DB update) can't re-show it. */
const seenKey = (grantId: string) => `admin_trial_seen_${grantId}`;

/**
 * Global popup: when an admin grants a free trial, the next time the user opens
 * the site we (a) show a celebration popup once, (b) write the unlock token data
 * to localStorage so all access checks pass, and (c) flip `acknowledged` so the
 * popup never repeats for that grant. A brand-new grant (different id) shows again.
 */
export function AdminTrialPopup() {
  const { user } = useAuth();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [status, setStatus] = useState<TrialStatus>('active');

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Fetch the most recent grant regardless of state so we can classify it.
      const { data } = await supabase
        .from('admin_token_grants' as any)
        .select('id, expires_at, duration_hours, granted_at, acknowledged')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;
      const g = data as unknown as Grant;
      const expiresAt = new Date(g.expires_at).getTime();
      const isExpired = expiresAt <= Date.now();

      // Already consumed → popup disabled entirely.
      if (g.acknowledged || localStorage.getItem(seenKey(g.id))) return;

      if (isExpired) {
        // Trial ran out before it was ever opened: consume it silently.
        localStorage.setItem(seenKey(g.id), '1');
        await supabase
          .from('admin_token_grants' as any)
          .update({ acknowledged: true })
          .eq('id', g.id);
        return;
      }

      setStatus('active');
      setGrant(g);
      // Activate token locally so the user immediately has access
      localStorage.setItem('unlock_token_expires', String(expiresAt));
      localStorage.setItem('unlock_token_id', `admin-grant-${g.id}`);
      localStorage.setItem('unlock_token_value', `admin-grant-${g.id}`);
    })();
  }, [user]);

  const handleClose = async () => {
    if (!grant || !user) return;
    localStorage.setItem(seenKey(grant.id), '1');
    setStatus('used');
    await supabase
      .from('admin_token_grants' as any)
      .update({ acknowledged: true })
      .eq('id', grant.id);
    setGrant(null);
    toast.success('Free trial activated — enjoy! 🎉');
  };

  if (!grant) return null;

  const expires = new Date(grant.expires_at);
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const statusChip = {
    active: {
      icon: CheckCircle2,
      label: 'Trial active',
      text: `Your gifted access is live right now and will end in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    },
    expired: {
      icon: Clock,
      label: 'Trial expired',
      text: 'This gifted trial has already run out.',
      className: 'bg-red-500/15 text-red-300 border-red-400/30',
    },
    used: {
      icon: CheckCircle2,
      label: 'Trial already used',
      text: 'You have already claimed this gift.',
      className: 'bg-white/10 text-white/70 border-white/20',
    },
  }[status];

  const StatusIcon = statusChip.icon;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative max-w-md w-full bg-gradient-to-br from-amber-500/20 via-card to-primary/10 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/40 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/40 rounded-full blur-3xl" />
        </div>

        <div className="relative p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/40">
            <Crown className="h-8 w-8 text-white" />
          </div>

          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Special Gift
            </span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>

          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
            Admin gave you a free trial
          </h2>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold mb-3 ${statusChip.className}`}
            role="status"
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusChip.label}
          </div>

          <p className="text-muted-foreground text-sm mb-4">{statusChip.text}</p>

          <div className="bg-card/60 border border-amber-500/30 rounded-lg py-3 px-4 mb-5">
            <p className="text-xs text-muted-foreground mb-1">Access valid for</p>
            <p className="text-3xl font-mono font-bold text-amber-400">
              {daysLeft} <span className="text-sm font-sans text-muted-foreground">days</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Until {expires.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <Button
            onClick={handleClose}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold"
          >
            Start Watching
          </Button>
        </div>
      </div>
    </div>
  );
}
