import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowUpRight } from 'lucide-react';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import museinLogo from '@/assets/musein-logo.jpg';
import { CatalogueHeading } from './CatalogueHeading';

export function PlatformsSection() {
  const rowRef = useRef<HTMLDivElement>(null);
  return <section className="catalogue-section catalogue-compact py-3 md:py-4" aria-label="Platforms">
    <div className="container">
      <CatalogueHeading title="Platforms" eyebrow="Curated channels" icon={Layers} rowRef={rowRef} />
      <div ref={rowRef} className="flex gap-3 overflow-x-auto snap-row pb-4 pt-1">
        {[{ to: '/crunchy', src: crunchyrollLogo, name: 'Crunchy' }, { to: '/musein', src: museinLogo, name: 'MuseIN' }].map(item => <Link key={item.to} to={item.to} className="catalogue-glass flex items-center gap-2 rounded-lg p-2 w-[140px] md:w-[156px] shrink-0">
          <img src={item.src} alt={item.name} className="h-7 w-7 object-contain rounded bg-muted shrink-0" loading="lazy" />
          <span className="text-xs font-semibold flex-1 min-w-0 truncate">{item.name}</span><ArrowUpRight className="h-3 w-3 text-primary shrink-0" />
        </Link>)}
      </div>
    </div>
  </section>;
}