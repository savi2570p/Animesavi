import { memo, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Play, Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { SearchSuggestions } from '@/components/SearchSuggestions';
import logo from '@/assets/logo.png';

interface HeroTitle {
  id: string;
  title: string;
  art: string | null;
}

/**
 * Re:ANIME-style homepage header: brand, large search with live suggestions,
 * popular-title shortcuts and two primary actions. The ambient artwork and
 * the "Watch now" target come from the admin-managed hero lineup, falling
 * back to the most-viewed titles.
 */
export const HomeSearchHero = memo(function HomeSearchHero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [featured, setFeatured] = useState<HeroTitle[]>([]);
  const [popular, setPopular] = useState<HeroTitle[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: lineup }, { data: top }] = await Promise.all([
        supabase
          .from('featured_hero_lineup')
          .select('position, custom_title, custom_cover_url, anime:anime_id ( id, title, cover_image )')
          .eq('is_active', true)
          .order('position', { ascending: true })
          .limit(6),
        supabase
          .from('anime')
          .select('id, title, cover_image')
          .order('view_count', { ascending: false })
          .limit(6),
      ]);
      if (cancelled) return;
      const fromLineup: HeroTitle[] = (lineup || [])
        .filter((row: any) => row.anime)
        .map((row: any) => ({
          id: row.anime.id,
          title: row.custom_title || row.anime.title,
          art: row.custom_cover_url || row.anime.cover_image,
        }));
      const fromTop: HeroTitle[] = (top || []).map((a) => ({ id: a.id, title: a.title, art: a.cover_image }));
      setFeatured(fromLineup.length ? fromLineup : fromTop);
      setPopular(fromTop.slice(0, 5));
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setShowSuggestions(false);
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  };

  const watchTarget = featured[0] ? `/anime/${featured[0].id}` : '/browse';
  const art = featured.filter((f) => f.art).slice(0, 6);

  return (
    <section className="home-search-hero" aria-label="Search AnimeSavi">
      {art.length > 0 && (
        <div className="home-search-hero-art" aria-hidden>
          {art.map((item) => (
            <img key={item.id} src={item.art!} alt="" loading="eager" decoding="async" />
          ))}
        </div>
      )}

      <div className="container max-w-3xl flex flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="home-search-hero-logo" />
          <span className="font-heading text-3xl md:text-5xl font-bold tracking-tight leading-none">
            <span className="text-primary">Anime</span>Savi
          </span>
        </div>

        <h1 className="mt-5 md:mt-7 text-2xl md:text-4xl font-semibold text-foreground">
          Watch Anime in Hindi DUB
        </h1>

        <form onSubmit={submit} className="relative mt-6 md:mt-8 w-full" role="search">
          <div className="home-search-field flex items-center gap-2 pl-4 pr-2 h-14">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search anime"
              aria-label="Search anime"
              className="flex-1 min-w-0 h-full appearance-none !bg-transparent !border-0 !shadow-none !ring-0 px-0 text-base text-foreground placeholder:text-muted-foreground outline-none"
            />
            <Button asChild size="sm" className="h-10 px-4 font-semibold">
              <Link to={query.trim() ? `/browse?q=${encodeURIComponent(query.trim())}` : '/browse'}>
                Filter <SlidersHorizontal className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <SearchSuggestions
            query={query}
            isVisible={showSuggestions}
            onSelect={() => { setQuery(''); setShowSuggestions(false); }}
            className="text-left mt-2"
          />
        </form>

        {popular.length > 0 && (
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-0 text-xs md:text-sm">
            <span className="text-muted-foreground/70">Popular:</span>
            {popular.map((item) => (
              <Link key={item.id} to={`/anime/${item.id}`} className="home-search-chip max-w-[14rem] truncate">
                {item.title}
              </Link>
            ))}
          </p>
        )}

        <div className="mt-6 md:mt-9 flex justify-center gap-2.5 md:gap-3">
          <Button asChild size="lg" className="h-11 md:h-12 px-5 md:px-7 text-sm md:text-base font-semibold">
            <Link to={watchTarget}><Play className="h-4 w-4 fill-current" /> Watch now</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 md:h-12 px-5 md:px-7 text-sm md:text-base font-semibold bg-card">
            <Link to="/schedule"><CalendarDays className="h-4 w-4" /> View Schedule</Link>
          </Button>
        </div>
      </div>
    </section>
  );
});
