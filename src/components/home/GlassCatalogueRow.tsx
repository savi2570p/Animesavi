import { useRef } from 'react';
import { type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { PosterCard } from '@/components/anime/PosterCard';
import { CatalogueHeading } from './CatalogueHeading';

export interface GlassCatalogueItem {
  id: string;
  title: string;
  cover_image: string | null;
  release_year?: number | null;
  genres?: string[] | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
  firstEpisodeId?: string | null;
}

export function GlassCatalogueRow({ title, eyebrow, href, icon, items, loading, movies = false, finished = false }: {
  title: string; eyebrow: string; href: string; icon: LucideIcon;
  items: GlassCatalogueItem[]; loading: boolean; movies?: boolean; finished?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  if (!loading && !items.length) return null;
  return <section className="catalogue-section py-6 md:py-9" aria-label={title}>
    <div className="container">
      <CatalogueHeading title={title} eyebrow={eyebrow} href={href} icon={icon} rowRef={rowRef} />
      <div ref={rowRef} className="flex gap-3 overflow-x-auto snap-row pb-4 pt-1">
        {loading ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="w-[120px] lg:w-[144px] h-[220px] lg:h-[256px] shrink-0 rounded-md" />) : items.map((item, index) => {
          const url = movies && item.firstEpisodeId ? `/watch/${item.firstEpisodeId}` : `/anime/${item.id}`;
          return <AnimeCardContextMenu key={item.id} animeTitle={item.title} animeUrl={url} coverImage={item.cover_image}>
            <PosterCard to={url} title={item.title} cover={item.cover_image} isEngDub={item.is_eng_dub} isSubOnly={item.is_sub_only} genres={item.genres}
              type={movies ? 'movie' : 'series'} year={item.release_year} tag={finished ? 'DONE' : null} />
          </AnimeCardContextMenu>;
        })}
      </div>
    </div>
  </section>;
}