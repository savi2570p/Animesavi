import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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

  const handleEndToken = async () => {
    if (!user?.id) return;
    if (!confirm('End your token now? You will need to activate a new token link to regain premium access.')) return;
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

  const handleClose = () => {
    onOpenChange(false);
    if (status === 'expired') navigate('/');
  };

  // SVG ring
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (remainingPct / 100) * ringCircumference;

  const features = [
    { icon: Tv, label: '4K Ultra HD', tone: 'text-sky-400 bg-sky-500/10' },
    { icon: Ban, label: 'Ad-Free', tone: 'text-rose-400 bg-rose-500/10' },
    { icon: Globe, label: 'Multi-Audio', tone: 'text-emerald-400 bg-emerald-500/10' },
    { icon: Download, label: '4K Downloads', tone: 'text-violet-400 bg-violet-500/10' },
    { icon: Zap, label: 'Priority Servers', tone: 'text-amber-400 bg-amber-500/10' },
    { icon: Sparkles, label: 'Early Access', tone: 'text-pink-400 bg-pink-500/10' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden border-white/15 text-foreground shadow-2xl"
        style={{
          background:
            'linear-gradient(160deg, hsla(0,0%,100%,0.08) 0%, hsla(0,0%,100%,0.02) 45%, hsla(0,0%,0%,0.35) 100%)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow:
            '0 30px 70px hsla(0,0%,0%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.18), inset 0 -1px 0 hsla(0,0%,0%,0.35)',
        }}
      >
        <DialogTitle className="sr-only">Verify Token</DialogTitle>

        {status === 'loading' ? (
          <div className="py-14 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-primary/20 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-xs text-muted-foreground">Verifying your premium access…</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Cinematic header with progress ring */}
            <div className="relative overflow-hidden">
              <div
                className={`absolute inset-0 ${
                  isActive
                    ? 'bg-gradient-to-br from-emerald-500/25 via-primary/10 to-transparent'
                    : 'bg-gradient-to-br from-destructive/25 via-rose-500/10 to-transparent'
                }`}
              />
              <div
                className={`absolute -top-16 -right-12 w-56 h-56 rounded-full blur-3xl ${
                  isActive ? 'bg-emerald-500/30' : 'bg-destructive/30'
                }`}
              />
              <div
                className={`absolute -bottom-20 -left-12 w-48 h-48 rounded-full blur-3xl ${
                  isActive ? 'bg-primary/20' : 'bg-rose-500/20'
                }`}
              />

              <div className="relative px-5 pt-6 pb-4 flex flex-col items-center">
                {/* Progress ring with status icon */}
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={ringRadius}
                      strokeWidth="6"
                      fill="none"
                      className="stroke-muted/40"
                    />
                    {isActive && expiresAt && (
                      <circle
                        cx="50"
                        cy="50"
                        r={ringRadius}
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        stroke="url(#ringGrad)"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    )}
                    <defs>
                      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(142, 71%, 50%)" />
                        <stop offset="100%" stopColor="hsl(160, 85%, 45%)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl ${
                        isActive
                          ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                          : 'bg-gradient-to-br from-destructive to-rose-600'
                      }`}
                    >
                      {isActive ? (
                        <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2.5} />
                      ) : (
                        <XCircle className="h-7 w-7 text-white" strokeWidth={2.5} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <Crown
                    className={`h-3.5 w-3.5 ${isActive ? 'text-amber-400' : 'text-muted-foreground'}`}
                  />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {superAdmin ? 'Lifetime Access' : isActive ? formatPlanLabel(durationHours) : 'Access Ended'}
                  </p>
                </div>
                <h2 className="mt-1 text-lg font-black text-foreground text-center">
                  {isActive ? 'Premium Active' : 'Premium Expired'}
                </h2>
                <p className="text-[11px] text-muted-foreground text-center mt-0.5 max-w-[260px]">
                  {isActive
                    ? superAdmin
                      ? 'You have unlimited access to all premium features.'
                      : 'Enjoy uninterrupted streaming on every device.'
                    : 'Renew your token to restore premium streaming.'}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 pb-4 pt-2 space-y-3">
              {/* Live Countdown */}
              {isActive && countdown && !superAdmin && (
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-primary/5 border border-emerald-500/20 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-3 w-3 text-emerald-400" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      Time Remaining
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { v: countdown.days, l: 'Days' },
                      { v: countdown.hours, l: 'Hrs' },
                      { v: countdown.minutes, l: 'Min' },
                      { v: countdown.seconds, l: 'Sec' },
                    ].map((b) => (
                      <div
                        key={b.l}
                        className="rounded-lg bg-background/60 border border-border/40 py-1.5 text-center backdrop-blur-sm"
                      >
                        <div className="text-base font-black text-foreground tabular-nums leading-none">
                          {String(b.v).padStart(2, '0')}
                        </div>
                        <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                          {b.l}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {superAdmin && (
                <div className="rounded-xl bg-gradient-to-br from-amber-500/15 to-yellow-500/5 border border-amber-500/30 p-3 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                    <Crown className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-foreground">Lifetime Premium</p>
                    <p className="text-[10px] text-muted-foreground">Never expires • All features unlocked</p>
                  </div>
                </div>
              )}

              {/* Account card */}
              {user && (
                <div className="rounded-xl bg-muted/40 border border-border/40 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <Shield className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          Account
                        </p>
                        <p className="text-[11px] font-semibold text-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={copyEmail}
                      className="shrink-0 h-7 w-7 rounded-lg bg-background/60 hover:bg-background border border-border/40 flex items-center justify-center transition-colors"
                      aria-label="Copy email"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/40">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        Role
                      </p>
                      <p className="text-[11px] font-semibold text-foreground">{role}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        Status
                      </p>
                      <p
                        className={`text-[11px] font-bold flex items-center gap-1 ${
                          isActive ? 'text-emerald-500' : 'text-destructive'
                        }`}
                      >
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'
                          }`}
                        />
                        {isActive ? 'Verified' : 'Expired'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan timeline */}
              {isActive && !superAdmin && (activatedAt || expiresAt) && (
                <div className="rounded-xl bg-muted/40 border border-border/40 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="h-3 w-3 text-primary" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      Plan Timeline
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-background/60 border border-border/30 p-2">
                      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Zap className="h-2.5 w-2.5" /> Activated
                      </div>
                      <p className="text-[11px] font-semibold text-foreground mt-0.5">
                        {formatDate(activatedAt)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{formatTime(activatedAt)}</p>
                    </div>
                    <div className="rounded-lg bg-background/60 border border-border/30 p-2">
                      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Calendar className="h-2.5 w-2.5" /> Expires
                      </div>
                      <p className="text-[11px] font-semibold text-foreground mt-0.5">
                        {formatDate(expiresAt)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{formatTime(expiresAt)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground mb-1">
                      <span>{Math.round(progress)}% used</span>
                      <span>{Math.round(remainingPct)}% left</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-primary to-emerald-400 transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Features grid */}
              {isActive && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      Premium Perks Unlocked
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {features.map(({ icon: Icon, label, tone }) => (
                      <div
                        key={label}
                        className="rounded-lg bg-muted/30 border border-border/30 p-2 flex flex-col items-center gap-1 hover:border-primary/30 transition-colors"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[9px] font-semibold text-foreground text-center leading-tight">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {!isActive && (
                <a
                  href="https://t.me/getunlocktoken"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-primary to-rose-500 hover:opacity-90 shadow-lg shadow-primary/30 transition-opacity"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Get New Token
                </a>
              )}

              {/* End token */}
              {isActive && !superAdmin && (
                <button
                  onClick={handleEndToken}
                  disabled={ending}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-xs font-black text-destructive bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 disabled:opacity-60 transition-colors"
                >
                  <PowerOff className="h-3.5 w-3.5" />
                  {ending ? 'Ending…' : 'End Token'}
                </button>
              )}



              <button
                onClick={handleClose}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isActive
                    ? 'bg-card border border-border/60 text-foreground hover:bg-muted/60'
                    : 'bg-muted/60 text-foreground hover:bg-muted'
                }`}
              >
                {isActive ? 'Close' : 'Go to Homepage'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
