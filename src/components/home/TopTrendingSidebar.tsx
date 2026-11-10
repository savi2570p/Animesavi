import { memo, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { DubBadge } from '@/components/anime/DubBadge';
import { getViewCount, formatViews } from '@/lib/viewCount';

interface TrendingItem {
  id: string;
  title: string;
  cover_image: string | null;
  banner_image: string | null;
  type: string | null;
  view_count: number | null;
  total_episodes: number | null;
  genres: string[] | null;
  is_eng_dub: boolean | null;
  is_sub_only: boolean | null;
}

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'sub', label: 'Sub' },
] as const;
type TabId = typeof TABS[number]['id'];
const FIELDS = 'id, title, cover_image, banner_image, type, view_count, total_episodes, genres, is_eng_dub, is_sub_only';

/** Ranked "Top Trending" list for the homepage sidebar, ordered by views. */
export const TopTrendingSidebar = memo(function TopTrendingSidebar() {
  const [tab, setTab] = useState<TabId>('all');
  const { data, isPending: loading } = useQuery({
    queryKey: ['home-top-trending'],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Admin-curated list wins; an empty list falls back to ranking by views.
      const { data: lineup } = await supabase
        .from('top_trending_lineup')
        .select(`position, custom_title, custom_cover_url, custom_banner_url, anime:anime_id (${FIELDS})`)
        .eq('is_active', true)
        .order('position', { ascending: true });
      const curated = ((lineup || []) as unknown as { custom_title: string | null; custom_cover_url: string | null; custom_banner_url: string | null; anime: TrendingItem | null }[])
        .filter(r => r.anime)
        .map(r => ({
          ...r.anime!,
          title: r.custom_title || r.anime!.title,
          cover_image: r.custom_cover_url || r.anime!.cover_image,
          banner_image: r.custom_banner_url || r.anime!.banner_image,
        }));
      if (curated.length) return { curated: true, items: curated };
      const { data: ranked } = await supabase.from('anime').select(FIELDS).order('view_count', { ascending: false }).limit(60);
      return { curated: false, items: (ranked as TrendingItem[]) || [] };
    },
  });
  const items = data?.items ?? [];

  const ranked = useMemo(() => {
    const filtered = items.filter(a =>
      tab === 'all' ? true : tab === 'sub' ? a.is_sub_only : !a.is_sub_only && !a.is_eng_dub);
    const withViews = filtered.map(a => ({ ...a, views: getViewCount(a.title, a.view_count) }));
    // Curated lists keep the admin's order; automatic lists rank by views.
    return (data?.curated ? withViews : withViews.sort((a, b) => b.views - a.views)).slice(0, 10);
  }, [items, tab, data?.curated]);

  return (
    <section className="top-trending p-3 md:p-4" aria-labelledby="top-trending-title">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="top-trending-title" className="font-heading font-bold text-lg">Top Trending</h2>
        <div className="flex items-center gap-3" role="tablist">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`top-trending-tab text-[10px] font-bold uppercase tracking-wider ${tab === t.id ? 'is-active' : ''}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <ol className="space-y-2">
        {loading && Array.from({ length: 6 }).map((_, i) => <li key={i}><Skeleton className="h-[72px] w-full rounded-md" /></li>)}
        {!loading && ranked.map((a, i) => (
          <li key={a.id}>
            <Link to={`/anime/${a.id}`} className="top-trending-item relative flex items-center gap-3 overflow-hidden px-3 py-2.5">
              {(a.banner_image || a.cover_image) && (
                <img src={a.banner_image || a.cover_image!} alt="" aria-hidden loading="lazy" className="top-trending-art absolute inset-0 h-full w-full object-cover" />
              )}
              <span className="top-trending-rank relative w-7 shrink-0 text-center font-heading text-2xl font-extrabold italic">{i + 1}</span>
              <div className="relative min-w-0 flex-1">
                <p className="top-trending-title truncate text-sm font-semibold">{a.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-primary"><Eye className="h-3 w-3" />{formatViews(a.views)}</span>
                  {a.type && <span className="uppercase">{a.type}</span>}
                  {a.total_episodes ? <span>{a.total_episodes} EP</span> : null}
                  <DubBadge isEngDub={a.is_eng_dub} isSubOnly={a.is_sub_only} genres={a.genres} />
                </div>
              </div>
            </Link>
          </li>
        ))}
        {!loading && ranked.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">Nothing here yet.</li>}
      </ol>
    </section>
  );
});
