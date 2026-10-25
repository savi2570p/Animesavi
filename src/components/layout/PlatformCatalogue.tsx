import { Link } from 'react-router-dom';
import { Eye, Film, Layers, Play, Sparkles } from 'lucide-react';
import { DubBadge } from '@/components/anime/DubBadge';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';

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
  return <Link to={`/anime/${anime.id}`} onClick={onClick} className="platform-collection-card group">
    <div className="platform-collection-artwork">
      <img src={anime.cover_image || '/placeholder.svg'} alt="" aria-hidden="true" loading="lazy" className="catalogue-fill perf-blur-fill absolute inset-0 h-full w-full object-cover" />
      <img src={anime.cover_image || '/placeholder.svg'} alt={anime.title} loading="lazy" decoding="async" className="relative h-full w-full object-contain" />
      <span className="platform-collection-art-tag">{rank ? String(rank).padStart(2, '0') : fresh ? 'NEW' : anime.type === 'movie' ? 'FILM' : 'SERIES'}</span>
      {anime.episode_count === 0 ? <div className="platform-collection-pending"><span>Under Progress</span></div> : <span className="platform-collection-play"><Play className="h-5 w-5 fill-current" /></span>}
      <TokenCrownBadge />
    </div>
    <div className="platform-collection-card-info">
      <div className="flex items-center gap-1.5"><DubBadge /><span className="platform-collection-quality">4K</span></div>
      <h3>{anime.title}</h3>
      <div className="platform-collection-card-meta"><span><Eye className="h-3 w-3" />{views}</span><span>{anime.episode_count || 0} EP</span></div>
    </div>
  </Link>;
}