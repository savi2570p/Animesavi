import { memo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Tv, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { DubBadge } from '@/components/anime/DubBadge';
import { useHomeCatalogue } from '@/hooks/useHomeCatalogue';
import { CatalogueHeading } from './CatalogueHeading';

export const LatestSeries = memo(function LatestSeries() {
  const rowRef = useRef<HTMLDivElement>(null);
  const { data, isPending, isError, refetch } = useHomeCatalogue();
  const series = data?.series ?? [];
  return <section className="catalogue-section py-6 md:py-9" aria-label="Latest Series">
    <div className="container">
      <CatalogueHeading title="Latest Series" eyebrow="The latest chapter" icon={Tv} href="/latest-series" rowRef={rowRef} />
      {isError && <div className="text-sm text-muted-foreground">Unable to load series. <Button variant="ghost" size="sm" onClick={() => refetch()}>Retry</Button></div>}
      <div ref={rowRef} className="flex gap-3 overflow-x-auto snap-row pb-4 pt-1">
        {isPending ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="w-[120px] h-[242px] rounded-xl shrink-0" />) : series.map((anime, index) => <AnimeCardContextMenu key={anime.id} animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
          <Link to={`/anime/${anime.id}`} className="group block w-[120px] shrink-0 catalogue-glass rounded-xl overflow-hidden">
            <div className="relative w-[120px] h-[180px] overflow-hidden">
              <img src={anime.cover_image || '/placeholder.svg'} alt="" aria-hidden className="catalogue-fill perf-blur-fill absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <img src={anime.cover_image || '/placeholder.svg'} alt={anime.title} className="relative w-full h-full object-contain" loading="lazy" decoding="async" />
              <span className="catalogue-chip absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded">{String(index + 1).padStart(2, '0')}</span>
              <div className="absolute bottom-1.5 inset-x-1.5 flex flex-wrap items-center gap-1"><DubBadge isEngDub={anime.is_eng_dub} isSubOnly={anime.is_sub_only} genres={anime.genres} /><span className="catalogue-chip text-[9px] px-1 py-0.5 rounded">4K</span></div>
              <TokenCrownBadge />
              <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-7 w-7 text-primary-foreground fill-current opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <div className="px-2 py-2.5">
              <h3 className="text-xs font-semibold line-clamp-2 leading-4 h-8">{anime.title}</h3>
              <div className="flex justify-between gap-1 mt-2 text-[9px] text-muted-foreground"><span>{anime.episode_count} episodes</span><span className="text-primary">{anime.status === 'completed' ? 'COM' : anime.status === 'ongoing' ? 'OG' : ''}</span></div>
            </div>
          </Link>
        </AnimeCardContextMenu>)}
      </div>
    </div>
  </section>;
});
