import { memo, useRef } from 'react';
import { Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { PosterCard } from '@/components/anime/PosterCard';
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
        {isPending ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="w-[120px] lg:w-[144px] h-[220px] lg:h-[256px] rounded-md shrink-0" />) : series.map((anime, index) => <AnimeCardContextMenu key={anime.id} animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
          <PosterCard to={`/anime/${anime.id}`} title={anime.title} cover={anime.cover_image} isEngDub={anime.is_eng_dub} isSubOnly={anime.is_sub_only} genres={anime.genres}
            episodes={anime.episode_count} status={anime.status} type="series" year={anime.created_at ? new Date(anime.created_at).getFullYear() : null} />
        </AnimeCardContextMenu>)}
      </div>
    </div>
  </section>;
});
