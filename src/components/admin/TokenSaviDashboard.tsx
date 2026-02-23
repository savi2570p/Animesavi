import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Key, Copy, Clock, CheckCircle, XCircle, Users, Power, Link2, RefreshCw, Edit2, Save } from 'lucide-react';
import { fetchTokenSystemStatus, isSuperAdmin } from '@/components/AccessBanner';

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
  const { user, isAdmin } = useAuth();
  const canManage = isAdmin || isSuperAdmin(user?.email);
  const [unlockToken, setUnlockToken] = useState<Token | null>(null);
  const [usage, setUsage] = useState<TokenUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [showUsage, setShowUsage] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  useEffect(() => {
    fetchData();
    fetchTokenSystemStatus().then(setSystemEnabled);
  }, []);

  const fetchData = async () => {
    const [tokensRes, usageRes] = await Promise.all([
      supabase
        .from('unlock_tokens')
        .select('*')
        .neq('token', '__system_toggle__')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('token_usage').select('*').order('used_at', { ascending: false }),
    ]);

    if (tokensRes.data && tokensRes.data.length > 0) {
      setUnlockToken(tokensRes.data[0] as Token);
    }
    if (usageRes.data) setUsage(usageRes.data as TokenUsage[]);
    setIsLoading(false);
  };

  const createUnlockToken = async () => {
    if (!canManage) return;
    const { data: userData } = await supabase.auth.getUser();

    // Delete all existing non-system tokens first (enforce single token)
    await supabase.from('unlock_tokens').delete().neq('token', '__system_toggle__');

    const { error } = await supabase.from('unlock_tokens').insert({
      duration_hours: 24,
      created_by: userData.user?.id,
      is_active: true,
    });

    if (error) {
      toast.error('Failed to create unlock token');
    } else {
      toast.success('Unlock token created');
      fetchData();
    }
  };

  const regenerateToken = async () => {
    if (!canManage || !unlockToken) return;

    // Delete existing and create new
    await supabase.from('unlock_tokens').delete().eq('id', unlockToken.id);

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('unlock_tokens').insert({
      duration_hours: 24,
      created_by: userData.user?.id,
      is_active: true,
    });

    if (error) {
      toast.error('Failed to regenerate token');
    } else {
      toast.success('Token regenerated with new slug');
      fetchData();
    }
  };

  const toggleTokenActive = async () => {
    if (!canManage || !unlockToken) return;
    const newActive = !unlockToken.is_active;
    const { error } = await supabase
      .from('unlock_tokens')
      .update({ is_active: newActive })
      .eq('id', unlockToken.id);
    if (!error) {
      setUnlockToken({ ...unlockToken, is_active: newActive });
      toast.success(newActive ? 'Unlock link activated' : 'Unlock link deactivated');
    }
  };

  const saveNewSlug = async () => {
    if (!canManage || !unlockToken || !newSlug.trim()) return;
    setIsSavingSlug(true);

    const slug = newSlug.trim();

    // Check that it's not __system_toggle__
    if (slug === '__system_toggle__') {
      toast.error('Reserved slug name');
      setIsSavingSlug(false);
      return;
    }

    const { error } = await supabase
      .from('unlock_tokens')
      .update({ token: slug })
      .eq('id', unlockToken.id);

    if (error) {
      toast.error('Failed to update slug');
    } else {
      setUnlockToken({ ...unlockToken, token: slug });
      setIsEditingSlug(false);
      toast.success('Slug updated');
    }
    setIsSavingSlug(false);
  };

  const getUnlockUrl = () => {
    if (!unlockToken) return '';
    return `${window.location.origin}/unlock/${unlockToken.token}`;
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getUnlockUrl());
    toast.success('Unlock URL copied to clipboard');
  };

  const tokenUsage = unlockToken ? usage.filter(u => u.token_id === unlockToken.id) : [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{unlockToken ? '1' : '0'}</p>
            <p className="text-xs text-muted-foreground">Unlock Token</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">
              {unlockToken?.is_active ? 'Active' : 'Inactive'}
            </p>
            <p className="text-xs text-muted-foreground">Status</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{tokenUsage.length}</p>
            <p className="text-xs text-muted-foreground">Total Uses</p>
          </CardContent>
        </Card>
      </div>

      {/* Unlock URL Management */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Unlock URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!unlockToken ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-muted-foreground">No unlock token exists yet.</p>
              {canManage && (
                <Button onClick={createUnlockToken} className="bg-primary hover:bg-primary/90">
                  <Key className="h-4 w-4 mr-2" />
                  Create Unlock Token
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* URL Display & Copy */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <label className="text-xs text-muted-foreground mb-1 block">Current Unlock URL</label>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono flex-1 truncate text-foreground">
                    {getUnlockUrl()}
                  </code>
                  <Button size="icon" variant="ghost" onClick={copyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Token Slug */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <label className="text-xs text-muted-foreground mb-1 block">Token Slug</label>
                {isEditingSlug ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="Enter new slug..."
                      className="font-mono text-sm"
                    />
                    <Button size="sm" onClick={saveNewSlug} disabled={isSavingSlug || !newSlug.trim()}>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingSlug(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono flex-1 truncate text-foreground">
                      {unlockToken.token}
                    </code>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNewSlug(unlockToken.token);
                          setIsEditingSlug(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Active:</span>
                  <Switch checked={unlockToken.is_active} onCheckedChange={toggleTokenActive} />
                </div>
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  24h per visit
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Created {new Date(unlockToken.created_at).toLocaleDateString()}
                </Badge>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={regenerateToken}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                )}
              </div>

              {/* Usage History removed */}
            </>
          )}
        </CardContent>
      </Card>

      {/* Enable / Disable Token System */}
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
              ? 'The token system is currently ENABLED. Users must visit the unlock link to get 24-hour access.'
              : 'The token system is currently DISABLED. All users can access the video player freely.'}
          </p>
          <div className="flex gap-3">
            <Button
              variant={systemEnabled ? 'default' : 'outline'}
              className={systemEnabled ? 'bg-green-600 hover:bg-green-700' : ''}
              onClick={async () => {
                if (systemEnabled) return;
                await supabase
                  .from('unlock_tokens')
                  .update({ is_active: true })
                  .eq('token', '__system_toggle__');
                setSystemEnabled(true);
                toast.success('Token system enabled — users need the unlock link to watch');
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Enable
            </Button>
            <Button
              variant={!systemEnabled ? 'destructive' : 'outline'}
              onClick={async () => {
                if (!systemEnabled) return;
                await supabase
                  .from('unlock_tokens')
                  .update({ is_active: false })
                  .eq('token', '__system_toggle__');
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
