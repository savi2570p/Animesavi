import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Save, RefreshCw, ExternalLink } from 'lucide-react';

interface AnimeLite {
  id: string;
  title: string;
  cover_image: string | null;
  banner_image: string | null;
}

interface LineupRow {
  id: string;
  anime_id: string;
  position: number;
  custom_title: string | null;
  custom_cover_url: string | null;
  custom_banner_url: string | null;
  is_active: boolean;
  anime: AnimeLite | null;
}

export default function AdminFeaturedLineup() {
  const { user, isAdmin, isLoading, isRolesLoaded } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const trending = params.get('banner') === 'trending';
  const table = trending ? 'trending_banner_lineup' : 'featured_hero_lineup';
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AnimeLite[]>([]);

  useEffect(() => {
    if (isLoading || !isRolesLoaded) return;
    if (!user) { navigate('/auth'); return; }
    if (!isAdmin) { toast.error('Admin only'); navigate('/'); return; }
    load();
  }, [user, isAdmin, table, isLoading, isRolesLoaded]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select('id, anime_id, position, custom_title, custom_cover_url, custom_banner_url, is_active, anime:anime_id (id, title, cover_image, banner_image)')
      .order('position', { ascending: true });
    if (error) { toast.error(error.message); }
    setRows((data as any) || []);
    setLoading(false);
  };

  const existingIds = useMemo(() => new Set(rows.map(r => r.anime_id)), [rows]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('anime')
        .select('id, title, cover_image, banner_image')
        .ilike('title', `%${q}%`)
        .limit(8);
      setSearchResults((data || []).filter(a => !existingIds.has(a.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [search, existingIds]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next.map((r, i) => ({ ...r, position: i + 1 })));
  };

  const patch = (id: string, changes: Partial<LineupRow>) =>
    setRows(rows.map(r => r.id === id ? { ...r, ...changes } : r));

  const remove = async (id: string) => {
    if (!confirm(`Remove this anime from the ${trending ? 'trending' : 'hero'} lineup?`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Removed');
    setRows(rows.filter(r => r.id !== id));
    void queryClient.invalidateQueries({ queryKey: ['home-trending-v2'] });
  };

  const add = async (a: AnimeLite) => {
    const nextPos = (rows[rows.length - 1]?.position || 0) + 1;
    const { data, error } = await supabase
      .from(table)
      .insert({ anime_id: a.id, position: nextPos, is_active: true })
      .select('id, anime_id, position, custom_title, custom_cover_url, custom_banner_url, is_active, anime:anime_id (id, title, cover_image, banner_image)')
      .single();
    if (error) return toast.error(error.message);
    setRows([...rows, data as any]);
    setSearch('');
    setSearchResults([]);
    toast.success(`Added ${a.title}`);
    void queryClient.invalidateQueries({ queryKey: ['home-trending-v2'] });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const r of rows) {
        const { error } = await supabase
          .from(table)
          .update({
            position: r.position,
            custom_title: r.custom_title || null,
            custom_cover_url: r.custom_cover_url || null,
            custom_banner_url: r.custom_banner_url || null,
            is_active: r.is_active,
          })
          .eq('id', r.id);
        if (error) throw error;
      }
      toast.success('Lineup saved');
      void queryClient.invalidateQueries({ queryKey: ['home-trending-v2'] });
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-2xl md:text-3xl font-bold">{trending ? 'Trending Now Lineup' : 'Featured Hero Lineup'}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Reload
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save all'}
          </Button>
        </div>

        <Tabs value={trending ? 'trending' : 'hero'} onValueChange={value => { setRows([]); setSearch(''); setParams(value === 'trending' ? { banner: 'trending' } : {}); }}>
          <TabsList><TabsTrigger value="hero">Hero banner</TabsTrigger><TabsTrigger value="trending">Trending Now</TabsTrigger></TabsList>
        </Tabs>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add anime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search anime by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchResults.map(a => (
                  <Button variant="ghost"
                    key={a.id}
                    onClick={() => add(a)}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-accent text-left"
                  >
                    {a.cover_image && <img src={a.cover_image} alt="" className="h-10 w-8 object-contain rounded" />}
                    <span className="flex-1 truncate text-sm">{a.title}</span>
                    <Plus className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No lineup yet — add anime above.</p>
          )}
          {rows.map((r, idx) => (
            <Card key={r.id} className={r.is_active ? '' : 'opacity-60'}>
              <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                <div className="flex md:flex-col gap-1 items-center justify-center">
                  <Badge variant="secondary">#{idx + 1}</Badge>
                  <div className="flex md:flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <img
                  src={r.custom_cover_url || r.anime?.cover_image || ''}
                  alt=""
                  className="h-28 w-20 object-contain rounded-lg bg-muted flex-shrink-0"
                />

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{r.anime?.title || '(missing anime)'}</div>
                    <a
                      href={`/anime/${r.anime_id}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      placeholder="Title override (optional)"
                      value={r.custom_title || ''}
                      onChange={(e) => patch(r.id, { custom_title: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.is_active}
                        onChange={(e) => patch(r.id, { is_active: e.target.checked })}
                      />
                      Show in slider
                    </label>
                    <Input
                      placeholder="Cover image URL override"
                      value={r.custom_cover_url || ''}
                      onChange={(e) => patch(r.id, { custom_cover_url: e.target.value })}
                    />
                    <Input
                      placeholder="Banner image URL override"
                      value={r.custom_banner_url || ''}
                      onChange={(e) => patch(r.id, { custom_banner_url: e.target.value })}
                    />
                  </div>
                </div>

                <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
