import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, Share2, Loader2, Sparkles, Users, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  genres: string[] | null;
}

interface Collection {
  id: string;
  title: string;
  description: string | null;
  anime_ids: string[];
  likes: number;
  views: number;
  user_id: string;
  created_at: string;
}

export default function SharePage() {
  const { token } = useParams();
  const { user } = useAuth();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [anime, setAnime] = useState<Anime[]>([]);
  const [owner, setOwner] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: col } = await supabase
        .from('shared_collections')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();
      if (!col) { setLoading(false); return; }
      setCollection(col as Collection);

      // increment views (fire and forget)
      supabase.from('shared_collections').update({ views: (col.views || 0) + 1 }).eq('id', col.id).then(() => {});

      const [{ data: animeRows }, { data: prof }] = await Promise.all([
        supabase.from('anime').select('id,title,cover_image,genres').in('id', col.anime_ids as string[]),
        supabase.from('profiles').select('username,avatar_url').eq('id', col.user_id).maybeSingle(),
      ]);
      setAnime((animeRows || []) as Anime[]);
      setOwner((prof as any) || null);

      if (user) {
        const { data: likeRow } = await supabase
          .from('shared_collection_likes')
          .select('id')
          .eq('collection_id', col.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setLiked(!!likeRow);
      }
      setLoading(false);
    })();
  }, [token, user]);

  const toggleLike = async () => {
    if (!user) { toast.error('Sign in to like'); return; }
    if (!collection) return;
    setBusy(true);
    if (liked) {
      await supabase.from('shared_collection_likes').delete()
        .eq('collection_id', collection.id).eq('user_id', user.id);
      setLiked(false);
      setCollection({ ...collection, likes: Math.max(0, collection.likes - 1) });
    } else {
      await supabase.from('shared_collection_likes').insert({ collection_id: collection.id, user_id: user.id });
      setLiked(true);
      setCollection({ ...collection, likes: collection.likes + 1 });
    }
    setBusy(false);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  };

  if (loading) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!collection) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-center px-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Collection not found</h1>
          <p className="text-muted-foreground mb-4">This share link may have expired or been removed.</p>
          <Button asChild><Link to="/">Go Home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 md:py-10 max-w-6xl">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden border border-border/40 mb-8 p-6 md:p-10 bg-gradient-to-br from-primary/15 via-background to-background">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end gap-6 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-primary/80 mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Shared collection
            </div>
            <h1 className="text-2xl md:text-4xl font-heading font-bold mb-2 break-words">{collection.title}</h1>
            {collection.description && (
              <p className="text-muted-foreground text-sm md:text-base max-w-2xl">{collection.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> by @{owner?.username || 'anonymous'}</span>
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {collection.views}</span>
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {collection.likes}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={toggleLike} disabled={busy} variant={liked ? 'default' : 'outline'} className="rounded-full">
              <Heart className={`h-4 w-4 mr-2 ${liked ? 'fill-current' : ''}`} />
              {liked ? 'Liked' : 'Like'}
            </Button>
            <Button onClick={copyLink} variant="outline" className="rounded-full">
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {anime.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">This collection is empty.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
          {anime.map((a) => (
            <Link key={a.id} to={`/anime/${a.id}`} className="group">
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-muted/40 border border-border/40 group-hover:border-primary/60 transition-all shadow-md group-hover:shadow-xl group-hover:shadow-primary/20">
                <img src={a.cover_image || '/placeholder.svg'} alt={a.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <p className="text-xs md:text-sm mt-2 line-clamp-2 group-hover:text-primary transition-colors">{a.title}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
