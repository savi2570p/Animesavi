import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, TrendingUp } from 'lucide-react';

interface SuggestionAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  genres: string[] | null;
}

interface SearchSuggestionsProps {
  query: string;
  isVisible: boolean;
  onSelect: () => void;
  className?: string;
}

export function SearchSuggestions({ query, isVisible, onSelect, className }: SearchSuggestionsProps) {
  const [results, setResults] = useState<SuggestionAnime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('anime')
        .select('id, title, cover_image, type, genres')
        .ilike('title', `%${query.trim()}%`)
        .limit(6);

      setResults(data || []);
      setIsLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!isVisible || query.trim().length < 2) return null;

  return (
    <div className={`absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 ${className}`}>
      {isLoading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          <Search className="h-4 w-4 animate-spin inline mr-2" />
          Searching...
        </div>
      ) : results.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No results for "{query}"
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            Results
          </div>
          {results.map((anime) => (
            <Link
              key={anime.id}
              to={`/anime/${anime.id}`}
              onClick={onSelect}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                {anime.cover_image ? (
                  <img
                    src={anime.cover_image}
                    alt={anime.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[8px]">
                    N/A
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{anime.title}</p>
                  <span className="badge-glass-hdub shrink-0">H-DUB</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {anime.type && (
                    <span className="text-[10px] font-semibold uppercase text-primary">{anime.type}</span>
                  )}
                  {anime.genres?.slice(0, 2).map((g) => (
                    <span key={g} className="text-[10px] text-muted-foreground">{g}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
