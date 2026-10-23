import { Button } from '@/components/ui/button';
import { TokenPerks } from '@/components/TokenPerks';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  XCircle,
  Shield,
  Clock,
  Crown,
  Zap,
  Globe,
  Ban,
  Download,
  Tv,
  ExternalLink,
  Sparkles,
  Calendar,
  KeyRound,
  Copy,
  Check,
  PowerOff,
  User,
  History,
  BadgeCheck,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTokenAccessFromDB, isSuperAdmin } from '@/components/AccessBanner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCastDetection } from '@/hooks/useCastDetection';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TokenMetadata {
  issuerEmail: string | null;
  createdAt: Date | null;
  usedAt: Date | null;
  expiresAt: number | null;
  durationHours: number | null;
}
export function VerifyTokenDialog({ open, onOpenChange }: Props) {

  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'active' | 'expired'>('loading');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [activatedAt, setActivatedAt] = useState<Date | null>(null);
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [role, setRole] = useState<string>('Member');
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [metadata, setMetadata] = useState<TokenMetadata>({
    issuerEmail: null,
    createdAt: null,
    usedAt: null,
    expiresAt: null,
    durationHours: null,
  });
  const isCasting = useCastDetection();

  const superAdmin = isSuperAdmin(user?.email);


  useEffect(() => {
    if (!open) return;
    setStatus('loading');
    setExpiresAt(null);
    setActivatedAt(null);
    setDurationHours(null);

    if (superAdmin) {
      setStatus('active');
      setRole('Super Admin');
      return;
    }
    if (isAdmin) setRole('Admin');

    (async () => {
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
          setActivatedAt(new Date(usage.used_at));
          if (usage.expires_at) {
            const expMs =
              typeof usage.expires_at === 'number' && usage.expires_at < 1e12
                ? usage.expires_at * 1000
                : Number(usage.expires_at);
            setExpiresAt(new Date(expMs));
            const activatedMs = new Date(usage.used_at).getTime();
            setDurationHours(Math.round((expMs - activatedMs) / (1000 * 60 * 60)));
          }
          if (usage.token_id) {
            const { data: hours } = await supabase.rpc('get_token_duration', {
              _token_id: usage.token_id,
            });
            if (typeof hours === 'number' && hours > 0) setDurationHours(hours);
          }

          // Fetch rich metadata (issuer, created time, last used) for the end-token confirmation
          try {
            const { data: metaRows, error: metaError } = await supabase.rpc('get_token_metadata');
            if (!metaError && metaRows && metaRows.length > 0) {
              const row = metaRows[0];
              setMetadata({
                issuerEmail: row.issuer_email ?? null,
                createdAt: row.token_created_at ? new Date(row.token_created_at) : null,
                usedAt: row.token_used_at ? new Date(row.token_used_at) : null,
                expiresAt: row.token_expires_at ?? null,
                durationHours: row.duration_hours ?? null,
              });
            }
          } catch {
            // Non-critical: keep existing UI if metadata fails
          }


        }

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
    })();
  }, [open, user?.email, user?.id, isAdmin, superAdmin]);

  // Tick every second for live countdown — paused while casting/mirroring
  useEffect(() => {
    if (!open || status !== 'active' || !expiresAt) return;
    if (isCasting) return; // freeze "time remaining" UI during cast
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, status, expiresAt, isCasting]);

  const isActive = status === 'active';

  // Countdown breakdown
  const countdown = useMemo(() => {
    if (!expiresAt) return null;
    const diff = Math.max(0, expiresAt.getTime() - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds, totalMs: diff };
  }, [expiresAt, now]);

  // Progress (time used vs total)
  const progress = useMemo(() => {
    if (!activatedAt || !expiresAt) return 0;
    const total = expiresAt.getTime() - activatedAt.getTime();
    const used = now - activatedAt.getTime();
    return Math.max(0, Math.min(100, (used / total) * 100));
  }, [activatedAt, expiresAt, now]);

  const remainingPct = 100 - progress;

  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const formatTime = (d: Date | null) =>
    d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

  const formatPlanLabel = (hours: number | null) => {
    if (!hours) return 'Lifetime';
    if (hours >= 720) return `${Math.round(hours / 720)}-Month Plan`;
    if (hours >= 168) return `${Math.round(hours / 168)}-Week Plan`;
    if (hours >= 24) return `${Math.round(hours / 24)}-Day Plan`;
    return `${hours}-Hour Plan`;
  };

  const copyEmail = async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      toast.success('Email copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleEndToken = () => {
    setShowConfirm(true);
  };

  const handleConfirmEnd = async () => {
    if (!user?.id) return;
    setShowConfirm(false);
    setEnding(true);
    const { error } = await supabase.from('token_usage').delete().eq('user_id', user.id);
    setEnding(false);
    if (error) {
      toast.error('Could not end token', { description: error.message });
      return;
    }
    try {
      localStorage.removeItem('unlock_token_expires');
      localStorage.removeItem('unlock_token_id');
      localStorage.removeItem('token_access_synced');
    } catch { /* ignore */ }
    setStatus('expired');
    setExpiresAt(null);
    setActivatedAt(null);
    toast.success('Token ended', { description: 'Activate a new token link to restore access.' });
    setTimeout(() => window.location.reload(), 900);
  };

  const handleCancelEnd = () => {
    setShowConfirm(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (status === 'expired') navigate('/');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="token-panel-v7 token-verify-v7 utility-glass-v6 p-0 gap-0">
        <DialogTitle className="sr-only">Verify Token</DialogTitle>
        <DialogDescription className="sr-only">Your account, premium access and token status.</DialogDescription>
        {status === 'loading' ? (
          <div className="token-loading-v7"><Shield className="h-8 w-8 text-primary motion-safe:animate-pulse" /><p>Verifying your premium access…</p></div>
        ) : (
          <>
            <header className="token-header-v7" data-status={isActive ? 'active' : 'expired'}>
              <div className="token-status-icon-v7">{isActive ? <CheckCircle2 /> : <XCircle />}</div>
              <span className="token-eyebrow-v7">{superAdmin ? 'Lifetime Access' : isActive ? formatPlanLabel(durationHours) : 'Access Ended'}</span>
              <h2>{isActive ? 'Premium Active' : 'Premium Expired'}</h2>
              <p>{isActive ? superAdmin ? 'You have unlimited access to all premium features.' : 'Enjoy uninterrupted streaming on every device.' : 'Renew your token to restore premium streaming.'}</p>
            </header>
            <div className="token-body-v7">
              {superAdmin && <div className="token-plan-v7"><Crown /><div><strong>Lifetime Premium</strong><p>Never expires • All features unlocked</p></div></div>}
              {isActive && countdown && !superAdmin && (
                <section className="token-section-v7">
                  <h3><Clock />Time Remaining</h3>
                  <div className="token-countdown-v7">
                    {[{ v: countdown.days, l: 'Days' }, { v: countdown.hours, l: 'Hrs' }, { v: countdown.minutes, l: 'Min' }, { v: countdown.seconds, l: 'Sec' }].map((b) => <div key={b.l}><strong>{String(b.v).padStart(2, '0')}</strong><span>{b.l}</span></div>)}
                  </div>
                </section>
              )}
              {user && (
                <section className="token-section-v7">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0"><h3><Shield />Account</h3><p className="token-email-v7">{user.email}</p></div>
                    <Button variant="glass" size="icon" className="h-8 w-8 rounded-md shrink-0" onClick={copyEmail} aria-label="Copy email" title="Copy email">{copied ? <Check /> : <Copy />}</Button>
                  </div>
                  <dl className="token-details-v7"><div><dt>Role</dt><dd>{role}</dd></div><div><dt>Status</dt><dd className={isActive ? 'token-active-v7' : 'text-destructive'}>{isActive ? 'Verified' : 'Expired'}</dd></div></dl>
                </section>
              )}
              {isActive && !superAdmin && (activatedAt || expiresAt) && (
                <section className="token-section-v7">
                  <h3><KeyRound />Plan Timeline</h3>
                  <dl className="token-details-v7"><div><dt>Activated</dt><dd>{formatDate(activatedAt)}</dd><small>{formatTime(activatedAt)}</small></div><div><dt>Expires</dt><dd>{formatDate(expiresAt)}</dd><small>{formatTime(expiresAt)}</small></div></dl>
                  <div className="mt-3 utility-progress-v6"><span style={{ width: `${progress}%` }} /></div>
                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground"><span>{Math.round(progress)}% used</span><span>{Math.round(remainingPct)}% left</span></div>
                </section>
              )}
              {isActive && <section className="token-section-v7"><h3><Sparkles />Premium Perks Unlocked</h3><TokenPerks /></section>}
              {isActive && <p className="token-note-v7"><Shield className="h-4 w-4 shrink-0" />Ending your token revokes premium access. Activate a new token link to restore your perks.</p>}
            </div>
            <footer className="token-actions-v7">
              {!isActive && <Button asChild className="w-full"><a href="https://t.me/getunlocktoken" target="_blank" rel="noopener noreferrer"><ExternalLink />Get New Token</a></Button>}
              {isActive && <Button variant="outline" className="token-end-v7 w-full" onClick={handleEndToken} disabled={ending}><PowerOff />{ending ? 'Ending…' : 'End Token'}</Button>}
              <Button variant="glass" className="w-full" onClick={handleClose}>{isActive ? 'Close' : 'Go to Homepage'}</Button>
            </footer>
            {showConfirm && typeof document !== 'undefined' && createPortal(
              <div className="token-confirm-overlay-v7 utility-overlay-v6 fixed inset-0 flex items-center justify-center p-4">
                <section role="alertdialog" aria-modal="true" aria-labelledby="end-token-title" aria-describedby="end-token-description" className="token-panel-v7 utility-glass-v6">
                  <header className="token-header-v7" data-status="expired"><div className="token-status-icon-v7"><PowerOff /></div><h3 id="end-token-title" className="text-lg font-bold">End Token?</h3><p id="end-token-description">This immediately removes your premium session. Activate a new token link to restore access.</p></header>
                  <div className="token-body-v7"><section className="token-section-v7"><h3><BadgeCheck />Token Details</h3><dl className="token-metadata-v7"><div><dt>Issuer</dt><dd>{metadata.issuerEmail?.trim() || 'AnimeSavi Team'}</dd></div><div><dt>Created</dt><dd>{metadata.createdAt ? formatDate(metadata.createdAt) : '—'}</dd></div><div><dt>Last used</dt><dd>{metadata.usedAt ? formatDate(metadata.usedAt) : '—'}</dd></div></dl></section></div>
                  <footer className="token-actions-v7 grid grid-cols-2 gap-2"><Button variant="glass" onClick={handleCancelEnd}>Cancel</Button><Button variant="destructive" onClick={handleConfirmEnd} disabled={ending}>{ending ? 'Ending…' : 'Yes, End'}</Button></footer>
                </section>
              </div>, document.body,
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
