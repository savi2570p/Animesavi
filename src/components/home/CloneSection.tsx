import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Copy, ChevronRight } from 'lucide-react';

interface CloneCard {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string;
}

export function CloneSection() {
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
    return () => {
      cancelled = true;
    };
  }, []);

  if (cards.length === 0) return null;

  return (
    <section className="container py-5 md:py-7">
      <div className="mb-3 flex items-center gap-2">
        <Copy className="h-4 w-4 text-[hsl(275_90%_78%)]" />
        <h2 className="text-lg font-bold tracking-tight md:text-xl">Clone</h2>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Ad-blocked mirrors
        </span>
      </div>

      <div className="snap-row flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {cards.map((c) => (
          <Link
            key={c.id}
            to={`/${c.slug}`}
            className="lg-chip snap-start group flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 transition-transform duration-300 hover:scale-[1.03] active:scale-95"
          >
            {c.logo_url ? (
              <img
                src={c.logo_url}
                alt={`${c.name} logo`}
                loading="lazy"
                className="h-9 w-9 rounded-xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                <Copy className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {c.category}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default CloneSection;
