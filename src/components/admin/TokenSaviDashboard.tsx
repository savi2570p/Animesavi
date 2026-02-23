import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Key, Copy, Trash2, Plus, Clock, CheckCircle, XCircle, Users, BarChart3, Power } from 'lucide-react';
import { fetchTokenSystemStatus } from '@/components/AccessBanner';

interface Token {
  id: string;
  token: string;
  duration_hours: number;
  is_active: boolean;
  created_at: string;
}

interface TokenUsage {
  id: string;
  token_id: string;
  user_ip: string | null;
  user_agent: string | null;
  used_at: string;
}

export function TokenSaviDashboard() {
  const { isAdmin } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [usage, setUsage] = useState<TokenUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState('24');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [systemEnabled, setSystemEnabled] = useState(true);

  useEffect(() => {
    fetchData();
    fetchTokenSystemStatus().then(setSystemEnabled);
  }, []);

  const fetchData = async () => {
    const [tokensRes, usageRes] = await Promise.all([
      supabase.from('unlock_tokens').select('*').neq('token', '__system_toggle__').order('created_at', { ascending: false }),
      supabase.from('token_usage').select('*').order('used_at', { ascending: false }),
    ]);
    if (tokensRes.data) setTokens(tokensRes.data as Token[]);
    if (usageRes.data) setUsage(usageRes.data as TokenUsage[]);
    setIsLoading(false);
  };

  const generateToken = async () => {
    if (!isAdmin) {
      toast.error('Only admins can generate tokens');
      return;
    }
    setIsGenerating(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('unlock_tokens').insert({
      duration_hours: parseInt(duration),
      created_by: userData.user?.id,
    });
    if (error) toast.error('Failed to generate token');
    else {
      toast.success('Token generated');
      fetchData();
    }
    setIsGenerating(false);
  };

  const toggleToken = async (id: string, isActive: boolean) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('unlock_tokens').update({ is_active: !isActive }).eq('id', id);
    if (!error) {
      setTokens(tokens.map(t => t.id === id ? { ...t, is_active: !isActive } : t));
      toast.success(isActive ? 'Deactivated' : 'Activated');
    }
  };

  const deleteToken = async (id: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('unlock_tokens').delete().eq('id', id);
    if (!error) {
      setTokens(tokens.filter(t => t.id !== id));
      toast.success('Token deleted');
    }
  };

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/verify?token=${token}`);
    toast.success('URL copied');
  };

  const getUsageCount = (tokenId: string) => usage.filter(u => u.token_id === tokenId).length;

  const formatDuration = (h: number) => h < 24 ? `${h}h` : `${h / 24}d`;

  const selectedUsage = selectedTokenId ? usage.filter(u => u.token_id === selectedTokenId) : [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{tokens.length}</p>
          <p className="text-xs text-muted-foreground">Total Tokens</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{tokens.filter(t => t.is_active).length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{usage.length}</p>
          <p className="text-xs text-muted-foreground">Total Uses</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{new Set(usage.map(u => u.user_ip)).size}</p>
          <p className="text-xs text-muted-foreground">Unique Users</p>
        </CardContent></Card>
      </div>

      {/* Generate (admin only) */}
      {isAdmin && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-primary" />Generate Token</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="space-y-2 w-full sm:w-48">
                <label className="text-sm text-muted-foreground">Duration</label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Hour</SelectItem>
                    <SelectItem value="6">6 Hours</SelectItem>
                    <SelectItem value="12">12 Hours</SelectItem>
                    <SelectItem value="24">24 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generateToken} disabled={isGenerating} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />Generate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token List */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Tokens & Usage</CardTitle></CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No tokens yet</p>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => {
                const count = getUsageCount(token.id);
                return (
                  <div key={token.id} className={`p-4 rounded-lg border ${token.is_active ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {token.is_active ? (
                            <Badge className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>
                          )}
                          <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{formatDuration(token.duration_hours)}</Badge>
                          <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{count} uses</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{token.token}</p>
                        <p className="text-xs text-muted-foreground mt-1">Created {new Date(token.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedTokenId(selectedTokenId === token.id ? null : token.id)}>
                          <Users className="h-4 w-4 mr-1" />Details
                        </Button>
                        {isAdmin && <Switch checked={token.is_active} onCheckedChange={() => toggleToken(token.id, token.is_active)} />}
                        <Button size="icon" variant="ghost" onClick={() => copyUrl(token.token)}><Copy className="h-4 w-4" /></Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteToken(token.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Usage details */}
                    {selectedTokenId === token.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <h4 className="text-sm font-medium mb-2">Usage History ({count})</h4>
                        {selectedUsage.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No usage recorded yet</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {selectedUsage.map((u) => (
                              <div key={u.id} className="flex items-center justify-between text-xs bg-muted/50 rounded p-2">
                                <div>
                                  <p className="font-mono">{u.user_ip || 'Unknown IP'}</p>
                                  <p className="text-muted-foreground truncate max-w-[200px]">{u.user_agent || 'Unknown device'}</p>
                                </div>
                                <span className="text-muted-foreground whitespace-nowrap ml-2">{new Date(u.used_at).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enable / Disable Token System — at bottom */}
      <Card className={`border-2 ${systemEnabled ? 'border-green-500/40' : 'border-destructive/40'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className={`h-5 w-5 ${systemEnabled ? 'text-green-500' : 'text-destructive'}`} />
            Token System Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {systemEnabled
              ? 'The token system is currently ENABLED. Users must have a valid token to access the video player.'
              : 'The token system is currently DISABLED. All users can access the video player freely without any token.'}
          </p>
          <div className="flex gap-3">
            <Button
              variant={systemEnabled ? 'default' : 'outline'}
              className={systemEnabled ? 'bg-green-600 hover:bg-green-700' : ''}
              onClick={async () => {
                if (systemEnabled) return;
                await supabase.from('unlock_tokens').update({ is_active: true }).eq('token', '__system_toggle__');
                setSystemEnabled(true);
                setSystemEnabled(true);
                toast.success('Token system enabled — users need tokens to watch');
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Enable
            </Button>
            <Button
              variant={!systemEnabled ? 'destructive' : 'outline'}
              onClick={async () => {
                if (!systemEnabled) return;
                await supabase.from('unlock_tokens').update({ is_active: false }).eq('token', '__system_toggle__');
                setSystemEnabled(false);
                setSystemEnabled(false);
                toast.success('Token system disabled — all users have free access');
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Disable
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
