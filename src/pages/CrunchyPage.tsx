import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, Eye, Flame, Sparkles, Play, Star, Crown, Layers } from 'lucide-react';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { PlatformCatalogueHeader, PlatformCatalogueCard } from '@/components/layout/PlatformCatalogue';
import { PlatformLoadingScreen } from '@/components/layout/PlatformLoadingScreen';

interface CrunchyAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  status: string | null;
  view_count: number | null;
  episode_count?: number;
  latest_episode_at?: string | null;
}

export default function CrunchyPage() {
  const [animeList, setAnimeList] = useState<CrunchyAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [underProgressAnime, setUnderProgressAnime] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'trending'>('all');

  const formatViewCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  useEffect(() => {
    const fetchCrunchyAnime = async () => {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, type, status, view_count')
        .eq('is_crunchyroll', true as any)
        .order('title');

      const viewCountMap: Record<string, number> = {
        'Your Name': 9500000,
        'Your lie in April': 3400000,
        'The angel next door spoils me rotten': 1200000,
        'The Angel Next Door Spoils me Rotten': 1200000,
        'Mechanical Marie': 977000,
        'Solo Leveling': 730000,
        'BOFURI: I Don\'t Want to Get Hurt, so I\'ll Max Out My Defense.': 2300000,
        'A Gatherer\'s Adventure in Isekai': 267000,
        'Jujutsu Kaisen': 8700000,
        'My Dress-Up Darling': 6200000,
        'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
      };

      if (!error && data) {
        const enriched = await Promise.all(
          data.map(async (anime) => {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('id')
              .eq('anime_id', anime.id);

            const seasonIds = seasonData?.map(s => s.id) || [];

            let episodeCount = 0;
            let latestEpAt: string | null = null;

            if (seasonIds.length > 0) {
              const { count } = await supabase
                .from('episodes')
                .select('id', { count: 'exact', head: true })
                .in('season_id', seasonIds);

              episodeCount = count || 0;

              const { data: latestEp } = await supabase
                .from('episodes')
                .select('created_at')
                .in('season_id', seasonIds)
                .order('created_at', { ascending: false })
                .limit(1);

              latestEpAt = latestEp?.[0]?.created_at || null;
            }

            return {
              ...anime,
              view_count: viewCountMap[anime.title] || Math.floor(Math.random() * (9000000 - 1000000) + 1000000),
              episode_count: episodeCount,
              latest_episode_at: latestEpAt,
            };
          })
        );

        enriched.sort((a, b) => {
          if (a.latest_episode_at && b.latest_episode_at) {
            return new Date(b.latest_episode_at).getTime() - new Date(a.latest_episode_at).getTime();
          }
          if (a.latest_episode_at && !b.latest_episode_at) return -1;
          if (!a.latest_episode_at && b.latest_episode_at) return 1;
          return a.title.localeCompare(b.title);
        });

        setAnimeList(enriched);
      }
      setIsLoading(false);
    };
    fetchCrunchyAnime();
  }, []);

  const handleAnimeClick = (e: React.MouseEvent, anime: CrunchyAnime) => {
    if (anime.episode_count === 0) {
      e.preventDefault();
      setUnderProgressAnime(anime.title);
    }
  };

  const trendingAnime = [...animeList]
    .filter(a => (a.episode_count || 0) > 0)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 8);

  const isNew = (date: string | null | undefined) => {
    if (!date) return false;
    return Date.now() - new Date(date).getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  const filteredList = animeList.filter((a) => {
    if (filter === 'new') return isNew(a.latest_episode_at);
    if (filter === 'trending') return (a.view_count || 0) > 2000000;
    return true;
  });

  const totalEpisodes = animeList.reduce((sum, a) => sum + (a.episode_count || 0), 0);
  const readyCount = animeList.filter(a => (a.episode_count || 0) > 0).length;

  return (
    <div className="min-h-screen">
      {isLoading && <PlatformLoadingScreen platform="crunchy" logo={crunchyrollLogo} />}
      <ContentNavTabs />

      <div className="platform-collection" data-platform="crunchy">
        <div className="container">
          <PlatformCatalogueHeader name="Crunchy" logo={crunchyrollLogo} series={readyCount} episodes={totalEpisodes} />
          <div className="platform-collection-filters" aria-label="Crunchy filters">
            {([{ key: 'all', label: 'All Titles', icon: Layers }, { key: 'trending', label: 'Trending', icon: Flame }, { key: 'new', label: 'New This Week', icon: Sparkles }] as const).map(({ key, label, icon: Icon }) => <Button key={key} variant="glass" aria-pressed={filter === key} onClick={() => setFilter(key)}><Icon className="h-3.5 w-3.5" />{label}</Button>)}
          </div>
          {!isLoading && trendingAnime.length > 0 && filter === 'all' && <section className="platform-collection-section" aria-label="Trending in Crunchy">
            <div className="platform-collection-section-heading"><div className="flex items-center gap-2.5"><Flame className="platform-collection-tone h-5 w-5" /><h2>Trending in Crunchy</h2></div><span className="text-xs text-muted-foreground">Top {trendingAnime.length}</span></div>
            <div className="platform-collection-row snap-row">
              {trendingAnime.map((anime, index) => <PlatformCatalogueCard key={anime.id} anime={anime} rank={index + 1} views={formatViewCount(anime.view_count || 0)} onClick={(event) => handleAnimeClick(event, anime)} />)}
            </div>
          </section>}
          <section className="platform-collection-section" aria-label="Crunchy library">
            <div className="platform-collection-section-heading"><div className="flex items-center gap-2.5"><Layers className="platform-collection-tone h-5 w-5" /><h2>{filter === 'all' ? 'Full Library' : filter === 'new' ? 'Fresh Releases' : 'Most Watched'}</h2></div><span className="text-xs text-muted-foreground">{filteredList.length} titles</span></div>
            {isLoading ? <div className="platform-collection-grid">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-[258px] rounded-lg" />)}</div> : filteredList.length === 0 ? <div className="platform-collection-empty"><img src={crunchyrollLogo} alt="" className="h-12 w-12 object-contain mx-auto mb-4" /><h3 className="font-semibold">Nothing here yet</h3><p className="text-sm text-muted-foreground mt-2">Check back soon for more titles.</p></div> : <div className="platform-collection-grid">
              {filteredList.map((anime) => <PlatformCatalogueCard key={anime.id} anime={anime} fresh={isNew(anime.latest_episode_at)} views={formatViewCount(anime.view_count || 0)} onClick={(event) => handleAnimeClick(event, anime)} />)}
            </div>}
          </section>
        </div>
      </div>

      {/* Under Progress Popup */}
      <Dialog open={!!underProgressAnime} onOpenChange={(open) => !open && setUnderProgressAnime(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-center">Under Progress</DialogTitle>
            <DialogDescription className="text-center text-sm pt-2">
              <span className="font-semibold text-foreground">{underProgressAnime}</span> is still being prepared for the Crunchy tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {[
              { icon: '📦', title: 'Episode sync in progress', desc: 'Season entries are ready, but the first episode files are still being linked.' },
              { icon: '🎧', title: 'Audio + E-sub QA', desc: 'Multi-audio tracks, English subtitles and CC support are being checked.' },
              { icon: '✨', title: 'Final watch-page review', desc: 'Posters, playback quality and player controls are being verified before release.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/40 p-3">
                <span className="text-base leading-none">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground text-center">
              This title will open automatically once the first Crunchy episode pack is ready.
            </p>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="default" className="anime-button w-full" onClick={() => setUnderProgressAnime(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
