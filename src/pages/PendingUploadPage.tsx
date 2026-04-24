import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertCircle, Upload, Lock, Hourglass, Activity, FileVideo, ListChecks, Pencil, CheckCircle2, Loader2, Timer } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { SeeAllHeader } from '@/components/layout/SeeAllHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Compute the upload status and an estimated time remaining for a pending anime
 * based on how long ago it was added to the database.
 *
 * Heuristic timeline (rolling team SLA):
 *  - 0–24h  → "Queued"      (target: episodes within 48h)
 *  - 1–3d   → "Processing"  (encoding + multi-audio sync)
 *  - 3–7d   → "Encoding"    (still in pipeline, longer titles)
 *  - 7d+    → "Overdue"     (needs manual attention)
 */
type PendingStatus = {
  key: 'queued' | 'processing' | 'encoding' | 'overdue';
  label: string;
  description: string;
  remaining: string;
  badgeClass: string;
  ringClass: string;
  textClass: string;
  Icon: typeof Clock;
};

function formatRemaining(hours: number): string {
  if (hours <= 0) return 'Any moment now';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m left`;
  if (hours < 24) return `~${Math.round(hours)}h left`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `~${days}d ${rem}h left` : `~${days}d left`;
}

function getPendingStatus(createdAt: string): PendingStatus {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  // Target SLA: 72h to first episode pack
  const targetHours = 72;
  const remainingHours = targetHours - ageHours;

  if (ageHours < 24) {
    return {
      key: 'queued',
      label: 'Queued',
      description: 'In the upload queue. Team will pick this up within the next encoding window.',
      remaining: formatRemaining(remainingHours),
      badgeClass: 'bg-sky-500/90 text-white',
      ringClass: 'ring-sky-500/30 group-hover:ring-sky-500/60 group-hover:shadow-sky-500/20',
      textClass: 'group-hover:text-sky-400',
      Icon: Clock,
    };
  }
  if (ageHours < 72) {
    return {
      key: 'processing',
      label: 'Processing',
      description: 'Episodes are being prepared — multi-audio sync and subtitle timing in progress.',
      remaining: formatRemaining(remainingHours),
      badgeClass: 'bg-amber-500/90 text-white',
      ringClass: 'ring-amber-500/30 group-hover:ring-amber-500/60 group-hover:shadow-amber-500/20',
      textClass: 'group-hover:text-amber-400',
      Icon: Loader2,
    };
  }
  if (ageHours < 168) {
    return {
      key: 'encoding',
      label: 'Encoding',
      description: 'Adaptive HLS conversion (480p → 4K) underway. Larger seasons take longer.',
      remaining: formatRemaining(168 - ageHours),
      badgeClass: 'bg-violet-500/90 text-white',
      ringClass: 'ring-violet-500/30 group-hover:ring-violet-500/60 group-hover:shadow-violet-500/20',
      textClass: 'group-hover:text-violet-400',
      Icon: FileVideo,
    };
  }
  return {
    key: 'overdue',
    label: 'Overdue',
    description: 'Past expected delivery window. Flagged for the team to review and prioritise.',
    remaining: 'Needs review',
    badgeClass: 'bg-red-500/95 text-white',
    ringClass: 'ring-red-500/40 group-hover:ring-red-500/70 group-hover:shadow-red-500/25',
    textClass: 'group-hover:text-red-400',
    Icon: AlertCircle,
  };
}

interface NoEpisodesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  animeTitle: string;
}

function NoEpisodesPopup({ isOpen, onClose, animeTitle }: NoEpisodesPopupProps) {
  if (!isOpen) return null;

  const details = [
    {
      icon: '🎬',
      title: 'Episode upload queue',
      desc: 'Season links, posters and first episode files are still being added by the upload team.',
    },
    {
      icon: '🎧',
      title: 'Audio + E-sub check',
      desc: 'Multi-audio tracks (Hindi, English, Japanese) and subtitle timing are verified before release.',
    },
    {
      icon: '🔄',
      title: 'HLS conversion & encoding',
      desc: 'Episodes are being converted to adaptive streaming format (480p → 4K) for smooth playback.',
    },
    {
      icon: '📺',
      title: 'Server deployment',
      desc: 'Video files are being distributed across H.Savi, SAVI.IN, Multi.Savi and X-PLUS servers.',
    },
    {
      icon: '✅',
      title: 'Quality assurance',
      desc: 'Playback is tested on mobile, desktop and TV to ensure buffer-free streaming experience.',
    },
  ];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-4 shadow-xl animate-scale-in">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Episodes Coming Soon</h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="text-foreground font-medium">{animeTitle}</span> is still under progress, so the watch page is not open yet.
        </p>
        <div className="space-y-2.5 mb-4">
          {details.map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/40 p-3">
              <span className="text-base leading-none">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mb-6 rounded-lg border border-border/50 bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            We’ll unlock this anime here as soon as the first episode pack is ready for watching.
          </p>
        </div>
        <Button 
          onClick={onClose}
          className="w-full"
        >
          OK, Got It!
        </Button>
      </div>
    </div>
  );
}

interface AnimeWithoutEpisodes {
  id: string;
  title: string;
  cover_image: string | null;
  created_at: string;
  type: string | null;
  status: string | null;
}

export default function PendingUploadPage() {
  const { user, isUploader, isAdmin, isRolesLoaded } = useAuth();
  const navigate = useNavigate();
  const [animeList, setAnimeList] = useState<AnimeWithoutEpisodes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [noEpisodesPopup, setNoEpisodesPopup] = useState<{ isOpen: boolean; animeTitle: string }>({
    isOpen: false,
    animeTitle: '',
  });

  const canAccess = isUploader || isAdmin;

  useEffect(() => {
    if (isRolesLoaded && !canAccess) {
      return;
    }
    if (isRolesLoaded) {
      fetchAnimeWithoutEpisodes();
    }
  }, [isRolesLoaded, canAccess]);

  // Subscribe to episode changes to auto-refresh the pending list
  useEffect(() => {
    if (!isRolesLoaded || !canAccess) return;
    const channel = supabase
      .channel('pending-upload-episodes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'episodes' },
        () => {
          // Refetch whenever episodes are inserted/updated/deleted
          fetchAnimeWithoutEpisodes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'anime' },
        () => {
          fetchAnimeWithoutEpisodes();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isRolesLoaded, canAccess]);

  const fetchAnimeWithoutEpisodes = async () => {
    try {
      const { data: allAnime, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, created_at, type, status')
        .neq('status', 'upcoming')
        .order('created_at', { ascending: false });

      if (animeError) {
        console.error('Error fetching anime:', animeError);
        setIsLoading(false);
        return;
      }

      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, anime_id');

      const seasonIds = seasons?.map(s => s.id) || [];

      // Instead of fetching all episodes (hits 1000-row limit),
      // fetch distinct season_ids that have episodes using pagination
      const animeWithEpisodes = new Set<string>();
      const seasonToAnime = new Map((seasons || []).map(s => [s.id, s.anime_id]));
      
      if (seasonIds.length > 0) {
        // Paginate through episodes in chunks of 1000 (PostgREST max)
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data: episodeBatch } = await supabase
            .from('episodes')
            .select('season_id')
            .in('season_id', seasonIds)
            .range(offset, offset + pageSize - 1);
          
          (episodeBatch || []).forEach(ep => {
            const animeId = seasonToAnime.get(ep.season_id);
            if (animeId) animeWithEpisodes.add(animeId);
          });
          
          hasMore = (episodeBatch?.length || 0) === pageSize;
          offset += pageSize;
        }
      }

      const animeWithoutEpisodes = (allAnime || []).filter(anime => !animeWithEpisodes.has(anime.id));

      setAnimeList(animeWithoutEpisodes);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnimeClick = (anime: AnimeWithoutEpisodes, e: React.MouseEvent) => {
    e.preventDefault();
    if (canAccess) {
      navigate(`/upload/anime/${anime.id}`);
    } else {
      setNoEpisodesPopup({ isOpen: true, animeTitle: anime.title });
    }
  };

  // Show access denied for non-admins/uploaders
  if (isRolesLoaded && !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-muted-foreground mb-6">
            This page is only accessible to uploaders and administrators.
          </p>
          <Button asChild>
            <Link to="/browse">Go to Browse</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Daysince helper
  const daysSince = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  };

  // Bucket counts derived from new status logic
  const statusCounts = animeList.reduce(
    (acc, a) => {
      const s = getPendingStatus(a.created_at).key;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    { queued: 0, processing: 0, encoding: 0, overdue: 0 } as Record<PendingStatus['key'], number>
  );

  return (
    <div className="min-h-screen">
      <ContentNavTabs />

      <NoEpisodesPopup
        isOpen={noEpisodesPopup.isOpen}
        onClose={() => setNoEpisodesPopup({ isOpen: false, animeTitle: '' })}
        animeTitle={noEpisodesPopup.animeTitle}
      />

      <SeeAllHeader
        icon={Hourglass}
        title="Pending Upload"
        subtitle="Anime entries awaiting episode uploads — track upload progress and pick up where you left off."
        eyebrow="Upload Queue"
        iconGradient="from-amber-500 via-orange-500 to-rose-500"
        glowTone="bg-amber-500/20"
        stats={[
          { icon: ListChecks, value: animeList.length, label: 'Pending', tone: 'text-amber-400' },
          { icon: Clock, value: statusCounts.queued, label: 'Queued', tone: 'text-sky-400' },
          { icon: Loader2, value: statusCounts.processing + statusCounts.encoding, label: 'Processing', tone: 'text-violet-400' },
          { icon: AlertCircle, value: statusCounts.overdue, label: 'Overdue', tone: 'text-red-400' },
        ]}
      />

      <div className="container px-4 pb-12">
        {/* Live progress strip */}
        {!isLoading && animeList.length > 0 && canAccess && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] via-orange-500/[0.04] to-transparent p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/40 blur-lg rounded-full" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <FileVideo className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold">Click any title to continue uploading</p>
                <p className="text-[11px] text-muted-foreground">
                  Episodes will go live the moment encoding finishes — page auto-refreshes.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                Live Sync
              </span>
            </div>
          </div>
        )}

        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-6 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
          <h2 className="text-lg md:text-xl font-heading font-black">In the Queue</h2>
          <span className="text-xs text-muted-foreground">({animeList.length})</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : animeList.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border/50 bg-card/30">
            <div className="relative w-fit mx-auto mb-4">
              <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl">
                <Upload className="h-7 w-7 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-1">All Caught Up!</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              No anime entries are waiting for episodes right now. Add a new title to get started.
            </p>
            <Button asChild className="gap-2">
              <Link to="/upload">
                <Upload className="h-4 w-4" /> Upload New Anime
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeList.map((anime, index) => {
              const days = daysSince(anime.created_at);
              const isOverdue = days >= 7;
              const isRecent = days < 2;
              return (
                <AnimeCardContextMenu
                  key={anime.id}
                  animeTitle={anime.title}
                  animeUrl={`/anime/${anime.id}`}
                  coverImage={anime.cover_image}
                >
                  <div
                    onClick={(e) => handleAnimeClick(anime, e)}
                    className="group relative cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
                  >
                    <div
                      className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl ${
                        isOverdue
                          ? 'ring-red-500/30 group-hover:ring-red-500/60 group-hover:shadow-red-500/20'
                          : 'ring-amber-500/20 group-hover:ring-amber-500/50 group-hover:shadow-amber-500/20'
                      }`}
                    >
                      {anime.cover_image ? (
                        <img
                          src={anime.cover_image}
                          alt={anime.title}
                          className="w-full h-full object-cover blur-[2px] brightness-50 transition-all duration-500 group-hover:blur-0 group-hover:brightness-75"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                          <span className="text-muted-foreground text-xs">No Image</span>
                        </div>
                      )}

                      {/* Overlay scanline */}
                      <div
                        className="absolute inset-0 opacity-30 pointer-events-none"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 4px)',
                        }}
                      />

                      {/* Status badges top-left */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        {anime.type && (
                          <div className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-bold text-white uppercase tracking-wider border border-white/10">
                            {anime.type}
                          </div>
                        )}
                        {isOverdue && (
                          <div className="px-2 py-0.5 rounded-md bg-red-500/90 text-[9px] font-black text-white uppercase tracking-wider shadow-md flex items-center gap-1">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Overdue
                          </div>
                        )}
                      </div>

                      {/* New chip top-right */}
                      {isRecent && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500 to-green-500 text-[9px] font-black text-white uppercase tracking-wider shadow-md z-10">
                          New
                        </div>
                      )}

                      {/* Center status */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 z-[5]">
                        <div className="relative mb-2">
                          <div
                            className={`absolute inset-0 blur-lg rounded-full ${
                              isOverdue ? 'bg-red-500/50' : 'bg-amber-500/40'
                            }`}
                          />
                          <div
                            className={`relative w-11 h-11 rounded-full flex items-center justify-center shadow-xl ${
                              isOverdue
                                ? 'bg-gradient-to-br from-red-500 to-rose-600'
                                : 'bg-gradient-to-br from-amber-500 to-orange-500'
                            }`}
                          >
                            <Hourglass className="h-5 w-5 text-white animate-pulse" />
                          </div>
                        </div>
                        <span className="text-white text-[11px] font-bold leading-tight block drop-shadow">
                          Episodes Pending
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-white/80 font-medium px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
                          <Clock className="h-2.5 w-2.5" />
                          {days === 0 ? 'Added today' : `${days}d in queue`}
                        </span>
                      </div>

                      {/* Hover action overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 z-20">
                        {canAccess ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white text-[11px] font-black shadow-2xl shadow-amber-500/40 uppercase tracking-wider">
                            <Pencil className="h-3 w-3" /> Continue Upload
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 text-foreground text-[11px] font-black shadow-2xl uppercase tracking-wider">
                            <AlertCircle className="h-3 w-3" /> Details
                          </div>
                        )}
                      </div>
                    </div>

                    <h3
                      className={`mt-2.5 text-sm font-semibold line-clamp-2 transition-colors ${
                        isOverdue ? 'group-hover:text-red-400' : 'group-hover:text-amber-400'
                      }`}
                    >
                      {anime.title}
                    </h3>
                  </div>
                </AnimeCardContextMenu>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
