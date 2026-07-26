import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import { ConversionHealthDashboard } from '@/components/admin/ConversionHealthDashboard';
import { TokenSaviDashboard } from '@/components/admin/TokenSaviDashboard';

import {
  Upload as UploadIcon,
  Plus,
  Trash2,
  Film,
  Edit,
  Eye,
  Wrench,
  Key,
  CalendarClock,
  Tv,
  Layers,
  Sparkles,
  Search as SearchIcon,
  Activity,
  ListVideo,
  Image as ImageIcon,
  Type as TypeIcon,
  Tag,
  Settings2,
  CheckCircle2,
  Youtube,
  Info,
  Mic,
} from 'lucide-react';
import { UpcomingCountdownDialog } from '@/components/home/UpcomingCountdownDialog';

const genres = ['Action', 'Adventure', 'Animation', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mysterious', 'Anime', 'Anime Series', 'Hindi', 'English', 'Tamil', 'Telugu', 'Japanese', 'Crunchyroll', 'Muse India', 'Sony YAY', 'Amazon Prime'];

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  status: string | null;
  type: string | null;
  created_at: string;
  release_year: number | null;
  studio: string | null;
  total_episodes: number | null;
}

interface Season {
  id: string;
  season_number: number;
  title: string | null;
  anime_id: string;
}

export default function Upload() {
  const { user, isUploader, isAdmin, isRolesLoaded, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [myAnime, setMyAnime] = useState<Anime[]>([]);
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('my-anime');
  const [animeSearchQuery, setAnimeSearchQuery] = useState('');

  // Form state for new anime
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [releaseYear, setReleaseYear] = useState('');
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined);
  const [type, setType] = useState('series');
  const [status, setStatus] = useState('ongoing');
  const [isCrunchyroll, setIsCrunchyroll] = useState(false);
  const [isMuse, setIsMuse] = useState(false);
  const [isEngDub, setIsEngDub] = useState(false);
  const [studio, setStudio] = useState('');
  const [totalEpisodes, setTotalEpisodes] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [contentRating, setContentRating] = useState('');
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);

  const handleFetchMetadata = async () => {
    if (!title.trim()) {
      toast.error('Enter the anime title first');
      return;
    }
    setIsFetchingMeta(true);
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title.trim())}&limit=1&sfw=false`);
      const json = await res.json();
      const a = json?.data?.[0];
      if (!a) {
        toast.error('No match found on MyAnimeList');
        return;
      }
      const studioName = a.studios?.[0]?.name || '';
      const sourceMap: Record<string, string> = {
        Manga: 'Manga', 'Light novel': 'Light Novel', 'Web novel': 'Web Novel',
        Manhwa: 'Manhwa', Original: 'Original', Game: 'Game', 'Visual novel': 'Visual Novel',
      };
      const ratingMap: Record<string, string> = {
        'G - All Ages': 'G', 'PG - Children': 'PG', 'PG-13 - Teens 13 or older': 'PG-13',
        'R - 17+ (violence & profanity)': 'R', 'R+ - Mild Nudity': 'R+', 'Rx - Hentai': 'R+',
      };
      if (studioName) setStudio(studioName);
      if (a.episodes) setTotalEpisodes(String(a.episodes));
      if (a.source && sourceMap[a.source]) setSourceMaterial(sourceMap[a.source]);
      if (a.rating && ratingMap[a.rating]) setContentRating(ratingMap[a.rating]);
      if (a.year && !releaseYear) setReleaseYear(String(a.year));
      if (a.synopsis && !description) setDescription(a.synopsis);
      toast.success('Metadata fetched', { description: `Matched: ${a.title}` });
    } catch (err: any) {
      toast.error('Failed to fetch metadata', { description: err.message });
    } finally {
      setIsFetchingMeta(false);
    }
  };

  // Existing upload state
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeDescription, setEpisodeDescription] = useState('');
  const [episodeVideoUrl, setEpisodeVideoUrl] = useState('');
  const [episodeThumbnail, setEpisodeThumbnail] = useState('');
  const [episodeDuration, setEpisodeDuration] = useState('');
  const [isAddingEpisode, setIsAddingEpisode] = useState(false);

  // Check if user can upload based on server-validated roles
  const canUpload = () => {
    return isUploader || isAdmin;
  };

  const isAuthReady = !isAuthLoading && isRolesLoaded;

  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (!canUpload() && !isUploader) {
      toast.error('You are not authorized to upload. Only specific accounts can upload anime.');
      navigate('/');
      return;
    }

    fetchAnimeData();
  }, [isAuthReady, user, isUploader, navigate]);

  useEffect(() => {
    if (selectedAnimeId) {
      fetchSeasons(selectedAnimeId);
    } else {
      setSeasons([]);
      setSelectedSeasonId('');
    }
  }, [selectedAnimeId]);

  const fetchAnimeData = async () => {
    setIsLoading(true);
    try {
      // Fetch user's anime if logged in
      if (user) {
        const { data, error } = await supabase
          .from('anime')
          .select('*')
          .eq('uploader_id', user.id)
          .order('created_at', { ascending: false }); // Always show newest first

        if (error) {
          console.error('Error fetching my anime:', error);
          toast.error('Failed to load your uploads');
        } else if (data) {
          setMyAnime(data);
        }
      }

      // Fetch all anime for "Existing Upload" option
      const { data: allData, error: allError } = await supabase
        .from('anime')
        .select('*')
        .order('title');

      if (allError) {
        console.error('Error fetching all anime:', allError);
        toast.error('Failed to load anime list');
      } else if (allData) {
        setAllAnime(allData);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load upload dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSeasons = async (animeId: string) => {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('anime_id', animeId)
      .order('season_number');

    if (data) {
      setSeasons(data);
      if (data.length > 0) {
        setSelectedSeasonId(data[0].id);
      }
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => {
      const updated = prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre];
      // Auto-set MUSE/Crunchy flags based on genre selection
      if (genre === 'Muse India') {
        setIsMuse(updated.includes('Muse India'));
      }
      if (genre === 'Crunchyroll') {
        setIsCrunchyroll(updated.includes('Crunchyroll'));
      }
      return updated;
    });
  };

  const handleSubmitAnime = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthReady) return;

    if (!user) {
      toast.error('Please sign in first');
      navigate('/auth');
      return;
    }

    if (!canUpload() && !isUploader) {
      toast.error('You are not authorized to upload.');
      return;
    }

    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);

    const yearToStore = status === 'upcoming' && releaseDate 
      ? releaseDate.getFullYear() 
      : (releaseYear ? parseInt(releaseYear) : null);

    const { data, error } = await supabase
      .from('anime')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        cover_image: coverImage.trim() || null,
        banner_image: bannerImage.trim() || null,
        trailer_url: trailerUrl.trim() || null,
        genres: selectedGenres.length > 0 ? selectedGenres : null,
        release_year: yearToStore,
        type,
        status,
        uploader_id: user.id,
        is_crunchyroll: isCrunchyroll,
        is_muse: isMuse,
        is_eng_dub: isEngDub,
        studio: studio.trim() || null,
        total_episodes: totalEpisodes ? parseInt(totalEpisodes) : null,
        source_material: sourceMaterial || null,
        content_rating: contentRating || null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating anime:', error);
      toast.error('Failed to create anime');
    } else {
      toast.success('Anime created successfully!');
      // Reset form
      setTitle('');
      setDescription('');
      setCoverImage('');
      setBannerImage('');
      setTrailerUrl('');
      setSelectedGenres([]);
      setReleaseYear('');
      setReleaseDate(undefined);
      setType('series');
      setStatus('ongoing');
      setStudio('');
      setTotalEpisodes('');
      setSourceMaterial('');
      setContentRating('');
      // Refresh list
      fetchAnimeData();
      // Navigate to add episodes
      navigate(`/upload/anime/${data.id}`);
    }

    setIsSubmitting(false);
  };

  const handleAddEpisodeToExisting = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSeasonId || !episodeTitle.trim()) {
      toast.error('Please select a season and enter episode title');
      return;
    }

    setIsAddingEpisode(true);

    // Get next episode number
    const { data: existingEpisodes } = await supabase
      .from('episodes')
      .select('episode_number')
      .eq('season_id', selectedSeasonId)
      .order('episode_number', { ascending: false })
      .limit(1);

    const nextEpisodeNumber = existingEpisodes && existingEpisodes.length > 0 
      ? existingEpisodes[0].episode_number + 1 
      : 1;

    const { data: inserted, error } = await supabase
      .from('episodes')
      .insert({
        season_id: selectedSeasonId,
        episode_number: nextEpisodeNumber,
        title: episodeTitle.trim(),
        description: episodeDescription.trim() || null,
        video_url: episodeVideoUrl.trim() || null,
        thumbnail: episodeThumbnail.trim() || null,
        duration: episodeDuration ? parseInt(episodeDuration) : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error adding episode:', error);
      toast.error('Failed to add episode');
    } else {
      toast.success(`Episode ${nextEpisodeNumber} added successfully!`);
      // Fire-and-forget AI recap generation so the recap is ready before
      // the first viewer opens the episode.
      if (inserted?.id) {
        supabase.functions
          .invoke('generate-episode-recap', { body: { episode_id: inserted.id } })
          .catch((e) => console.warn('[recap] auto-generate failed', e));
      }
      // Reset form
      setEpisodeTitle('');
      setEpisodeDescription('');
      setEpisodeVideoUrl('');
      setEpisodeThumbnail('');
      setEpisodeDuration('');
    }

    setIsAddingEpisode(false);
  };

  const handleDeleteAnime = async (animeId: string) => {
    if (!confirm('Are you sure you want to delete this anime? This will also delete all seasons and episodes.')) {
      return;
    }

    const { error } = await supabase.from('anime').delete().eq('id', animeId);

    if (error) {
      toast.error('Failed to delete anime');
    } else {
      toast.success('Anime deleted');
      fetchAnimeData();
    }
  };

  if (isLoading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Quick metrics
  const seriesCount = myAnime.filter(a => a.type !== 'movie' && a.status !== 'upcoming').length;
  const moviesCount = myAnime.filter(a => a.type === 'movie' && a.status !== 'upcoming').length;
  const upcomingCount = (isAdmin ? allAnime : myAnime).filter(a => a.status === 'upcoming').length;
  const ongoingCount = myAnime.filter(a => a.status === 'ongoing').length;

  // Last upload (most recent)
  const lastUpload = [...myAnime]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
  const lastUploadAgoMs = lastUpload?.created_at ? Date.now() - new Date(lastUpload.created_at).getTime() : null;
  const lastUploadLabel = lastUploadAgoMs == null
    ? 'No uploads yet'
    : lastUploadAgoMs < 3_600_000
    ? `${Math.max(1, Math.floor(lastUploadAgoMs / 60_000))}m ago`
    : lastUploadAgoMs < 86_400_000
    ? `${Math.floor(lastUploadAgoMs / 3_600_000)}h ago`
    : `${Math.floor(lastUploadAgoMs / 86_400_000)}d ago`;

  return (
    <div className="min-h-screen upload-glass relative">
      <div className="upload-aurora" aria-hidden />

      {/* Cinematic dashboard hero */}
      <div className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-purple-500/5 to-transparent" />
        <div className="absolute -top-24 right-1/4 w-[28rem] h-[28rem] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute -top-12 left-1/3 w-[20rem] h-[20rem] bg-pink-500/15 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--background)),transparent_70%)]" />
        {/* Subtle scan line */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 1px, transparent 1px, transparent 4px)',
          }}
        />

        <div className="container relative px-4 pt-7 pb-9">
          <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-7">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
              <div className="relative flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary via-pink-500 to-purple-500 shadow-2xl">
                <UploadIcon className="h-7 w-7 md:h-9 md:w-9 text-white" />
              </div>
              {/* Live status dot */}
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-background" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Creator Studio</span>
                </div>
                {isAdmin && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                    <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest">Admin Mode</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">Pipeline Online</span>
                </div>
              </div>
              <h1 className="text-3xl md:text-5xl font-heading font-black tracking-tight leading-none">
                <span className="anime-gradient-text">Upload</span> Dashboard
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">
                Manage your library, publish new titles, and monitor encoding pipelines from one place.
              </p>

              {/* Stat tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 max-w-2xl">
                {[
                  { icon: Tv, value: seriesCount, label: 'Series', tone: 'from-sky-500/15 to-sky-500/0 text-sky-400 border-sky-500/25' },
                  { icon: Film, value: moviesCount, label: 'Movies', tone: 'from-violet-500/15 to-violet-500/0 text-violet-400 border-violet-500/25' },
                  { icon: Activity, value: ongoingCount, label: 'Ongoing', tone: 'from-emerald-500/15 to-emerald-500/0 text-emerald-400 border-emerald-500/25' },
                  { icon: CalendarClock, value: upcomingCount, label: 'Upcoming', tone: 'from-orange-500/15 to-orange-500/0 text-orange-400 border-orange-500/25' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${s.tone} border backdrop-blur-sm p-3 hover:scale-[1.02] transition-transform`}
                  >
                    <div className="flex items-center justify-between">
                      <s.icon className={`h-4 w-4 ${s.tone.split(' ').find(c => c.startsWith('text-'))}`} />
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">
                        {s.label}
                      </span>
                    </div>
                    <div className="mt-1.5 text-2xl font-black tabular-nums leading-none">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity row */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3 w-3 text-emerald-400" />
                  <span>Last upload: <span className="font-semibold text-foreground">{lastUploadLabel}</span></span>
                </div>
                {lastUpload && (
                  <div className="flex items-center gap-1.5">
                    <Tv className="h-3 w-3 text-primary" />
                    <span className="truncate max-w-[200px]">{lastUpload.title}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Cinematic tab strip */}
          <div className="overflow-x-auto -mx-4 px-4 pb-1">
            <TabsList className="bg-card/60 backdrop-blur-sm border border-border/40 p-1 rounded-2xl flex flex-nowrap gap-1 w-fit">
              <TabsTrigger value="my-anime" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                <Tv className="h-3.5 w-3.5" /> My Series
              </TabsTrigger>
              <TabsTrigger value="my-movies" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                <Film className="h-3.5 w-3.5" /> My Movies
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                <Plus className="h-3.5 w-3.5" /> Add Series
              </TabsTrigger>
              <TabsTrigger value="new-movie" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
                <Film className="h-3.5 w-3.5" /> Add Movie
              </TabsTrigger>
              <TabsTrigger value="tools" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                <Wrench className="h-3.5 w-3.5" /> Tools
              </TabsTrigger>
              <TabsTrigger value="token-savi" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                <Key className="h-3.5 w-3.5" /> Token.Savi
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg">
                <CalendarClock className="h-3.5 w-3.5" /> Upcoming
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="my-anime" className="space-y-4">
            {/* Section header + search */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b from-sky-400 to-blue-500" />
                <div>
                  <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
                    My Anime Series
                    <span className="text-xs font-bold text-muted-foreground">({seriesCount})</span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground">Manage uploaded series, episodes & metadata</p>
                </div>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search series..."
                  value={animeSearchQuery}
                  onChange={(e) => setAnimeSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-card/60 border-border/40 rounded-xl"
                />
              </div>
            </div>
          {(() => {
            const filteredAnime = myAnime.filter(a => a.type !== 'movie' && a.status !== 'upcoming' && a.title.toLowerCase().includes(animeSearchQuery.toLowerCase()));
            return filteredAnime.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 py-14 text-center">
                <div className="relative w-fit mx-auto mb-3">
                  <div className="absolute inset-0 bg-sky-500/30 blur-2xl rounded-full" />
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-2xl">
                    <Tv className="h-6 w-6 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-1">No anime series yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Start by adding your first anime series</p>
                <Button onClick={() => setActiveTab('new')} className="bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:opacity-90">
                  <Plus className="h-4 w-4 mr-1.5" /> Add New Series
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAnime.map((anime) => (
                  <div
                    key={anime.id}
                    className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-300"
                  >
                    {/* Blurred backdrop */}
                    {anime.cover_image && (
                      <div
                        className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                        style={{
                          backgroundImage: `url(${anime.cover_image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: 'blur(20px)',
                        }}
                      />
                    )}
                    <div className="relative flex gap-3 p-3">
                      <div className="relative w-20 h-28 shrink-0 rounded-xl overflow-hidden ring-1 ring-border/50 group-hover:ring-sky-500/50 transition-all">
                        <img
                          src={anime.cover_image || '/placeholder.svg'}
                          alt={anime.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {anime.type && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[8px] font-black uppercase text-white">
                            {anime.type}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <h3 className="font-bold text-sm line-clamp-2 group-hover:text-sky-400 transition-colors">{anime.title}</h3>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            anime.status === 'ongoing' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                            anime.status === 'completed' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' :
                            'bg-muted text-muted-foreground border border-border/50'
                          }`}>
                            {anime.status}
                          </span>
                          {anime.total_episodes != null && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-0.5">
                              <ListVideo className="h-2.5 w-2.5" />{anime.total_episodes}EP
                            </span>
                          )}
                          {anime.release_year && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border/50">
                              {anime.release_year}
                            </span>
                          )}
                        </div>
                        {anime.studio && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">🎬 {anime.studio}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-auto">Added {new Date(anime.created_at).toLocaleDateString()}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <Button variant="outline" size="sm" asChild className="h-7 text-[10px] flex-1 px-2">
                            <a href={`/anime/${anime.id}`} target="_blank" rel="noopener">
                              <Eye className="h-3 w-3 mr-0.5" /> View
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild className="h-7 text-[10px] flex-1 px-2 border-sky-500/40 text-sky-400 hover:bg-sky-500/10">
                            <a href={`/upload/anime/${anime.id}`}>
                              <Edit className="h-3 w-3 mr-0.5" /> Edit
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => handleDeleteAnime(anime.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </TabsContent>

        {/* My Movies Tab */}
        <TabsContent value="my-movies" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-500" />
            <div>
              <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
                My Movies
                <span className="text-xs font-bold text-muted-foreground">({moviesCount})</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Standalone film uploads & feature releases</p>
            </div>
          </div>

          {myAnime.filter(a => a.type === 'movie' && a.status !== 'upcoming').length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 py-14 text-center">
              <div className="relative w-fit mx-auto mb-3">
                <div className="absolute inset-0 bg-violet-500/30 blur-2xl rounded-full" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl">
                  <Film className="h-6 w-6 text-white" />
                </div>
              </div>
              <h3 className="text-lg font-bold mb-1">No movies yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Upload your first feature film</p>
              <Button onClick={() => setActiveTab('new-movie')} className="bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:opacity-90">
                <Plus className="h-4 w-4 mr-1.5" /> Add New Movie
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAnime.filter(a => a.type === 'movie' && a.status !== 'upcoming').map((anime) => (
                <div
                  key={anime.id}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300"
                >
                  {anime.cover_image && (
                    <div
                      className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                      style={{
                        backgroundImage: `url(${anime.cover_image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(20px)',
                      }}
                    />
                  )}
                  <div className="relative flex gap-3 p-3">
                    <div className="relative w-20 h-28 shrink-0 rounded-xl overflow-hidden ring-1 ring-border/50 group-hover:ring-violet-500/50 transition-all">
                      <img
                        src={anime.cover_image || '/placeholder.svg'}
                        alt={anime.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-[8px] font-black uppercase text-white shadow-md">
                        Movie
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <h3 className="font-bold text-sm line-clamp-2 group-hover:text-violet-400 transition-colors">{anime.title}</h3>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          anime.status === 'completed' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' :
                          'bg-muted text-muted-foreground border border-border/50'
                        }`}>
                          {anime.status}
                        </span>
                        {anime.release_year && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border/50">
                            {anime.release_year}
                          </span>
                        )}
                      </div>
                      {anime.studio && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">🎬 {anime.studio}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-auto">Added {new Date(anime.created_at).toLocaleDateString()}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <Button variant="outline" size="sm" asChild className="h-7 text-[10px] flex-1 px-2">
                          <a href={`/anime/${anime.id}`} target="_blank" rel="noopener">
                            <Eye className="h-3 w-3 mr-0.5" /> View
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="h-7 text-[10px] flex-1 px-2 border-violet-500/40 text-violet-400 hover:bg-violet-500/10">
                          <a href={`/upload/anime/${anime.id}`}>
                            <Edit className="h-3 w-3 mr-0.5" /> Edit
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleDeleteAnime(anime.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="space-y-5">
          {/* Hero header */}
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/15 via-pink-500/10 to-purple-500/15 p-5 md:p-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                <Film className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl md:text-2xl font-heading font-black tracking-tight">Add New Anime Series</h2>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  Build a cinematic series entry. Auto-fill from MyAnimeList, then fine-tune metadata and artwork.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">STEP 1 · Series</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40">STEP 2 · Episodes</span>
                </div>
              </div>
            </div>
          </div>

          <Card className="bg-card/60 backdrop-blur-sm border-border/40 rounded-2xl overflow-hidden">
            <div className="h-[3px] bg-gradient-to-r from-primary via-pink-500 to-purple-500" />
            <CardContent className="p-5 md:p-7">
              <form onSubmit={handleSubmitAnime} className="space-y-7">

                {/* SECTION 1 — IDENTITY */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                      <TypeIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Identity</h3>
                      <p className="text-[10px] text-muted-foreground">Title, year & synopsis</p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                      <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title <span className="text-primary">*</span></Label>
                      <Input
                        id="title"
                        placeholder="e.g. Solo Leveling"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="h-11 bg-muted/40 border-border/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="releaseYear" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {status === 'upcoming' ? 'Release Date' : 'Release Year'}
                      </Label>
                      {status === 'upcoming' ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="h-11 w-full justify-start text-left font-normal bg-muted/40 border-border/50"
                            >
                              <CalendarClock className="h-4 w-4 mr-2 text-primary" />
                              {releaseDate ? format(releaseDate, 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={releaseDate}
                              onSelect={setReleaseDate}
                              disabled={(date) => date < new Date() || date.getFullYear() > 2037}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Input
                          id="releaseYear"
                          type="number"
                          placeholder="2024"
                          value={releaseYear}
                          onChange={(e) => setReleaseYear(e.target.value)}
                          min="1900"
                          max={new Date().getFullYear()}
                          className="h-11 bg-muted/40 border-border/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Synopsis</Label>
                    <Textarea
                      id="description"
                      placeholder="A brief, spoiler-free description that hooks the viewer…"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[110px] bg-muted/40 border-border/50 focus-visible:border-primary/60 focus-visible:ring-primary/20 resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                      <Info className="h-3 w-3" /> 1–3 short sentences work best for hero cards.
                    </p>
                  </div>
                </section>

                {/* SECTION 2 — ARTWORK */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/25 flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Artwork</h3>
                      <p className="text-[10px] text-muted-foreground">Cover (2:3) & Banner (16:9)</p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                      <FileUploadInput
                        label="Cover Image"
                        accept="image"
                        value={coverImage}
                        onChange={setCoverImage}
                        folder="covers"
                        placeholder="https://example.com/cover.jpg"
                      />
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                      <FileUploadInput
                        label="Banner Image"
                        accept="image"
                        value={bannerImage}
                        onChange={setBannerImage}
                        folder="banners"
                        placeholder="https://example.com/banner.jpg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="trailerUrl" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Youtube className="h-3.5 w-3.5 text-red-500" /> Trailer URL <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="trailerUrl"
                      placeholder="https://youtube.com/watch?v=…  or direct video URL"
                      value={trailerUrl}
                      onChange={(e) => setTrailerUrl(e.target.value)}
                      className="h-11 bg-muted/40 border-border/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
                    />
                  </div>
                </section>

                {/* SECTION 3 — METADATA */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                      <Settings2 className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Metadata</h3>
                      <p className="text-[10px] text-muted-foreground">Type, status, studio & rating</p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>

                  {/* Auto-fill banner — premium */}
                  <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-3.5">
                    <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
                    <div className="relative flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-amber-400">Auto-fill from MyAnimeList</p>
                          <p className="text-[11px] text-muted-foreground">Pull studio, episodes, source & rating from the title.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleFetchMetadata}
                        disabled={isFetchingMeta}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white border-0 shadow-md shadow-amber-500/20 gap-1.5"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        {isFetchingMeta ? 'Fetching…' : 'Fetch metadata'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="h-11 bg-muted/40 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="series">TV Series</SelectItem>
                          <SelectItem value="movie">Movie</SelectItem>
                          <SelectItem value="ova">OVA</SelectItem>
                          <SelectItem value="special">Special</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="h-11 bg-muted/40 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="studio" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Studio</Label>
                      <Input
                        id="studio"
                        placeholder="e.g. MAPPA, Ufotable"
                        value={studio}
                        onChange={(e) => setStudio(e.target.value)}
                        className="h-11 bg-muted/40 border-border/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="totalEpisodes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Episodes</Label>
                      <Input
                        id="totalEpisodes"
                        type="number"
                        placeholder="e.g. 12"
                        value={totalEpisodes}
                        onChange={(e) => setTotalEpisodes(e.target.value)}
                        min="1"
                        className="h-11 bg-muted/40 border-border/50 focus-visible:border-primary/60 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source Material</Label>
                      <Select value={sourceMaterial} onValueChange={setSourceMaterial}>
                        <SelectTrigger className="h-11 bg-muted/40 border-border/50">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Manga">Manga</SelectItem>
                          <SelectItem value="Light Novel">Light Novel</SelectItem>
                          <SelectItem value="Web Novel">Web Novel</SelectItem>
                          <SelectItem value="Manhwa">Manhwa</SelectItem>
                          <SelectItem value="Original">Original</SelectItem>
                          <SelectItem value="Game">Game</SelectItem>
                          <SelectItem value="Visual Novel">Visual Novel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content Rating</Label>
                      <Select value={contentRating} onValueChange={setContentRating}>
                        <SelectTrigger className="h-11 bg-muted/40 border-border/50">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="G">G – All Ages</SelectItem>
                          <SelectItem value="PG">PG – Children</SelectItem>
                          <SelectItem value="PG-13">PG-13 – Teens</SelectItem>
                          <SelectItem value="R">R – 17+</SelectItem>
                          <SelectItem value="R+">R+ – Mild Nudity</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                {/* SECTION 4 — GENRES */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                      <Tag className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Genres & Tags</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedGenres.length} selected
                      </p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5">
                    <div className="flex flex-wrap gap-2">
                      {genres.map((genre) => {
                        const active = selectedGenres.includes(genre);
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => toggleGenre(genre)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                              active
                                ? 'bg-gradient-to-r from-primary to-pink-500 text-white border border-primary/40 shadow-md shadow-primary/20 scale-105'
                                : 'bg-muted/60 text-muted-foreground border border-border/50 hover:border-primary/40 hover:text-foreground'
                            }`}
                          >
                            {active && '✓ '}{genre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* SECTION 5 — DISTRIBUTION */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <Layers className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Distribution</h3>
                      <p className="text-[10px] text-muted-foreground">Pin to special collections</p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    <label
                      htmlFor="is_crunchyroll"
                      className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isCrunchyroll
                          ? 'border-orange-500/50 bg-orange-500/10 shadow-md shadow-orange-500/10'
                          : 'border-border/40 bg-muted/20 hover:border-orange-500/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isCrunchyroll ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow' : 'bg-muted/60 text-muted-foreground'
                      }`}>
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">Add to Crunchy Tab</p>
                        <p className="text-[10px] text-muted-foreground">Show in the Crunchyroll collection</p>
                      </div>
                      <input
                        type="checkbox"
                        id="is_crunchyroll"
                        checked={isCrunchyroll}
                        onChange={(e) => setIsCrunchyroll(e.target.checked)}
                        className="sr-only"
                      />
                      {isCrunchyroll && <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0" />}
                    </label>

                    <label
                      htmlFor="is_muse"
                      className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isMuse
                          ? 'border-cyan-500/50 bg-cyan-500/10 shadow-md shadow-cyan-500/10'
                          : 'border-border/40 bg-muted/20 hover:border-cyan-500/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isMuse ? 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow' : 'bg-muted/60 text-muted-foreground'
                      }`}>
                        <Tv className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">Add to MUSE</p>
                        <p className="text-[10px] text-muted-foreground">Surface on the MuseIN listing page</p>
                      </div>
                      <input
                        type="checkbox"
                        id="is_muse"
                        checked={isMuse}
                        onChange={(e) => setIsMuse(e.target.checked)}
                        className="sr-only"
                      />
                      {isMuse && <CheckCircle2 className="h-5 w-5 text-cyan-400 shrink-0" />}
                    </label>

                    <label
                      htmlFor="is_eng_dub"
                      className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isEngDub
                          ? 'border-indigo-400/60 bg-indigo-500/10 shadow-md shadow-indigo-500/10'
                          : 'border-border/40 bg-muted/20 hover:border-indigo-400/40'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isEngDub ? 'bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow' : 'bg-muted/60 text-muted-foreground'
                      }`}>
                        <Mic className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">Add to ENG DUB</p>
                        <p className="text-[10px] text-muted-foreground">Show on the English Dub tab</p>
                      </div>
                      <input
                        type="checkbox"
                        id="is_eng_dub"
                        checked={isEngDub}
                        onChange={(e) => setIsEngDub(e.target.checked)}
                        className="sr-only"
                      />
                      {isEngDub && <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />}
                    </label>
                  </div>
                </section>

                {/* SUBMIT */}
                <div className="sticky bottom-0 -mx-5 md:-mx-7 -mb-5 md:-mb-7 px-5 md:px-7 py-4 bg-gradient-to-t from-card via-card/95 to-card/80 backdrop-blur-md border-t border-border/40 mt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 text-sm font-bold bg-gradient-to-r from-primary via-pink-500 to-purple-500 hover:opacity-95 text-white shadow-lg shadow-primary/30 border-0 gap-2"
                  >
                    {isSubmitting ? (
                      <>Creating…</>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Create Anime & Continue to Episodes
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
                    Next, you'll be able to add episodes, video files & subtitles.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add New Movie Tab - Only Movie, Thumbnail, Banner, Description */}
        <TabsContent value="new-movie" className="space-y-5 pb-24">
          {/* Hero header */}
          <div className="relative overflow-hidden rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-600/15 via-indigo-600/8 to-violet-600/15 p-5">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-600/25 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-indigo-600/25 blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-600 flex items-center justify-center shadow-xl shadow-purple-600/40 ring-1 ring-white/20">
                <Film className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl md:text-2xl font-heading font-black bg-gradient-to-r from-purple-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">Add New Movie</h2>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase tracking-wider">Cinematic</span>
                </div>
                <p className="text-xs text-muted-foreground">Single feature film — no seasons or episodes required. One-shot upload.</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300/80">
                  <Sparkles className="h-3 w-3" /> One step · Auto-published
                </div>
              </div>
            </div>
          </div>

          <Card className="bg-card/60 backdrop-blur-sm border-border/40 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600" />
            <CardContent className="p-4 md:p-6">
              <form className="space-y-7">
                {/* SECTION 1 — Identity */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                      <Film className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">Identity</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="movie-title" className="text-xs font-semibold">Movie Title *</Label>
                      <Input
                        id="movie-title"
                        placeholder="e.g. Your Name"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="bg-muted/50 h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="movie-releaseYear" className="text-xs font-semibold">
                        {status === 'upcoming' ? 'Release Date' : 'Release Year'}
                      </Label>
                      {status === 'upcoming' ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal bg-muted/50 h-10">
                              {releaseDate ? format(releaseDate, 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={releaseDate} onSelect={setReleaseDate} disabled={(date) => date < new Date() || date.getFullYear() > 2037} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Input id="movie-releaseYear" type="number" placeholder="2024" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} min="1900" max={2099} className="bg-muted/50 h-10" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="movie-description" className="text-xs font-semibold">Synopsis</Label>
                    <Textarea
                      id="movie-description"
                      placeholder="A brief description of the movie..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[100px] bg-muted/50 resize-none"
                    />
                  </div>
                </section>

                {/* SECTION 2 — Video File */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">Video File</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase tracking-wider">Required</span>
                    {episodeVideoUrl && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">✓ Ready</span>
                    )}
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>
                  <FileUploadInput
                    label="Movie Video *"
                    accept="video"
                    value={episodeVideoUrl}
                    onChange={setEpisodeVideoUrl}
                    folder="movies"
                    placeholder="https://example.com/movie.mp4"
                    contentType="movie"
                  />
                </section>

                {/* SECTION 3 — Artwork */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-violet-400" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">Artwork</h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FileUploadInput label="Cover (Poster)" accept="image" value={coverImage} onChange={setCoverImage} folder="covers" placeholder="https://example.com/cover.jpg" />
                    <FileUploadInput label="Banner (Wide)" accept="image" value={bannerImage} onChange={setBannerImage} folder="banners" placeholder="https://example.com/banner.jpg" />
                  </div>
                </section>

                {/* SECTION 4 — Genres */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">Genres</h3>
                    <span className="text-[10px] text-muted-foreground font-medium">{selectedGenres.length} selected</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {genres.map((genre) => {
                      const active = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                            active
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md shadow-purple-600/30 scale-105'
                              : 'bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border'
                          }`}
                        >
                          {active && '✓ '}{genre}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </form>
            </CardContent>
          </Card>

          {/* Sticky CTA */}
          <div className="sticky bottom-0 -mx-2 px-2 pt-3 pb-3 bg-gradient-to-t from-card via-card/95 to-card/0 backdrop-blur-md z-10">
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-purple-500/25 bg-card/80 backdrop-blur-md shadow-xl shadow-purple-900/20">
              <div className="hidden sm:flex flex-col flex-1 min-w-0">
                <span className="text-xs font-bold truncate">{title || 'Untitled Movie'}</span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span className={`flex items-center gap-1 ${title.trim() ? 'text-emerald-400' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${title.trim() ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} /> Title
                  </span>
                  <span className={`flex items-center gap-1 ${episodeVideoUrl ? 'text-emerald-400' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${episodeVideoUrl ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} /> Video
                  </span>
                  <span className={`flex items-center gap-1 ${coverImage ? 'text-emerald-400' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${coverImage ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} /> Cover
                  </span>
                  <span className={`flex items-center gap-1 ${selectedGenres.length > 0 ? 'text-emerald-400' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedGenres.length > 0 ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} /> {selectedGenres.length} genres
                  </span>
                </div>
              </div>
              <Button
                type="button"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-purple-600/30 hover:opacity-90 h-11 px-6"
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!title.trim()) {
                      toast.error('Title is required');
                      return;
                    }
                    setIsSubmitting(true);
                    
                    // Create movie entry
                    const { data: movieData, error: movieError } = await supabase
                      .from('anime')
                      .insert({
                        title: title.trim(),
                        description: description.trim() || null,
                        cover_image: coverImage.trim() || null,
                        banner_image: bannerImage.trim() || null,
                        genres: selectedGenres.length > 0 ? selectedGenres : null,
                        release_year: releaseYear ? parseInt(releaseYear) : null,
                        type: 'movie',
                        status: 'completed',
                        uploader_id: user?.id,
                      })
                      .select()
                      .single();
                    
                    if (movieError) {
                      toast.error('Failed to create movie');
                      setIsSubmitting(false);
                      return;
                    }
                    
                    // Create a default season for the movie
                    const { data: seasonData, error: seasonError } = await supabase
                      .from('seasons')
                      .insert({
                        anime_id: movieData.id,
                        season_number: 1,
                        title: 'Movie',
                      })
                      .select()
                      .single();
                    
                    if (seasonError) {
                      toast.error('Failed to create movie season');
                      setIsSubmitting(false);
                      return;
                    }
                    
                    // Create the movie episode with uploaded video
                    if (episodeVideoUrl) {
                      const { error: episodeError } = await supabase
                        .from('episodes')
                        .insert({
                          season_id: seasonData.id,
                          episode_number: 1,
                          title: title.trim(),
                          description: description.trim() || null,
                          video_url: episodeVideoUrl.trim(),
                          thumbnail: coverImage.trim() || null,
                        });
                      
                      if (episodeError) {
                        toast.error('Movie created but video upload failed');
                      }
                    }
                    
                    toast.success('Movie created successfully!');
                    // Reset form
                    setTitle('');
                    setDescription('');
                    setCoverImage('');
                    setBannerImage('');
                    setSelectedGenres([]);
                    setReleaseYear('');
                    setEpisodeVideoUrl('');
                    fetchAnimeData();
                    setIsSubmitting(false);
                  }}
                >
                  {isSubmitting ? 'Creating Movie...' : '🎬 Create Movie'}
              </Button>
            </div>
          </div>
        </TabsContent>


        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
            <div>
              <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
                Tools
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">Live</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Encoding pipeline status, conversion health & maintenance utilities</p>
            </div>
          </div>
          <Card className="bg-card/60 backdrop-blur-sm border-border/40 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <CardContent className="p-4 md:p-6 space-y-6">
              <ConversionHealthDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Token.Savi Tab */}
        <TabsContent value="token-savi" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-1 rounded-full bg-gradient-to-b from-yellow-400 to-orange-500" />
            <div>
              <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
                Token.Savi
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 uppercase tracking-wider inline-flex items-center gap-0.5">
                  <Key className="h-2.5 w-2.5" /> Access
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Generate, manage and revoke unlock tokens for premium access</p>
            </div>
          </div>
          <Card className="bg-card/60 backdrop-blur-sm border-border/40 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-amber-500" />
            <CardContent className="p-4 md:p-6">
              <TokenSaviDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming">
          <UpcomingTabContent anime={myAnime} allAnime={allAnime} isAdmin={isAdmin} onDelete={handleDeleteAnime} />
        </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

function UpcomingTabContent({ anime, allAnime, isAdmin, onDelete }: { anime: Anime[]; allAnime: Anime[]; isAdmin: boolean; onDelete: (id: string) => void }) {
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  // Show user's upcoming + (if admin) all upcoming
  const upcomingList = isAdmin
    ? allAnime.filter(a => a.status === 'upcoming')
    : anime.filter(a => a.status === 'upcoming');

  useEffect(() => {
    if (upcomingList.length === 0) return;

    const update = () => {
      const now = new Date();
      const map: Record<string, string> = {};
      upcomingList.forEach(a => {
        const year = a.release_year || now.getFullYear() + 1;
        const target = new Date(year, 0, 1, 0, 0, 0);
        const diff = target.getTime() - now.getTime();
        if (diff <= 0) {
          map[a.id] = 'Released!';
        } else {
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          map[a.id] = `${d}d ${h}h ${m}m ${s}s`;
        }
      });
      setCountdowns(map);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [upcomingList.length]);

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-7 w-1 rounded-full bg-gradient-to-b from-orange-400 to-amber-500" />
        <div className="flex-1">
          <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
            Upcoming Releases
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 uppercase tracking-wider">
              {upcomingList.length} titles
            </span>
          </h2>
          <p className="text-[11px] text-muted-foreground">Live countdowns to upcoming premiere dates</p>
        </div>
      </div>

      {upcomingList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 py-14 text-center">
          <div className="relative w-fit mx-auto mb-3">
            <div className="absolute inset-0 bg-orange-500/30 blur-2xl rounded-full" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-2xl">
              <CalendarClock className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-bold mb-1">No upcoming anime</h3>
          <p className="text-muted-foreground text-sm">Anime marked as "Upcoming" will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcomingList.map((a) => (
            <div
              key={a.id}
              className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300"
            >
              {a.cover_image && (
                <div
                  className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity"
                  style={{
                    backgroundImage: `url(${a.cover_image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(20px)',
                  }}
                />
              )}
              <div className="relative flex gap-3 p-3">
                <div className="relative w-16 h-22 shrink-0 rounded-lg overflow-hidden ring-1 ring-orange-500/30 group-hover:ring-orange-500/60 transition-all">
                  {a.cover_image ? (
                    <img src={a.cover_image} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <Film className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-500 to-amber-500 text-[8px] font-black uppercase text-white shadow-md">
                    Soon
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <h3 className="font-bold text-sm truncate group-hover:text-orange-400 transition-colors">{a.title}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    {a.release_year && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-muted text-muted-foreground border border-border/50">
                        {a.release_year}
                      </span>
                    )}
                  </div>
                  {/* Live countdown */}
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-orange-500/15 to-amber-500/15 border border-orange-500/30 w-fit">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                    </span>
                    <span className="text-orange-300 text-[10px] font-mono font-black tracking-wide">
                      {countdowns[a.id] || '...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] flex-1 px-2 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                      onClick={() => setSelectedAnime(a)}
                    >
                      <Eye className="h-3 w-3 mr-0.5" /> Countdown
                    </Button>
                    <Link to={`/upload/anime/${a.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="h-7 text-[10px] w-full px-2">
                        <Edit className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => onDelete(a.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UpcomingCountdownDialog
        anime={selectedAnime ? { ...selectedAnime, created_at: selectedAnime.created_at, release_year: selectedAnime.release_year } : null}
        onClose={() => setSelectedAnime(null)}
      />
    </>
  );
}
