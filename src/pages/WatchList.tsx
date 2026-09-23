import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Play, Trash2, ListVideo, Search, SortAsc, SortDesc,
  Layers, Sparkles, ArrowRight, Clock,
} from 'lucide-react';
import { DubBadge } from '@/components/anime/DubBadge';

interface WatchListItem {
  id: string;
  episode_id: string;
  created_at: string;
  animeId?: string;
  animeTitle?: string;
  coverImage?: string | null;
  totalSeasons?: number;
  isEngDub?: boolean;
  isSubOnly?: boolean;
}

type SortMode = 'recent' | 'oldest' | 'title';

export default function WatchList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchWatchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchWatchList = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('watch_later')
      .select(`
        id, episode_id, created_at,
        episodes!watch_later_episode_id_fkey (
          id,
          seasons!episodes_season_id_fkey (
            season_number,
            anime!seasons_anime_id_fkey ( id, title, cover_image, is_eng_dub, is_sub_only )
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const map = new Map<string, WatchListItem>();
      for (const item of data as any[]) {
        const anime = item.episodes?.seasons?.anime;
        if (!anime || map.has(anime.id)) continue;
        const { count } = await supabase
          .from('seasons')
          .select('id', { count: 'exact', head: true })
          .eq('anime_id', anime.id);
        map.set(anime.id, {
          id: item.id,
          episode_id: item.episode_id,
          created_at: item.created_at,
          animeId: anime.id,
          animeTitle: anime.title,
          coverImage: anime.cover_image,
          totalSeasons: count || 1,
          isEngDub: !!anime.is_eng_dub,
          isSubOnly: !!anime.is_sub_only,
        });
      }
      setItems(Array.from(map.values()));
    }
    setIsLoading(false);
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('watch_later').delete().eq('id', id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Removed from Watch List');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? items.filter(i => (i.animeTitle || '').toLowerCase().includes(q)) : items;
    if (sort === 'oldest') list = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sort === 'title') list = [...list].sort((a, b) => (a.animeTitle || '').localeCompare(b.animeTitle || ''));
    else list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [items, query, sort]);

  if (!user) return null;

  const totalSeasons = items.reduce((acc, i) => acc + (i.totalSeasons || 0), 0);

  return (
    <div className="relative min-h-screen">
      {/* Cinematic backdrop using top items */}
      <div className="absolute inset-x-0 top-0 h-[340px] overflow-hidden pointer-events-none">
        <div className="absolute inset-0 grid grid-cols-6 opacity-20">
          {items.slice(0, 12).map((it, i) => (
            <img key={i} src={it.coverImage || '/placeholder.svg'} alt="" className="w-full h-full object-cover" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
      </div>

      <div className="relative container max-w-6xl py-8">
        {/* Hero header */}
        <div className="rounded-3xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 sm:p-8 mb-8 overflow-hidden relative">
          <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 mb-3">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Your Library</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Watch&nbsp;<span className="bg-gradient-to-r from-primary via-rose-400 to-fuchsia-500 bg-clip-text text-transparent">List</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Every anime you saved for later — search, sort and jump straight back into the next episode.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:min-w-[280px]">
              <div className="text-center px-3 py-3 rounded-xl bg-background/40 border border-border/40">
                <div className="text-2xl font-extrabold text-primary tabular-nums">{items.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Saved</div>
              </div>
              <div className="text-center px-3 py-3 rounded-xl bg-background/40 border border-border/40">
                <div className="text-2xl font-extrabold text-sky-400 tabular-nums">{totalSeasons}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Seasons</div>
              </div>
              <div className="text-center px-3 py-3 rounded-xl bg-background/40 border border-border/40">
                <div className="text-2xl font-extrabold text-emerald-400">∞</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Free</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search your watch list…"
              className="pl-9 h-11 rounded-xl bg-card/60 border-border/50"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-card/60 border border-border/50 p-1">
            {([
              { v: 'recent', label: 'Recent', icon: SortDesc },
              { v: 'oldest', label: 'Oldest', icon: SortAsc },
              { v: 'title', label: 'A–Z', icon: Layers },
            ] as { v: SortMode; label: string; icon: any }[]).map(opt => (
              <button
                key={opt.v}
                onClick={() => setSort(opt.v)}
                className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-colors ${
                  sort === opt.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/40 skeleton-shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 rounded-3xl border border-dashed border-border/40 bg-card/30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ListVideo className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {items.length === 0 ? 'Your Watch List is empty' : 'No matches'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {items.length === 0
                ? 'Tap the bookmark icon on any anime detail page to save it here for later.'
                : 'Try a different search term or clear the filter.'}
            </p>
            <Button asChild>
              <Link to="/browse"><Play className="h-4 w-4 mr-2 fill-current" /> Browse Anime</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(item => {
              const img = item.coverImage || '/placeholder.svg';
              return (
                <div
                  key={item.id}
                  className="group relative rounded-2xl overflow-hidden border border-border/40 bg-card/50 transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20"
                >
                  <Link to={`/anime/${item.animeId}`} className="block">
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img
                        src={img}
                        alt={item.animeTitle}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      <span className="absolute top-2 right-2"><DubBadge isEngDub={(item as any).isEngDub} isSubOnly={(item as any).isSubOnly} /></span>
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/70 backdrop-blur text-[9px] font-bold uppercase tracking-wider">
                        <Layers className="h-2.5 w-2.5 text-primary" />
                        {item.totalSeasons}S
                      </span>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="p-3.5 rounded-full bg-primary/95 shadow-xl shadow-primary/40">
                          <Play className="w-5 h-5 text-primary-foreground fill-current" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                        <h3 className="text-sm font-bold text-white line-clamp-2 drop-shadow-lg">
                          {item.animeTitle}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-white/70">
                          <Clock className="h-2.5 w-2.5" />
                          Added {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 p-2">
                    <Button asChild size="sm" className="flex-1 h-8 text-xs rounded-lg">
                      <Link to={`/anime/${item.animeId}`}>
                        Continue <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
