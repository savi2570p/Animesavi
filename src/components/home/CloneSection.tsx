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
  return <section className="catalogue-section py-6 md:py-9" aria-label="Clones">
    <div className="container">
      <CatalogueHeading title="Clones" eyebrow="Explore collections" icon={Copy} rowRef={rowRef} />
      <div ref={rowRef} className="snap-row flex gap-3 overflow-x-auto pb-4 pt-1">
        {cards.map(c => <Link key={c.id} to={`/${c.slug}`} className="catalogue-glass rounded-xl p-4 w-[220px] shrink-0 group">
          <div className="flex justify-between items-start mb-5">{c.logo_url ? <img src={c.logo_url} alt={`${c.name} logo`} loading="lazy" className="h-12 w-12 rounded-lg object-contain bg-muted" /> : <Copy className="h-10 w-10 text-primary" />}<ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div>
          <h3 className="text-sm font-semibold truncate">{c.name}</h3><p className="text-[10px] uppercase text-muted-foreground mt-1">{c.category}</p>
        </Link>)}
      </div>
    </div>
  </section>;
}

export default CloneSection;
