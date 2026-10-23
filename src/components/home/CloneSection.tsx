import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Copy, ArrowUpRight } from 'lucide-react';

import { CatalogueHeading } from './CatalogueHeading';

interface CloneCard {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string;
}

export function CloneSection() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<CloneCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('clone_platforms')
        .select('id, name, slug, logo_url, category')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (!cancelled) setCards((data as CloneCard[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!cards.length) return null;
  return <section className="catalogue-section catalogue-compact py-3 md:py-4" aria-label="Clones">
    <div className="container">
      <CatalogueHeading title="Clones" eyebrow="Explore collections" icon={Copy} rowRef={rowRef} />
      <div ref={rowRef} className="snap-row flex gap-3 overflow-x-auto pb-4 pt-1">
        {cards.map(c => <Link key={c.id} to={`/${c.slug}`} className="catalogue-glass rounded-lg p-2 w-[152px] md:w-[168px] shrink-0 flex items-center gap-2 group">
          {c.logo_url ? <img src={c.logo_url} alt={`${c.name} logo`} loading="lazy" className="h-7 w-7 rounded object-contain bg-muted shrink-0" /> : <Copy className="h-7 w-7 text-primary shrink-0" />}
          <div className="min-w-0 flex-1"><h3 className="text-xs font-semibold truncate">{c.name}</h3><p className="text-[8px] uppercase text-muted-foreground truncate">{c.category}</p></div><ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />
        </Link>)}
      </div>
    </div>
  </section>;
}

export default CloneSection;
