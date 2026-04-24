import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Clock, AlertCircle, Upload, Lock, Hourglass, FileVideo, ListChecks,
  Pencil, Loader2, Timer, Search, LayoutGrid, Rows3, Sparkles,
  CircleDot, RefreshCw, ServerCog, ShieldCheck, PackageCheck,
} from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────────────────
// Status heuristics
// ──────────────────────────────────────────────────────────────────────
type StatusKey = 'queued' | 'processing' | 'encoding' | 'overdue';

type PendingStatus = {
  key: StatusKey;
  label: string;
  description: string;
  remaining: string;
  progress: number; // 0-100 along the SLA pipeline
  badgeClass: string;
  ringClass: string;
  textClass: string;
  glowClass: string;
  Icon: typeof Clock;
};

const SLA_HOURS = 168; // 7-day full pipeline window

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
  const targetHours = 72;
  const remainingHours = targetHours - ageHours;
  const progress = Math.min(100, Math.max(4, (ageHours / SLA_HOURS) * 100));

  if (ageHours < 24) {
    return {
      key: 'queued', label: 'Queued',
      description: 'In the upload queue. Team will pick this up within the next encoding window.',
      remaining: formatRemaining(remainingHours), progress,
      badgeClass: 'bg-sky-500/95 text-white shadow-sky-500/30',
      ringClass: 'ring-sky-500/30 group-hover:ring-sky-400/70',
      textClass: 'group-hover:text-sky-300',
      glowClass: 'from-sky-500/25 via-sky-500/10 to-transparent',
      Icon: Clock,
    };
  }
  if (ageHours < 72) {
    return {
      key: 'processing', label: 'Processing',
      description: 'Episodes are being prepared — multi-audio sync and subtitle timing in progress.',
      remaining: formatRemaining(remainingHours), progress,
      badgeClass: 'bg-amber-500/95 text-white shadow-amber-500/30',
      ringClass: 'ring-amber-500/30 group-hover:ring-amber-400/70',
      textClass: 'group-hover:text-amber-300',
      glowClass: 'from-amber-500/25 via-orange-500/10 to-transparent',
      Icon: Loader2,
    };
  }
  if (ageHours < SLA_HOURS) {
    return {
      key: 'encoding', label: 'Encoding',
      description: 'Adaptive HLS conversion (480p → 4K) underway. Larger seasons take longer.',
      remaining: formatRemaining(SLA_HOURS - ageHours), progress,
      badgeClass: 'bg-violet-500/95 text-white shadow-violet-500/30',
      ringClass: 'ring-violet-500/30 group-hover:ring-violet-400/70',
      textClass: 'group-hover:text-violet-300',
      glowClass: 'from-violet-500/25 via-fuchsia-500/10 to-transparent',
      Icon: FileVideo,
    };
  }
  return {
    key: 'overdue', label: 'Overdue',
    description: 'Past expected delivery window. Flagged for the team to review and prioritise.',
    remaining: 'Needs review', progress: 100,
    badgeClass: 'bg-red-500/95 text-white shadow-red-500/30',
    ringClass: 'ring-red-500/40 group-hover:ring-red-400/80',
    textClass: 'group-hover:text-red-300',
    glowClass: 'from-red-500/30 via-rose-500/15 to-transparent',
    Icon: AlertCircle,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Popups
// ──────────────────────────────────────────────────────────────────────
interface NoEpisodesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  animeTitle: string;
}

function NoEpisodesPopup({ isOpen, onClose, animeTitle }: NoEpisodesPopupProps) {
  if (!isOpen) return null;

  // Pretend a live pipeline progress — in reality we just animate forward to feel alive.
  const activeStage = 2; // "Encoding" highlighted by default
  const stages = [
    { Icon: ListChecks, title: 'Upload queue', desc: 'Season links, posters and episode files added.', tone: 'sky' },
    { Icon: ShieldCheck, title: 'Audio + E-sub check', desc: 'Multi-audio + subtitle timing verified.', tone: 'amber' },
    { Icon: RefreshCw, title: 'HLS encoding', desc: 'Adaptive streaming (480p → 4K) in progress.', tone: 'violet' },
    { Icon: ServerCog, title: 'Server deployment', desc: 'Distributed to H.Savi, SAVI.IN, Multi.Savi & X-PLUS.', tone: 'fuchsia' },
    { Icon: PackageCheck, title: 'Quality assurance', desc: 'Tested on mobile, desktop & TV before going live.', tone: 'emerald' },
  ] as const;

  const toneMap: Record<string, { ring: string; bg: string; text: string; dot: string; bar: string }> = {
    sky: { ring: 'ring-sky-500/40', bg: 'bg-sky-500/15', text: 'text-sky-300', dot: 'bg-sky-500', bar: 'bg-sky-500' },
    amber: { ring: 'ring-amber-500/40', bg: 'bg-amber-500/15', text: 'text-amber-300', dot: 'bg-amber-500', bar: 'bg-amber-500' },
    violet: { ring: 'ring-violet-500/50', bg: 'bg-violet-500/15', text: 'text-violet-300', dot: 'bg-violet-500', bar: 'bg-violet-500' },
    fuchsia: { ring: 'ring-fuchsia-500/40', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', dot: 'bg-fuchsia-500', bar: 'bg-fuchsia-500' },
    emerald: { ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cinematic backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-card via-card/95 to-card border border-border/60 rounded-3xl" />
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-amber-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-violet-500/15 blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none rounded-3xl"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 12px)' }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-background/60 hover:bg-background border border-border/50 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        <div className="relative p-6 md:p-7">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 uppercase tracking-[0.18em] mb-4">
            <Sparkles className="h-3 w-3" /> Under Progress
          </div>

          {/* Hero icon + headings */}
          <div className="flex items-start gap-4 mb-5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-amber-500/40 blur-2xl rounded-3xl animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-xl shadow-amber-500/40">
                <Hourglass className="h-7 w-7 text-white animate-pulse" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl md:text-2xl font-heading font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Episodes Coming Soon
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-foreground font-semibold">{animeTitle}</span> is still cooking — we’ll unlock the watch page the moment the first episode pack is ready.
              </p>
            </div>
          </div>

          {/* Live status pill row */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Pipeline Live</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/50">
              <Timer className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ETA 24–72h</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/50">
              <FileVideo className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Adaptive HLS</span>
            </div>
          </div>

          {/* Vertical timeline */}
          <div className="relative mb-5">
            {/* Track */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-sky-500/40 via-amber-500/40 via-violet-500/50 via-fuchsia-500/40 to-emerald-500/40" />

            <div className="space-y-2.5">
              {stages.map((s, i) => {
                const t = toneMap[s.tone];
                const isDone = i < activeStage;
                const isActive = i === activeStage;
                return (
                  <div key={s.title} className="relative flex items-start gap-3 pl-0">
                    {/* Node */}
                    <div className="relative z-10 shrink-0 mt-1">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center ring-2 transition-all',
                          isActive ? cn(t.bg, t.ring, 'shadow-lg') : isDone ? 'bg-emerald-500/15 ring-emerald-500/40' : 'bg-muted/50 ring-border/50',
                        )}
                      >
                        {isDone ? (
                          <CircleDot className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <s.Icon className={cn('h-4 w-4', isActive ? t.text : 'text-muted-foreground', isActive && s.Icon === RefreshCw && 'animate-spin')} />
                        )}
                      </div>
                      {isActive && (
                        <span className={cn('absolute inset-0 rounded-full animate-ping opacity-50', t.bg)} />
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className={cn(
                        'flex-1 min-w-0 rounded-xl border p-2.5 transition-all',
                        isActive
                          ? 'bg-card/80 border-border shadow-md'
                          : 'bg-muted/30 border-border/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={cn('text-sm font-bold leading-tight', isActive && t.text)}>
                          <span className="text-muted-foreground/70 font-mono text-[10px] mr-1.5">0{i + 1}</span>
                          {s.title}
                        </p>
                        {isActive && (
                          <span className={cn('text-[9px] font-black uppercase tracking-wider px-1.5 py-px rounded', t.bg, t.text)}>
                            In Progress
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-px rounded bg-emerald-500/15 text-emerald-300">
                            Done
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{s.desc}</p>

                      {/* Animated bar for active step */}
                      {isActive && (
                        <div className="mt-2 h-1 rounded-full bg-muted/60 overflow-hidden">
                          <div className={cn('h-full w-1/2 rounded-full animate-pulse', t.bar)} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer note + CTA */}
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.04] to-transparent p-3 mb-4 flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              You’ll see the watch page unlock automatically here — no need to refresh. Want a heads-up? Add it to your <span className="text-foreground font-semibold">Watch List</span> to get notified.
            </p>
          </div>

          <Button onClick={onClose} size="lg" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold uppercase tracking-wider shadow-lg shadow-amber-500/30">
            Got It — I'll Wait
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────
interface AnimeWithoutEpisodes {
  id: string;
  title: string;
  cover_image: string | null;
  created_at: string;
  type: string | null;
  status: string | null;
}

const FILTERS: { key: 'all' | StatusKey; label: string; tone: string }[] = [
  { key: 'all', label: 'All', tone: 'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground' },
  { key: 'queued', label: 'Queued', tone: 'data-[active=true]:bg-sky-500 data-[active=true]:text-white' },
  { key: 'processing', label: 'Processing', tone: 'data-[active=true]:bg-amber-500 data-[active=true]:text-white' },
  { key: 'encoding', label: 'Encoding', tone: 'data-[active=true]:bg-violet-500 data-[active=true]:text-white' },
  { key: 'overdue', label: 'Overdue', tone: 'data-[active=true]:bg-red-500 data-[active=true]:text-white' },
];

export default function PendingUploadPage() {
  const { isUploader, isAdmin, isRolesLoaded } = useAuth();
  const navigate = useNavigate();
  const [animeList, setAnimeList] = useState<AnimeWithoutEpisodes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [noEpisodesPopup, setNoEpisodesPopup] = useState<{ isOpen: boolean; animeTitle: string }>({ isOpen: false, animeTitle: '' });
  const [filter, setFilter] = useState<'all' | StatusKey>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [refreshing, setRefreshing] = useState(false);

  const canAccess = isUploader || isAdmin;

  useEffect(() => {
    if (isRolesLoaded && canAccess) fetchAnimeWithoutEpisodes();
  }, [isRolesLoaded, canAccess]);

  useEffect(() => {
    if (!isRolesLoaded || !canAccess) return;
    const channel = supabase
      .channel('pending-upload-episodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'episodes' }, () => fetchAnimeWithoutEpisodes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anime' }, () => fetchAnimeWithoutEpisodes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isRolesLoaded, canAccess]);

  const fetchAnimeWithoutEpisodes = async () => {
    try {
      setRefreshing(true);
      const { data: allAnime, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, created_at, type, status')
        .neq('status', 'upcoming')
        .order('created_at', { ascending: false });

      if (animeError) { console.error('Error fetching anime:', animeError); setIsLoading(false); return; }

      const { data: seasons } = await supabase.from('seasons').select('id, anime_id');
      const seasonIds = seasons?.map(s => s.id) || [];

      const animeWithEpisodes = new Set<string>();
      const seasonToAnime = new Map((seasons || []).map(s => [s.id, s.anime_id]));

      if (seasonIds.length > 0) {
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: episodeBatch } = await supabase
            .from('episodes').select('season_id').in('season_id', seasonIds)
            .range(offset, offset + pageSize - 1);
          (episodeBatch || []).forEach(ep => {
            const animeId = seasonToAnime.get(ep.season_id);
            if (animeId) animeWithEpisodes.add(animeId);
          });
          hasMore = (episodeBatch?.length || 0) === pageSize;
          offset += pageSize;
        }
      }

      const animeWithoutEpisodes = (allAnime || []).filter(a => !animeWithEpisodes.has(a.id));
      setAnimeList(animeWithoutEpisodes);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const handleAnimeClick = (anime: AnimeWithoutEpisodes, e: React.MouseEvent) => {
    e.preventDefault();
    if (canAccess) navigate(`/upload/anime/${anime.id}`);
    else setNoEpisodesPopup({ isOpen: true, animeTitle: anime.title });
  };

  const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

  const statusCounts = useMemo(() => animeList.reduce(
    (acc, a) => { const s = getPendingStatus(a.created_at).key; acc[s] = (acc[s] || 0) + 1; return acc; },
    { queued: 0, processing: 0, encoding: 0, overdue: 0 } as Record<StatusKey, number>,
  ), [animeList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return animeList.filter(a => {
      if (filter !== 'all' && getPendingStatus(a.created_at).key !== filter) return false;
      if (q && !a.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [animeList, filter, search]);

  const oldestDays = useMemo(() => {
    if (!animeList.length) return 0;
    return Math.max(...animeList.map(a => daysSince(a.created_at)));
  }, [animeList]);

  // Access denied
  if (isRolesLoaded && !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4 border border-destructive/30">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-muted-foreground mb-6">This page is only accessible to uploaders and administrators.</p>
          <Button asChild><Link to="/browse">Go to Browse</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ContentNavTabs />

      <NoEpisodesPopup
        isOpen={noEpisodesPopup.isOpen}
        onClose={() => setNoEpisodesPopup({ isOpen: false, animeTitle: '' })}
        animeTitle={noEpisodesPopup.animeTitle}
      />

      {/* ── Cinematic Hero ── */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.08] via-orange-500/[0.04] to-rose-500/[0.06]" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-rose-500/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 14px)' }}
        />

        <div className="container relative px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 uppercase tracking-[0.18em] mb-3">
                <Sparkles className="h-3 w-3" /> Upload Queue
              </div>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-amber-500/40 blur-2xl rounded-3xl" />
                  <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
                    <Hourglass className="h-7 w-7 md:h-8 md:w-8 text-white animate-pulse" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-4xl font-heading font-black tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                    Pending Upload
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl">
                    Anime entries awaiting episodes — track the encoding pipeline and pick up where uploads left off.
                  </p>
                </div>
              </div>
            </div>

            {/* Live status pill */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Live Sync</span>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={fetchAnimeWithoutEpisodes}
                className="h-8 gap-1.5 border-border/60 backdrop-blur-sm"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mt-6">
            {[
              { Icon: ListChecks, value: animeList.length, label: 'Total Pending', tone: 'from-amber-500/20 to-orange-500/5 border-amber-500/30 text-amber-300' },
              { Icon: Clock, value: statusCounts.queued, label: 'Queued', tone: 'from-sky-500/20 to-sky-500/5 border-sky-500/30 text-sky-300' },
              { Icon: Loader2, value: statusCounts.processing, label: 'Processing', tone: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-300' },
              { Icon: FileVideo, value: statusCounts.encoding, label: 'Encoding', tone: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-300' },
              { Icon: AlertCircle, value: statusCounts.overdue, label: 'Overdue', tone: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-300' },
            ].map((s) => (
              <div
                key={s.label}
                className={cn(
                  'relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm p-3 md:p-4 transition-all hover:-translate-y-0.5',
                  s.tone,
                )}
              >
                <div className="flex items-center justify-between">
                  <s.Icon className={cn('h-4 w-4 opacity-80', s.label === 'Processing' && 'animate-spin')} />
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{s.label}</span>
                </div>
                <div className="text-2xl md:text-3xl font-black mt-1 tabular-nums text-foreground">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Pipeline SLA bar */}
          {animeList.length > 0 && (
            <div className="mt-5 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-3 md:p-4">
              <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CircleDot className="h-3.5 w-3.5 text-amber-400" />
                  <span>Pipeline SLA — 7-day window</span>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Oldest in queue: <span className="text-foreground font-bold">{oldestDays}d</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 via-amber-500 via-violet-500 to-red-500 opacity-60" style={{ width: '100%' }} />
                <div className="absolute top-0 bottom-0 w-px bg-foreground/40" style={{ left: '14%' }} title="24h" />
                <div className="absolute top-0 bottom-0 w-px bg-foreground/40" style={{ left: '43%' }} title="72h" />
                <div className="absolute top-0 bottom-0 w-px bg-foreground/40" style={{ left: '100%' }} title="7d" />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wider">
                <span>0h · Queued</span>
                <span>24h · Processing</span>
                <span>72h · Encoding</span>
                <span>7d · Overdue</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Toolbar ── */}
      <div className="sticky top-[7.25rem] z-30 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container px-4 py-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pending titles…"
              className="pl-9 h-9 bg-muted/40 border-border/50"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => {
              const count = f.key === 'all' ? animeList.length : statusCounts[f.key];
              return (
                <button
                  key={f.key}
                  data-active={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all border border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground',
                    f.tone,
                  )}
                >
                  {f.label}
                  <span className="px-1.5 py-px rounded-full bg-background/40 text-[10px] tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <button
              onClick={() => setView('grid')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              aria-label="List view"
            >
              <Rows3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="container px-4 py-6 pb-12">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border/50 bg-card/30">
            <div className="relative w-fit mx-auto mb-4">
              <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl">
                <Upload className="h-7 w-7 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-1">
              {animeList.length === 0 ? 'All Caught Up!' : 'No matches'}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              {animeList.length === 0
                ? 'No anime entries are waiting for episodes right now. Add a new title to get started.'
                : 'Try a different filter or clear your search to see more pending titles.'}
            </p>
            {animeList.length === 0 ? (
              <Button asChild className="gap-2"><Link to="/upload"><Upload className="h-4 w-4" /> Upload New Anime</Link></Button>
            ) : (
              <Button variant="outline" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</Button>
            )}
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
            {view === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filtered.map((anime, index) => (
                  <PendingGridCard
                    key={anime.id}
                    anime={anime}
                    index={index}
                    canAccess={canAccess}
                    daysInQueue={daysSince(anime.created_at)}
                    onClick={(e) => handleAnimeClick(anime, e)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filtered.map((anime, index) => (
                  <PendingListRow
                    key={anime.id}
                    anime={anime}
                    index={index}
                    canAccess={canAccess}
                    daysInQueue={daysSince(anime.created_at)}
                    onClick={(e) => handleAnimeClick(anime, e)}
                  />
                ))}
              </div>
            )}
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Grid card
// ──────────────────────────────────────────────────────────────────────
function PendingGridCard({
  anime, index, canAccess, daysInQueue, onClick,
}: {
  anime: AnimeWithoutEpisodes; index: number; canAccess: boolean; daysInQueue: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  const status = getPendingStatus(anime.created_at);
  const StatusIcon = status.Icon;
  const isOverdue = status.key === 'overdue';

  return (
    <AnimeCardContextMenu animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
      <div
        onClick={onClick}
        className="group relative cursor-pointer animate-fade-in"
        style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
      >
        <div className={cn(
          'relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl',
          status.ringClass,
        )}>
          {anime.cover_image ? (
            <img
              src={anime.cover_image} alt={anime.title}
              className="w-full h-full object-cover blur-[2px] brightness-50 transition-all duration-500 group-hover:blur-0 group-hover:brightness-75"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
              <span className="text-muted-foreground text-xs">No Image</span>
            </div>
          )}

          {/* Status-tinted glow */}
          <div className={cn('absolute inset-0 bg-gradient-to-t pointer-events-none', status.glowClass)} />

          {/* Scanline */}
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 4px)' }} />

          {/* Type chip */}
          {anime.type && (
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-bold text-white uppercase tracking-wider border border-white/10">
              {anime.type}
            </div>
          )}

          {/* Status badge */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-md',
                  status.badgeClass,
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <StatusIcon className={cn('h-2.5 w-2.5', status.key === 'processing' && 'animate-spin')} />
                {status.label}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              <p className="font-semibold mb-0.5">{status.label}</p>
              <p className="text-muted-foreground">{status.description}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium">
                <Timer className="h-3 w-3" /> {status.remaining}
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Center info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 z-[5]">
            <div className="relative mb-2">
              <div className={cn('absolute inset-0 blur-lg rounded-full', isOverdue ? 'bg-red-500/50' : 'bg-amber-500/40')} />
              <div className={cn(
                'relative w-11 h-11 rounded-full flex items-center justify-center shadow-xl',
                isOverdue ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-amber-500 to-orange-500',
              )}>
                <Hourglass className="h-5 w-5 text-white animate-pulse" />
              </div>
            </div>
            <span className="text-white text-[11px] font-bold leading-tight block drop-shadow">Episodes Pending</span>
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-white font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 drop-shadow">
              <Timer className="h-2.5 w-2.5" />{status.remaining}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-white/70 font-medium">
              <Clock className="h-2.5 w-2.5" />
              {daysInQueue === 0 ? 'Added today' : `${daysInQueue}d in queue`}
            </span>
          </div>

          {/* Bottom progress bar */}
          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50 z-[6]">
            <div
              className={cn(
                'h-full transition-all duration-700',
                status.key === 'queued' && 'bg-sky-400',
                status.key === 'processing' && 'bg-amber-400',
                status.key === 'encoding' && 'bg-violet-400',
                status.key === 'overdue' && 'bg-red-500',
              )}
              style={{ width: `${status.progress}%` }}
            />
          </div>

          {/* Hover overlay */}
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

        <h3 className={cn('mt-2.5 text-sm font-semibold line-clamp-2 transition-colors', status.textClass)}>
          {anime.title}
        </h3>
      </div>
    </AnimeCardContextMenu>
  );
}

// ──────────────────────────────────────────────────────────────────────
// List row
// ──────────────────────────────────────────────────────────────────────
function PendingListRow({
  anime, index, canAccess, daysInQueue, onClick,
}: {
  anime: AnimeWithoutEpisodes; index: number; canAccess: boolean; daysInQueue: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  const status = getPendingStatus(anime.created_at);
  const StatusIcon = status.Icon;

  return (
    <AnimeCardContextMenu animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
      <div
        onClick={onClick}
        className={cn(
          'group relative flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm cursor-pointer transition-all hover:bg-card/70 hover:border-border hover:-translate-y-0.5 ring-1 ring-transparent animate-fade-in',
          status.ringClass,
        )}
        style={{ animationDelay: `${Math.min(index * 25, 500)}ms` }}
      >
        {/* Thumbnail */}
        <div className="relative shrink-0 w-14 h-20 md:w-16 md:h-24 rounded-lg overflow-hidden bg-muted">
          {anime.cover_image ? (
            <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">No Image</div>
          )}
          <div className={cn('absolute inset-0 bg-gradient-to-t', status.glowClass)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div
              className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm', status.badgeClass)}
              onClick={(e) => e.stopPropagation()}
            >
              <StatusIcon className={cn('h-2.5 w-2.5', status.key === 'processing' && 'animate-spin')} />
              {status.label}
            </div>
            {anime.type && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-border/50 px-1.5 py-px rounded">
                {anime.type}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {daysInQueue === 0 ? 'Today' : `${daysInQueue}d`}
            </span>
          </div>
          <h3 className={cn('text-sm md:text-base font-semibold line-clamp-1 transition-colors', status.textClass)}>
            {anime.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative flex-1 h-1 rounded-full bg-muted/60 overflow-hidden max-w-[300px]">
              <div
                className={cn(
                  'h-full transition-all duration-700',
                  status.key === 'queued' && 'bg-sky-400',
                  status.key === 'processing' && 'bg-amber-400',
                  status.key === 'encoding' && 'bg-violet-400',
                  status.key === 'overdue' && 'bg-red-500',
                )}
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
              <Timer className="h-2.5 w-2.5 inline mr-0.5" />{status.remaining}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          {canAccess ? (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 group-hover:border-amber-500/50 group-hover:text-amber-300">
              <Pencil className="h-3 w-3" />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Continue</span>
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-8 gap-1.5">
              <AlertCircle className="h-3 w-3" />
              <span className="hidden sm:inline text-xs">Details</span>
            </Button>
          )}
        </div>
      </div>
    </AnimeCardContextMenu>
  );
}
