import { Film, Layers, Sparkles } from 'lucide-react';
import { PosterCard } from '@/components/anime/PosterCard';

export function PlatformCatalogueHeader({ name, logo, series, episodes }: {
  name: string; logo: string; series: number; episodes: number;
}) {
  return <header className="platform-collection-header">
    <div className="platform-collection-brand">
      <img src={logo} alt={name} width={72} height={72} />
      <div><p className="platform-collection-kicker">AnimeSavi / Platforms</p><h1>{name}</h1><p className="text-sm text-muted-foreground">Hindi-dubbed anime collection</p></div>
    </div>
    <dl className="platform-collection-stats">
      <div><dt><Layers />Series</dt><dd>{series}</dd></div>
      <div><dt><Film />Episodes</dt><dd>{episodes}</dd></div>
      <div><dt><Sparkles />Quality</dt><dd>4K</dd></div>
    </dl>
  </header>;
}

interface PlatformCatalogueItem {
  id: string; title: string; cover_image: string | null; type: string | null;
  episode_count?: number; view_count: number | null;
}

export function PlatformCatalogueCard({ anime, rank, fresh = false, views, onClick }: {
  anime: PlatformCatalogueItem; rank?: number; fresh?: boolean; views: string;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return <PosterCard to={`/anime/${anime.id}`} onClick={onClick} title={anime.title} cover={anime.cover_image}
    tag={rank ? String(rank).padStart(2, '0') : fresh ? 'NEW' : null} episodes={anime.episode_count ?? 0} views={views}
    type={anime.type} pending={anime.episode_count === 0} className="scroll-snap-start" />;
}
