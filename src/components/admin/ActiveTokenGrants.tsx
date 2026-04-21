import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Grant {
  id: string;
  user_id: string;
  granted_at: string;
  expires_at: string;
  duration_hours: number;
  acknowledged: boolean;
  username?: string | null;
}

export function ActiveTokenGrants() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('admin_token_grants' as any)
      .select('id, user_id, granted_at, expires_at, duration_hours, acknowledged')
      .gt('expires_at', nowIso)
      .order('granted_at', { ascending: false });

    if (error) {
      toast.error('Failed to load grants', { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data || []) as any as Grant[];
    const userIds = Array.from(new Set(rows.map((g) => g.user_id)));
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      const map = new Map((profiles || []).map((p) => [p.id, p.username]));
      rows.forEach((g) => (g.username = map.get(g.user_id) || null));
    }
    setGrants(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = async (g: Grant) => {
    if (!confirm(`Revoke 1-month trial for ${g.username || 'this user'}? Their access will be removed immediately.`)) return;
    setRevokingId(g.id);
    const { error } = await supabase.from('admin_token_grants' as any).delete().eq('id', g.id);
    setRevokingId(null);
    if (error) {
      toast.error('Failed to revoke', { description: error.message });
    } else {
      toast.success('Grant revoked');
      setGrants((prev) => prev.filter((x) => x.id !== g.id));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Active 1-Month Trials
        </CardTitle>
        <CardDescription>
          {grants.length} active grant{grants.length === 1 ? '' : 's'}. Revoke to remove access immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : grants.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No active trials.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {grants.map((g) => {
              const expiresAt = new Date(g.expires_at);
              const isExpiringSoon = expiresAt.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="h-9 w-9 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center">
                    <Crown className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {g.username || g.user_id.slice(0, 8)}
                      {!g.acknowledged && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-amber-500/80">unseen</span>
                      )}
                    </p>
                    <p className={`text-xs flex items-center gap-1 ${isExpiringSoon ? 'text-orange-500' : 'text-muted-foreground'}`}>
                      <Clock className="h-3 w-3" />
                      Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokingId === g.id}
                    onClick={() => handleRevoke(g)}
                    className="text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    {revokingId === g.id ? '...' : 'Revoke'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
