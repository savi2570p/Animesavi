import { useEffect, useState } from 'react';
import { Sparkles, Crown, X } from 'lucide-react';
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

/**
 * Global popup: when an admin grants a 1-month free trial to a user,
 * the next time the user opens the site we (a) show a celebration popup,
 * (b) write the unlock token data to localStorage so all access checks
 * pass, and (c) flip `acknowledged` so the popup doesn't repeat.
 */
export function AdminTrialPopup() {
  const { user } = useAuth();
  const [grant, setGrant] = useState<Grant | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('admin_token_grants' as any)
        .select('id, expires_at, duration_hours, granted_at, acknowledged')
        .eq('user_id', user.id)
        .eq('acknowledged', false)
        .gt('expires_at', new Date().toISOString())
        .order('granted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const g = data as unknown as Grant;
        setGrant(g);
        // Activate token locally so the user immediately has access
        const expiresAt = new Date(g.expires_at).getTime();
        localStorage.setItem('unlock_token_expires', String(expiresAt));
        localStorage.setItem('unlock_token_id', `admin-grant-${g.id}`);
        localStorage.setItem('unlock_token_value', `admin-grant-${g.id}`);
      }
    })();
  }, [user]);

  const handleClose = async () => {
    if (!grant || !user) return;
    await supabase
      .from('admin_token_grants' as any)
      .update({ acknowledged: true })
      .eq('id', grant.id);
    setGrant(null);
    toast.success('1 month free trial activated! 🎉');
  };

  if (!grant) return null;

  const expires = new Date(grant.expires_at);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative max-w-md w-full bg-gradient-to-br from-amber-500/20 via-card to-primary/10 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 z-10"
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
            Admin gave you 1 month free trial
          </h2>
          <p className="text-muted-foreground text-sm mb-4">
            Enjoy full access to every premium episode, server and feature — on us.
          </p>

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
