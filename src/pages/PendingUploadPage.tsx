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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
      badgeClass: 'pending-status',
      ringClass: 'ring-border',
      textClass: 'text-foreground',
      glowClass: '',
      Icon: Clock,
    };
  }
  if (ageHours < 72) {
    return {
      key: 'processing', label: 'Processing',
      description: 'Episodes are being prepared — multi-audio sync and subtitle timing in progress.',
      remaining: formatRemaining(remainingHours), progress,
      badgeClass: 'pending-status',
      ringClass: 'ring-border',
      textClass: 'text-foreground',
      glowClass: '',
      Icon: Loader2,
    };
  }
  if (ageHours < SLA_HOURS) {
    return {
      key: 'encoding', label: 'Encoding',
      description: 'Adaptive HLS conversion (480p → 4K) underway. Larger seasons take longer.',
      remaining: formatRemaining(SLA_HOURS - ageHours), progress,
      badgeClass: 'pending-status',
      ringClass: 'ring-border',
      textClass: 'text-foreground',
      glowClass: '',
      Icon: FileVideo,
    };
  }
  return {
    key: 'overdue', label: 'Overdue',
    description: 'Past expected delivery window. Flagged for the team to review and prioritise.',
    remaining: 'Needs review', progress: 100,
    badgeClass: 'pending-status',
    ringClass: 'ring-border',
    textClass: 'text-foreground',
    glowClass: '',
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
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="pending-details-v11 utility-glass-v6 block rounded-lg max-w-md w-[calc(100%-2rem)] p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogTitle className="font-heading text-xl font-bold">Episodes Coming Soon</DialogTitle>
      <DialogDescription className="mt-2">{animeTitle}</DialogDescription>
      <ol className="divide-y divide-border mt-4">{['Upload queue', 'Audio + E-sub check', 'HLS encoding', 'Server deployment', 'Quality assurance'].map(stage => <li key={stage} className="py-3 text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{stage}</li>)}</ol>
      <Button onClick={onClose} className="mt-4 w-full">Close</Button>
    </DialogContent>
  </Dialog>;
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
  { key: 'all', label: 'All', tone: '' },
  { key: 'queued', label: 'Queued', tone: '' },
  { key: 'processing', label: 'Processing', tone: '' },
  { key: 'encoding', label: 'Encoding', tone: '' },
  { key: 'overdue', label: 'Overdue', tone: '' },
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

  if (isRolesLoaded && !canAccess) return <div className="container py-20 text-center">
    <Lock className="mx-auto h-8 w-8 text-destructive mb-4" /><h1 className="text-2xl font-bold">Access Restricted</h1>
    <p className="text-muted-foreground mt-2 mb-5">This page is only accessible to uploaders and administrators.</p><Button asChild><Link to="/browse">Go to Browse</Link></Button>
  </div>;

  return <div className="min-h-screen pending-v2">
    <ContentNavTabs />
    <NoEpisodesPopup isOpen={noEpisodesPopup.isOpen} onClose={() => setNoEpisodesPopup({ isOpen: false, animeTitle: '' })} animeTitle={noEpisodesPopup.animeTitle} />
    <section className="border-b border-border">
      <div className="container py-6 md:py-8">
        <div className="flex justify-between items-center gap-3">
          <div><span className="text-xs text-primary flex items-center gap-2 mb-2"><Hourglass className="h-3.5 w-3.5" />Upload queue</span><h1 className="font-heading text-2xl md:text-3xl font-bold">Pending Upload</h1></div>
          <div className="flex items-center gap-2"><span className="hidden sm:inline text-xs text-muted-foreground">Live sync</span><Button variant="outline" size="icon" onClick={fetchAnimeWithoutEpisodes} disabled={refreshing} aria-label="Refresh pending uploads" className="catalogue-glass h-9 w-9"><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 mt-6 border-y border-border divide-x divide-border">
          {[{label:'Total pending',value:animeList.length,Icon:ListChecks},{label:'Queued',value:statusCounts.queued,Icon:Clock},{label:'Processing',value:statusCounts.processing,Icon:Loader2},{label:'Encoding',value:statusCounts.encoding,Icon:FileVideo},{label:'Overdue',value:statusCounts.overdue,Icon:AlertCircle}].map(stat => <div key={stat.label} className="py-4 px-3"><div className="text-xs text-muted-foreground flex items-center gap-1.5"><stat.Icon className="h-3.5 w-3.5" />{stat.label}</div><p className="text-2xl font-semibold tabular-nums mt-1">{isLoading ? '—' : stat.value}</p></div>)}
        </div>
        {animeList.length > 0 && <div className="flex justify-between gap-2 text-[11px] text-muted-foreground mt-3"><span>7-day preparation window</span><span>Oldest in queue · {oldestDays}d</span></div>}
      </div>
    </section>
    <div className="container py-5 md:py-6">
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input aria-label="Search pending titles" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pending titles…" className="pl-9 catalogue-glass" /></div>
        <div className="flex gap-1 overflow-x-auto max-w-full" role="group" aria-label="Upload status filters">{FILTERS.map(f => <Button key={f.key} size="sm" variant={filter === f.key ? 'secondary' : 'ghost'} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className="h-8 text-xs shrink-0 gap-1.5">{f.label}<span className="text-muted-foreground tabular-nums">{f.key === 'all' ? animeList.length : statusCounts[f.key]}</span></Button>)}</div>
        <div className="flex ml-auto gap-1"><Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')} className="h-8 w-8"><LayoutGrid className="h-4 w-4" /></Button><Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')} className="h-8 w-8"><Rows3 className="h-4 w-4" /></Button></div>
      </div>
      {isLoading ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{Array.from({length:10},(_,i) => <Skeleton key={i} className="h-72 rounded-lg" />)}</div> : filtered.length === 0 ? <div className="text-center py-16"><Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" /><h2 className="font-heading text-xl font-semibold">{animeList.length === 0 ? 'All Caught Up!' : 'No matches'}</h2><p className="text-sm text-muted-foreground mt-2 mb-4">{animeList.length === 0 ? 'No titles are waiting for episodes.' : 'No titles match these filters.'}</p>{animeList.length === 0 ? <Button asChild><Link to="/upload">Upload New Anime</Link></Button> : <Button variant="outline" onClick={() => {setSearch('');setFilter('all');}}>Clear filters</Button>}</div> : <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4' : 'space-y-3'}>
        {filtered.map(anime => <PendingTile key={anime.id} anime={anime} list={view === 'list'} daysInQueue={daysSince(anime.created_at)} onClick={e => handleAnimeClick(anime,e)} />)}
      </div>}
    </div>
  </div>;
}

function PendingTile({anime, list, daysInQueue, onClick}: {anime: AnimeWithoutEpisodes; list: boolean; daysInQueue: number; onClick: (e: React.MouseEvent) => void}) {
  const status = getPendingStatus(anime.created_at);
  return <AnimeCardContextMenu animeTitle={anime.title} animeUrl={`/anime/${anime.id}`} coverImage={anime.cover_image}>
    <article className={cn('catalogue-glass rounded-lg overflow-hidden', list && 'flex items-center')}>
      <Link to={`/upload/anime/${anime.id}`} onClick={onClick} className={cn('block relative bg-muted shrink-0', list ? 'w-16 h-24' : 'aspect-[2/3] w-full')} aria-label={`Continue uploading ${anime.title}`}>
        {anime.cover_image ? <img src={anime.cover_image} alt={anime.title} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-contain" /> : <FileVideo className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />}
        {!list && anime.type && <span className="catalogue-chip absolute left-2 top-2 rounded px-1.5 py-0.5 text-[9px] uppercase">{anime.type}</span>}
      </Link>
      <div className="p-3 min-w-0 flex-1">
        <span className={cn('pending-status inline-flex items-center gap-1.5 text-[10px] font-medium', `pending-status-${status.key}`)}><status.Icon className="h-3 w-3" />{status.label}</span>
        <h2 className="text-sm font-semibold line-clamp-2 min-h-10 mt-2">{anime.title}</h2>
        <div className="text-[10px] text-muted-foreground flex justify-between gap-2 mt-2"><span>{daysInQueue === 0 ? 'Added today' : `${daysInQueue}d in queue`}</span><span>{status.remaining}</span></div>
        <div className="h-1 bg-muted mt-3 rounded-full overflow-hidden"><div className="h-full bg-primary" style={{width:`${status.progress}%`}} /></div>
        <Button asChild variant="ghost" size="sm" className="w-full mt-2 h-8 text-xs gap-1.5"><Link to={`/upload/anime/${anime.id}`} onClick={onClick}><Pencil className="h-3 w-3" />Continue upload</Link></Button>
      </div>
    </article>
  </AnimeCardContextMenu>;
}
