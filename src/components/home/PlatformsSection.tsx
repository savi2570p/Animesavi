import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowUpRight } from 'lucide-react';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import museinLogo from '@/assets/musein-logo.jpg';
import floxLogo from '@/assets/flox-anime-india-logo.jpg';
import { CatalogueHeading } from './CatalogueHeading';

export function PlatformsSection() {
  const rowRef = useRef<HTMLDivElement>(null);
  return <section className="catalogue-section py-6 md:py-9" aria-label="Platforms">
    <div className="container">
      <CatalogueHeading title="Platforms" eyebrow="Curated channels" icon={Layers} rowRef={rowRef} />
      <div ref={rowRef} className="flex gap-3 overflow-x-auto snap-row pb-4 pt-1">
        {[{ to: '/crunchy', src: crunchyrollLogo, name: 'Crunchy' }, { to: '/musein', src: museinLogo, name: 'MuseIN' }, { to: '/flox', src: floxLogo, name: 'Flox +' }].map(item => <Link key={item.to} to={item.to} className="catalogue-glass flex items-center gap-4 rounded-xl p-4 w-[240px] md:w-[280px] shrink-0">
          <img src={item.src} alt={item.name} className="h-12 w-12 object-contain rounded-lg bg-muted" loading="lazy" />
          <span className="font-heading text-lg font-semibold flex-1">{item.name}</span><ArrowUpRight className="h-4 w-4 text-primary" />
        </Link>)}
      </div>
    </div>
  </section>;
}