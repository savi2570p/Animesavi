import { memo, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Play, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { DubBadge } from '@/components/anime/DubBadge';
import { useHomeCatalogue } from '@/hooks/useHomeCatalogue';
import { CatalogueHeading } from './CatalogueHeading';

interface GroupedEpisode {
  animeId: string; animeTitle: string; seasonNumber: number; coverImage: string | null;
  thumbnail: string | null; episodeMin: number; episodeMax: number; episodeCount: number;
  latestEpisodeId: string; latestCreatedAt: string; status: string | null;
  isEngDub?: boolean | null; isSubOnly?: boolean | null; genres?: string[] | null;
}
export const LatestEpisodes = memo(function LatestEpisodes() {
  const rowRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isError, refetch } = useHomeCatalogue();
  const episodes = useMemo(() => data?.episodes ?? [], [data]);
  const groupedEpisodes = useMemo<GroupedEpisode[]>(() => {
    const groups = new Map<string, GroupedEpisode>();
    for (const ep of episodes) {
      if (!ep.season?.anime) continue;
      const key = `${ep.season.anime.id}-${ep.season.season_number}`;
      const existing = groups.get(key);
      if (existing) {
        existing.episodeMin = Math.min(existing.episodeMin, ep.episode_number);
        existing.episodeMax = Math.max(existing.episodeMax, ep.episode_number);
        existing.episodeCount++;
        if (new Date(ep.created_at) > new Date(existing.latestCreatedAt)) {
          existing.latestEpisodeId = ep.id;
          existing.latestCreatedAt = ep.created_at;
          existing.thumbnail = ep.thumbnail || existing.thumbnail;
        }
      } else {
        groups.set(key, {
          animeId: ep.season.anime.id,
          animeTitle: ep.season.anime.title,
          seasonNumber: ep.season.season_number,
          coverImage: ep.season.anime.cover_image,
          thumbnail: ep.thumbnail,
          episodeMin: ep.episode_number,
          episodeMax: ep.episode_number,
          episodeCount: 1,
          latestEpisodeId: ep.id,
          latestCreatedAt: ep.created_at,
          status: ep.season.anime.status,
          isEngDub: ep.season.anime.is_eng_dub ?? false,
          isSubOnly: ep.season.anime.is_sub_only ?? false,
          genres: ep.season.anime.genres,
        });
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime())
      .slice(0, 8);
  }, [episodes]);


  const timeAgo = (date: string) => {
    const hours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3600000));
    return hours < 1 ? 'Just added' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  };
  return <section className="catalogue-section py-6 md:py-9" aria-label="Latest Episodes">
    <div className="container">
      <CatalogueHeading title="Latest Episodes" eyebrow="Fresh releases" icon={Zap} href="/latest-episodes" rowRef={rowRef} />
      {isError && <div className="text-sm text-muted-foreground">Unable to load episodes. <Button variant="ghost" size="sm" onClick={() => refetch()}>Retry</Button></div>}
      <div ref={rowRef} className="flex gap-4 overflow-x-auto snap-row pb-4 pt-1">
        {isPending ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="w-[260px] h-[228px] shrink-0 rounded-xl" />) : groupedEpisodes.map(group => <AnimeCardContextMenu key={`${group.animeId}-${group.seasonNumber}`} animeTitle={group.animeTitle} animeUrl={`/watch/${group.latestEpisodeId}`} coverImage={group.thumbnail || group.coverImage}>
          <Link to={`/watch/${group.latestEpisodeId}`} className="group block w-[260px] md:w-[300px] shrink-0 catalogue-glass rounded-xl overflow-hidden">
            <div className="relative aspect-video overflow-hidden bg-muted">
              <img src={group.thumbnail || group.coverImage || '/placeholder.svg'} alt={group.animeTitle} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <div className="absolute inset-0 catalogue-image-scrim pointer-events-none" />
              <div className="absolute top-2 left-2 catalogue-chip rounded px-2 py-1 text-[10px] font-semibold">Season {group.seasonNumber}</div>
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-1"><DubBadge isEngDub={group.isEngDub} isSubOnly={group.isSubOnly} genres={group.genres} /><span className="catalogue-chip rounded px-1.5 py-0.5 text-[9px]">4K</span></div>
              <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary-foreground fill-current opacity-0 group-hover:opacity-100 transition-opacity" />
              <TokenCrownBadge />
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold line-clamp-1">{group.animeTitle}</h3>
              <div className="flex justify-between items-center mt-2 gap-2 text-[10px]"><span className="text-primary font-semibold">{group.episodeMin === group.episodeMax ? `Episode ${group.episodeMin}` : `Episodes ${group.episodeMin}–${group.episodeMax}`}</span><span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{timeAgo(group.latestCreatedAt)}</span></div>
            </div>
          </Link>
        </AnimeCardContextMenu>)}
      </div>
    </div>
  </section>;
});
