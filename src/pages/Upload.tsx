import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { autoEnsureEmbed } from '@/lib/embedTokens';
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
  Link2,
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
import { EmbedUploadTab } from '@/components/upload/EmbedUploadTab';


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

function UploadInner() {
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
  }, [isAuthReady, user, isAdmin, isUploader, navigate]);

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
      // Uploaders and admins see the full library here; everyone else only their own
      if (user) {
        let query = supabase.from('anime').select('*');
        if (!isUploader && !isAdmin) {
          query = query.eq('uploader_id', user.id);
        }
        const { data, error } = await query.order('created_at', { ascending: false }); // Always show newest first

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
        // Public custom-domain embed token (created once playback is valid).
        if (episodeVideoUrl.trim()) void autoEnsureEmbed(inserted.id);
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
    <div className="min-h-screen upload-v3 relative">
      <section className="border-b border-border">
        <div className="container py-6 md:py-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div><span className="text-xs text-primary inline-flex items-center gap-2 mb-2"><UploadIcon className="h-3.5 w-3.5" />Creator studio{isAdmin && <span className="catalogue-chip rounded px-1.5 py-0.5 text-[9px]">Admin</span>}</span><h1 className="font-heading text-2xl md:text-3xl font-bold">Upload Dashboard</h1><p className="text-[11px] text-muted-foreground mt-2">Last upload · {lastUploadLabel}{lastUpload && ` · ${lastUpload.title}`}</p></div>
            <div className="flex gap-2"><Button onClick={() => setActiveTab('new')} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Series</Button><Button onClick={() => setActiveTab('new-movie')} variant="outline" size="sm" className="catalogue-glass gap-1.5"><Film className="h-3.5 w-3.5" />Add Movie</Button></div>
          </div>
          <div className="grid grid-cols-4 mt-6 border-t border-border pt-4 gap-3">{[{label:'Series',value:seriesCount},{label:'Movies',value:moviesCount},{label:'Ongoing',value:ongoingCount},{label:'Upcoming',value:upcomingCount}].map(stat => <div key={stat.label}><span className="text-[10px] text-muted-foreground uppercase">{stat.label}</span><p className="font-semibold text-2xl tabular-nums mt-1">{stat.value}</p></div>)}</div>
        </div>
      </section>

      <div className="container px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Cinematic tab strip */}
          <div className="overflow-x-auto -mx-4 px-4 pb-1">
            <TabsList className="catalogue-glass p-1 rounded-lg flex flex-nowrap gap-1 w-fit">
              <TabsTrigger value="my-anime" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Tv className="h-3.5 w-3.5" /> My Series
              </TabsTrigger>
              <TabsTrigger value="my-movies" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Film className="h-3.5 w-3.5" /> My Movies
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Plus className="h-3.5 w-3.5" /> Add Series
              </TabsTrigger>
              <TabsTrigger value="new-movie" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Film className="h-3.5 w-3.5" /> Add Movie
              </TabsTrigger>
              <TabsTrigger value="tools" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Wrench className="h-3.5 w-3.5" /> Tools
              </TabsTrigger>
              <TabsTrigger value="token-savi" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Key className="h-3.5 w-3.5" /> Token.Savi
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> Upcoming
              </TabsTrigger>
              <TabsTrigger value="embed-upload" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                <Link2 className="h-3.5 w-3.5" /> Embed Upload
              </TabsTrigger>
            </TabsList>

          </div>

          <TabsContent value="my-anime" className="space-y-4">
            {/* Section header + search */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-7 w-1 rounded-full bg-gradient-to-b  " />
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
              <div className="rounded-lg border border-dashed border-border/50 bg-card/30 py-14 text-center">
                <div className="relative w-fit mx-auto mb-3">
                  <div className="relative w-14 h-14 rounded-lg bg-gradient-to-br   flex items-center justify-center shadow-2xl">
                    <Tv className="h-6 w-6 text-foreground" />
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-1">No anime series yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Start by adding your first anime series</p>
                <Button onClick={() => setActiveTab('new')} className="bg-gradient-to-r   text-foreground hover:opacity-90">
                  <Plus className="h-4 w-4 mr-1.5" /> Add New Series
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAnime.map((anime) => (
                  <div
                    key={anime.id}
                    className="upload-v3-tile catalogue-glass group relative overflow-hidden rounded-lg"
                  >
                    {/* Blurred backdrop */}
                    <div className="relative flex gap-3 p-3">
                      <div className="relative w-16 h-24 shrink-0 rounded-xl overflow-hidden ring-1 ring-border/50 group-hover:ring-primary/30 transition-all">
                        <img
                          src={anime.cover_image || '/placeholder.svg'}
                          alt={anime.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {anime.type && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm text-[8px] font-black uppercase text-foreground">
                            {anime.type}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">{anime.title}</h3>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            anime.status === 'ongoing' ? 'bg-primary/10 text-primary border border-primary/30' :
                            anime.status === 'completed' ? 'bg-primary/10 text-primary border border-primary/30' :
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
                          <Button variant="outline" size="sm" asChild className="h-7 text-[10px] flex-1 px-2 border-primary/30 text-primary hover:bg-primary/10">
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
            <div className="h-7 w-1 rounded-full bg-gradient-to-b  " />
            <div>
              <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
                My Movies
                <span className="text-xs font-bold text-muted-foreground">({moviesCount})</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Standalone film uploads & feature releases</p>
            </div>
          </div>

          {myAnime.filter(a => a.type === 'movie' && a.status !== 'upcoming').length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/50 bg-card/30 py-14 text-center">
              <div className="relative w-fit mx-auto mb-3">
                <div className="relative w-14 h-14 rounded-lg bg-gradient-to-br   flex items-center justify-center shadow-2xl">
                  <Film className="h-6 w-6 text-foreground" />
                </div>
              </div>
              <h3 className="text-lg font-bold mb-1">No movies yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Upload your first feature film</p>
              <Button onClick={() => setActiveTab('new-movie')} className="bg-gradient-to-r   text-foreground hover:opacity-90">
                <Plus className="h-4 w-4 mr-1.5" /> Add New Movie
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAnime.filter(a => a.type === 'movie' && a.status !== 'upcoming').map((anime) => (
                <div
                  key={anime.id}
                  className="upload-v3-tile catalogue-glass group relative overflow-hidden rounded-lg"
                >
                  <div className="relative flex gap-3 p-3">
                    <div className="relative w-16 h-24 shrink-0 rounded-xl overflow-hidden ring-1 ring-border/50 group-hover:ring-primary/30 transition-all">
                      <img
                        src={anime.cover_image || '/placeholder.svg'}
                        alt={anime.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-gradient-to-r   text-[8px] font-black uppercase text-foreground shadow-md">
                        Movie
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">{anime.title}</h3>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          anime.status === 'completed' ? 'bg-primary/10 text-primary border border-primary/30' :
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
                        <Button variant="outline" size="sm" asChild className="h-7 text-[10px] flex-1 px-2 border-primary/30 text-primary hover:bg-primary/10">
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

        <TabsContent value="new" className="studio-v12 upload-new-v12 space-y-5">
          {/* Hero header */}
          <div className="studio-v12-new-header py-5 md:py-6">
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary  flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                <Film className="h-6 w-6 text-foreground" />
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

          <Card className="upload-v3-form studio-v12-new-form">
            
            <CardContent className="p-0">
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
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Artwork</h3>
                      <p className="text-[10px] text-muted-foreground">Cover (2:3) & Banner (16:9)</p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <FileUploadInput
                        label="Cover Image"
                        accept="image"
                        value={coverImage}
                        onChange={setCoverImage}
                        folder="covers"
                        placeholder="https://example.com/cover.jpg"
                      />
                    </div>
                    <div className="min-w-0">
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
                      <Youtube className="h-3.5 w-3.5 text-primary" /> Trailer URL <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
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
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Settings2 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Metadata</h3>
                      <p className="text-[10px] text-muted-foreground">Type, status, studio & rating</p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>

                  {/* Auto-fill banner — premium */}
                  <div className="studio-v12-metadata py-4">
                    <div className="relative flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br   flex items-center justify-center shadow-md shadow-none shrink-0">
                          <Sparkles className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-primary">Auto-fill from MyAnimeList</p>
                          <p className="text-[11px] text-muted-foreground">Pull studio, episodes, source & rating from the title.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleFetchMetadata}
                        disabled={isFetchingMeta}
                        className="bg-gradient-to-r   hover: hover: text-foreground border-0 shadow-md shadow-none gap-1.5"
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
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">Genres & Tags</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedGenres.length} selected
                      </p>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
                  </div>
                  <div className="studio-v12-genres">
                    <div className="flex flex-wrap gap-2">
                      {genres.map((genre) => {
                        const active = selectedGenres.includes(genre);
                        return (
                          <Button
                            variant="glass"
                            size="sm"
                            aria-pressed={active}
                            key={genre}
                            type="button"
                            onClick={() => toggleGenre(genre)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                              active
                                ? 'bg-gradient-to-r from-primary  text-foreground border border-primary/40 shadow-md shadow-primary/20 scale-105'
                                : 'bg-muted/60 text-muted-foreground border border-border/50 hover:border-primary/40 hover:text-foreground'
                            }`}
                          >
                            {active && '✓ '}{genre}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* SECTION 5 — DISTRIBUTION */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Layers className="h-3.5 w-3.5 text-primary" />
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
                          ? 'border-primary/30 bg-primary/10 shadow-md shadow-none'
                          : 'border-border/40 bg-muted/20 hover:border-primary/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isCrunchyroll ? 'bg-gradient-to-br   text-foreground shadow' : 'bg-muted/60 text-muted-foreground'
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
                      {isCrunchyroll && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </label>

                    <label
                      htmlFor="is_muse"
                      className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isMuse
                          ? 'border-primary/30 bg-primary/10 shadow-md shadow-none'
                          : 'border-border/40 bg-muted/20 hover:border-primary/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isMuse ? 'bg-gradient-to-br   text-foreground shadow' : 'bg-muted/60 text-muted-foreground'
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
                      {isMuse && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </label>

                    <label
                      htmlFor="is_eng_dub"
                      className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isEngDub
                          ? 'border-primary/30 bg-primary/10 shadow-md shadow-none'
                          : 'border-border/40 bg-muted/20 hover:border-primary/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isEngDub ? 'bg-gradient-to-br   text-foreground shadow' : 'bg-muted/60 text-muted-foreground'
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
                      {isEngDub && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </label>
                  </div>
                </section>

                {/* SUBMIT */}
                <div className="studio-v12-submit py-4 mt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="studio-v12-primary w-full min-h-12 h-auto py-3 text-sm font-semibold gap-2 whitespace-normal"
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
          <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-br    p-5">
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br    flex items-center justify-center shadow-xl shadow-none ring-1 ring-border">
                <Film className="h-6 w-6 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl md:text-2xl font-heading font-black bg-gradient-to-r    text-foreground">Add New Movie</h2>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wider">Cinematic</span>
                </div>
                <p className="text-xs text-muted-foreground">Single feature film — no seasons or episodes required. One-shot upload.</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3 w-3" /> One step · Auto-published
                </div>
              </div>
            </div>
          </div>

          <Card className="upload-v3-form border-border/40 rounded-lg overflow-hidden">
            <div className="h-1 bg-gradient-to-r   " />
            <CardContent className="p-4 md:p-6">
              <form className="space-y-7">
                {/* SECTION 1 — Identity */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Film className="h-3.5 w-3.5 text-primary" />
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
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">Video File</h3>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wider">Required</span>
                    {episodeVideoUrl && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wider">✓ Ready</span>
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
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
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
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
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
                              ? 'bg-gradient-to-r   text-foreground border-transparent shadow-md shadow-none scale-105'
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
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-card/80 backdrop-blur-md shadow-xl shadow-none">
              <div className="hidden sm:flex flex-col flex-1 min-w-0">
                <span className="text-xs font-bold truncate">{title || 'Untitled Movie'}</span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span className={`flex items-center gap-1 ${title.trim() ? 'text-primary' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${title.trim() ? 'bg-primary/10' : 'bg-muted-foreground/40'}`} /> Title
                  </span>
                  <span className={`flex items-center gap-1 ${episodeVideoUrl ? 'text-primary' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${episodeVideoUrl ? 'bg-primary/10' : 'bg-muted-foreground/40'}`} /> Video
                  </span>
                  <span className={`flex items-center gap-1 ${coverImage ? 'text-primary' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${coverImage ? 'bg-primary/10' : 'bg-muted-foreground/40'}`} /> Cover
                  </span>
                  <span className={`flex items-center gap-1 ${selectedGenres.length > 0 ? 'text-primary' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedGenres.length > 0 ? 'bg-primary/10' : 'bg-muted-foreground/40'}`} /> {selectedGenres.length} genres
                  </span>
                </div>
              </div>
              <Button
                type="button"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none bg-gradient-to-r    text-foreground font-bold shadow-lg shadow-none hover:opacity-90 h-11 px-6"
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
                      const { data: movieEpisode, error: episodeError } = await supabase
                        .from('episodes')
                        .insert({
                          season_id: seasonData.id,
                          episode_number: 1,
                          title: title.trim(),
                          description: description.trim() || null,
                          video_url: episodeVideoUrl.trim(),
                          thumbnail: coverImage.trim() || null,
                        })
                        .select('id')
                        .single();

                      if (episodeError) {
                        toast.error('Movie created but video upload failed');
                      } else if (movieEpisode?.id) {
                        void autoEnsureEmbed(movieEpisode.id);
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
            <div className="h-7 w-1 rounded-full bg-gradient-to-b  " />
            <div>
              <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
                Tools
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wider">Live</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Encoding pipeline status, conversion health & maintenance utilities</p>
            </div>
          </div>
          <Card className="upload-v3-form border-border/40 rounded-lg overflow-hidden">
            <div className="h-1 bg-gradient-to-r   " />
            <CardContent className="p-4 md:p-6 space-y-6">
              <ConversionHealthDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Token.Savi Tab */}
        <TabsContent value="token-savi" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-1 rounded-full bg-gradient-to-b  " />
            <div>
              <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
                Token.Savi
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wider inline-flex items-center gap-0.5">
                  <Key className="h-2.5 w-2.5" /> Access
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Generate, manage and revoke unlock tokens for premium access</p>
            </div>
          </div>
          <Card className="upload-v3-form border-border/40 rounded-lg overflow-hidden">
            <div className="h-1 bg-gradient-to-r   " />
            <CardContent className="p-4 md:p-6">
              <TokenSaviDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upcoming Tab */}
        <TabsContent value="upcoming">
          <UpcomingTabContent anime={myAnime} allAnime={allAnime} isAdmin={isAdmin} onDelete={handleDeleteAnime} />
        </TabsContent>

        {/* Embed Upload Tab */}
        <TabsContent value="embed-upload">
          <EmbedUploadTab />
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
        <div className="h-7 w-1 rounded-full bg-gradient-to-b  " />
        <div className="flex-1">
          <h2 className="text-lg md:text-xl font-heading font-black flex items-center gap-2">
            Upcoming Releases
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wider">
              {upcomingList.length} titles
            </span>
          </h2>
          <p className="text-[11px] text-muted-foreground">Live countdowns to upcoming premiere dates</p>
        </div>
      </div>

      {upcomingList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 bg-card/30 py-14 text-center">
          <div className="relative w-fit mx-auto mb-3">
            <div className="relative w-14 h-14 rounded-lg bg-gradient-to-br   flex items-center justify-center shadow-2xl">
              <CalendarClock className="h-6 w-6 text-foreground" />
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
              className="upload-v3-tile catalogue-glass group relative overflow-hidden rounded-lg"
            >
              <div className="relative flex gap-3 p-3">
                <div className="relative w-16 h-22 shrink-0 rounded-lg overflow-hidden ring-1 ring-primary/30 group-hover:ring-primary/30 transition-all">
                  {a.cover_image ? (
                    <img src={a.cover_image} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <Film className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-gradient-to-r   text-[8px] font-black uppercase text-foreground shadow-md">
                    Soon
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{a.title}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    {a.release_year && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-muted text-muted-foreground border border-border/50">
                        {a.release_year}
                      </span>
                    )}
                  </div>
                  {/* Live countdown */}
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r   border border-primary/30 w-fit">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/10 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/10" />
                    </span>
                    <span className="text-primary text-[10px] font-mono font-black tracking-wide">
                      {countdowns[a.id] || '...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] flex-1 px-2 border-primary/30 text-primary hover:bg-primary/10"
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

export default function Upload() {
  return <UploadInner />;
}
