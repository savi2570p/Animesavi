import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Key, Copy, Trash2, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Token {
  id: string;
  token: string;
  duration_hours: number;
  is_active: boolean;
  created_at: string;
}

export function TokenManager() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState('24');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    const { data, error } = await supabase
      .from('unlock_tokens')
      .select('*')
      .neq('token', '__system_toggle__')
      .order('created_at', { ascending: false });

    if (data) setTokens(data as Token[]);
    setIsLoading(false);
  };

  const generateToken = async () => {
    setIsGenerating(true);
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('unlock_tokens').insert({
      duration_hours: parseInt(duration),
      created_by: userData.user?.id,
    });

    if (error) {
      toast.error('Failed to generate token');
    } else {
      toast.success('Token generated successfully');
      fetchTokens();
    }
    setIsGenerating(false);
  };

  const toggleToken = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('unlock_tokens')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (!error) {
      setTokens(tokens.map(t => t.id === id ? { ...t, is_active: !isActive } : t));
      toast.success(isActive ? 'Token deactivated' : 'Token activated');
    }
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from('unlock_tokens').delete().eq('id', id);
    if (!error) {
      setTokens(tokens.filter(t => t.id !== id));
      toast.success('Token deleted');
    }
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/verify?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Token URL copied to clipboard');
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    return `${hours / 24}d`;
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Generate Token */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Generate Unlock Token
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="space-y-2 w-full sm:w-48">
              <label className="text-sm text-muted-foreground">Access Duration</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Hour</SelectItem>
                  <SelectItem value="6">6 Hours</SelectItem>
                  <SelectItem value="12">12 Hours</SelectItem>
                  <SelectItem value="24">24 Hours</SelectItem>
                  <SelectItem value="30">30 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateToken} disabled={isGenerating} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Generate Token
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token List */}
      <Card>
        <CardHeader>
          <CardTitle>All Tokens ({tokens.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No tokens generated yet</p>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border ${
                    token.is_active ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {token.is_active ? (
                        <Badge className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(token.duration_hours)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{token.token}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(token.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={token.is_active} onCheckedChange={() => toggleToken(token.id, token.is_active)} />
                    <Button size="icon" variant="ghost" onClick={() => copyUrl(token.token)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteToken(token.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
