import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { DubBadge } from '@/components/anime/DubBadge';
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
        {loading ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="w-[120px] h-[258px] shrink-0 rounded-xl" />) : items.map((item, index) => {
          const url = movies && item.firstEpisodeId ? `/watch/${item.firstEpisodeId}` : `/anime/${item.id}`;
          return <AnimeCardContextMenu key={item.id} animeTitle={item.title} animeUrl={url} coverImage={item.cover_image}>
            <Link to={url} className="group block w-[120px] lg:w-[144px] shrink-0 catalogue-glass rounded-xl overflow-hidden">
              <div className="relative w-full aspect-[2/3] overflow-hidden bg-muted">
                <img src={item.cover_image || '/placeholder.svg'} alt="" aria-hidden className="catalogue-fill perf-blur-fill absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <img src={item.cover_image || '/placeholder.svg'} alt={item.title} className="relative w-full h-full object-contain" loading="lazy" decoding="async" />
                <span className="catalogue-chip absolute top-1.5 left-1.5 text-[9px] font-semibold rounded px-1.5 py-0.5">{finished ? 'DONE' : movies ? 'FILM' : String(index + 1).padStart(2, '0')}</span>
                <TokenCrownBadge />
                <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-7 w-7 text-primary-foreground fill-current opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <div className="px-2 py-2.5 space-y-2">
                <div className="flex flex-wrap items-center gap-1 min-h-4"><DubBadge isEngDub={item.is_eng_dub} isSubOnly={item.is_sub_only} genres={item.genres} /><span className="catalogue-chip text-[9px] px-1 py-0.5 rounded">4K</span></div>
                <h3 className="text-xs font-semibold line-clamp-2 leading-4 h-8">{item.title}</h3>
                <div className="flex items-center justify-between gap-1 text-[9px] text-muted-foreground"><span>{item.release_year || (finished ? 'Rewatch' : movies ? 'Movie' : 'Series')}</span><span className="text-primary">{finished ? 'COM' : '↗'}</span></div>
              </div>
            </Link>
          </AnimeCardContextMenu>;
        })}
      </div>
    </div>
  </section>;
}