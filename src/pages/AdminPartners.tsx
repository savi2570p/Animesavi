import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Send, Globe } from 'lucide-react';

interface Partner { id: string; name: string; allowed_domain: string | null; is_active: boolean; last_used_at: string | null; created_at: string; }
interface AnimeLite { id: string; title: string; cover_image: string | null; updated_at: string; }
interface LogRow { anime_id: string; last_fetched_at: string; fetch_count: number; }
interface Resub { anime_id: string; delivered_at: string | null; }

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : 'Never');

export default function AdminPartners() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [anime, setAnime] = useState<AnimeLite[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [resub, setResub] = useState<Resub[]>([]);
  const [filter, setFilter] = useState<'all' | 'missing' | 'fetched' | 'outdated'>('missing');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (!isAdmin) { toast.error('Admin only'); navigate('/'); return; }
    loadPartners();
    supabase.from('anime').select('id,title,cover_image,updated_at').eq('is_muse', false)
      .order('title').limit(2000).then(({ data }) => setAnime((data as any) || []));
    const ch = supabase.channel('partners-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_api_keys' }, loadPartners)
      .subscribe();
    const t = setInterval(loadPartners, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [user, isAdmin]);

  useEffect(() => { if (selected) loadPartnerData(selected); }, [selected]);

  const loadPartners = async () => {
    const { data, error } = await supabase.from('partner_api_keys')
      .select('id,name,allowed_domain,is_active,last_used_at,created_at').order('created_at');
    if (error) return toast.error(error.message);
    setPartners((data as any) || []);
    setSelected((s) => s ?? (data?.[0]?.id || null));
  };

  const loadPartnerData = async (id: string) => {
    const [l, r] = await Promise.all([
      supabase.from('partner_fetch_log').select('anime_id,last_fetched_at,fetch_count').eq('partner_key_id', id),
      supabase.from('partner_resubmissions').select('anime_id,delivered_at').eq('partner_key_id', id),
    ]);
    setLog((l.data as any) || []);
    setResub((r.data as any) || []);
  };

  const toggle = async (p: Partner) => {
    const { error } = await supabase.from('partner_api_keys').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_active ? 'Key switched off' : 'Key switched on');
    loadPartners();
  };

  const resubmit = async (animeIds: string[]) => {
    if (!selected || !animeIds.length) return;
    const { error } = await supabase.from('partner_resubmissions').upsert(
      animeIds.map((anime_id) => ({ partner_key_id: selected, anime_id, requested_at: new Date().toISOString(), delivered_at: null })),
      { onConflict: 'partner_key_id,anime_id' });
    if (error) return toast.error(error.message);
    toast.success(`${animeIds.length} series queued for the next fetch`);
    loadPartnerData(selected);
  };

  const logMap = useMemo(() => new Map(log.map((l) => [l.anime_id, l])), [log]);
  const pendingSet = useMemo(() => new Set(resub.filter((r) => !r.delivered_at).map((r) => r.anime_id)), [resub]);

  const rows = useMemo(() => anime.map((a) => {
    const l = logMap.get(a.id);
    const state = !l ? 'missing' : new Date(a.updated_at) > new Date(l.last_fetched_at) ? 'outdated' : 'fetched';
    return { ...a, l, state };
  }).filter((r) => (filter === 'all' || r.state === filter) && r.title.toLowerCase().includes(q.toLowerCase())),
  [anime, logMap, filter, q]);

  const counts = useMemo(() => {
    let fetched = 0, outdated = 0;
    anime.forEach((a) => { const l = logMap.get(a.id); if (l) new Date(a.updated_at) > new Date(l.last_fetched_at) ? outdated++ : fetched++; });
    return { fetched, outdated, missing: anime.length - fetched - outdated };
  }, [anime, logMap]);

  const current = partners.find((p) => p.id === selected);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">Partners</h1>
        <Badge variant="secondary" className="ml-auto">Live</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {partners.map((p) => (
          <Card key={p.id} onClick={() => setSelected(p.id)}
            className={`cursor-pointer rounded-lg transition ${selected === p.id ? 'ring-2 ring-primary' : ''}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-sm text-muted-foreground truncate">{p.allowed_domain || 'No domain set'}</div>
                <div className="text-xs text-muted-foreground">Last fetch: {fmt(p.last_used_at)}</div>
              </div>
              <Badge variant={p.is_active ? 'default' : 'outline'}>{p.is_active ? 'Active' : 'Off'}</Badge>
              <Switch checked={p.is_active} onClick={(e) => e.stopPropagation()} onCheckedChange={() => toggle(p)} />
            </CardContent>
          </Card>
        ))}
        {!partners.length && <p className="text-muted-foreground">No partners yet.</p>}
      </div>

      {current && (
        <Card className="rounded-lg">
          <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
            <CardTitle className="mr-auto">What {current.name} has fetched</CardTitle>
            <Button size="sm" variant="outline" onClick={() => loadPartnerData(current.id)}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
            <Button size="sm" onClick={() => resubmit(rows.filter((r) => r.state !== 'fetched').map((r) => r.id))}>
              <Send className="h-4 w-4 mr-1" />Resubmit all shown missing/outdated
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['missing', 'outdated', 'fetched', 'all'] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="rounded-lg capitalize" onClick={() => setFilter(f)}>
                  {f}{f !== 'all' ? ` (${counts[f]})` : ` (${anime.length})`}
                </Button>
              ))}
              <Input placeholder="Search series…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs ml-auto" />
            </div>
            <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  {r.cover_image && <img src={r.cover_image} alt="" className="h-12 w-8 rounded object-cover" loading="lazy" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.l ? `Fetched ${r.l.fetch_count}× · last ${fmt(r.l.last_fetched_at)}` : 'Never fetched'}
                    </div>
                  </div>
                  <Badge variant={r.state === 'fetched' ? 'default' : r.state === 'outdated' ? 'secondary' : 'destructive'}>{r.state}</Badge>
                  {pendingSet.has(r.id)
                    ? <Badge variant="outline">Queued</Badge>
                    : <Button size="sm" variant="outline" onClick={() => resubmit([r.id])}>Resubmit</Button>}
                </div>
              ))}
              {!rows.length && <p className="py-6 text-center text-muted-foreground">Nothing here.</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
