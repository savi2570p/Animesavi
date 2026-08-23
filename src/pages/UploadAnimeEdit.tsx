import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Plus, Trash2, Film, Tv, ArrowLeft, Save, CalendarIcon, Edit, Subtitles, CalendarClock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import { BatchEpisodeUpload } from '@/components/upload/BatchEpisodeUpload';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { extractEmbedSrc } from '@/components/video/PureEmbedPlayer';

const ALL_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mysterious', 'Hentai', 'Anime', 'Anime Series', 'Hindi', 'English', 'Tamil', 'Telugu', 'Japanese', 'Crunchyroll', 'Muse India', 'Sony YAY', 'Amazon Prime', 'Netflix', 'Zee 5'];

interface Anime {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  banner_image: string | null;
  uploader_id: string | null;
  status: string | null;
  genres: string[] | null;
  release_year: number | null;
  studio: string | null;
  total_episodes: number | null;
}

interface Season {
  id: string;
  season_number: number;
  title: string | null;
  anime_id: string;
  release_date: string | null;
  is_upcoming?: boolean;
}

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  external_url: string | null;
  thumbnail: string | null;
  duration: number | null;
  season_id: string;
}

export default function UploadAnimeEdit() {
  const { animeId } = useParams<{ animeId: string }>();
  const { user, isUploader, isAdmin, isRolesLoaded, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [anime, setAnime] = useState<Anime | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('seasons');

  const isAuthReady = !isAuthLoading && isRolesLoaded;

  // New season form
  const [newSeasonTitle, setNewSeasonTitle] = useState('');
  const [newSeasonReleaseDate, setNewSeasonReleaseDate] = useState<Date | undefined>();
  const [newSeasonNumber, setNewSeasonNumber] = useState<string>('');
  
  // Anime status
  const [animeStatus, setAnimeStatus] = useState<string>('ongoing');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isCrunchyroll, setIsCrunchyroll] = useState(false);
  const [isSavingCrunchy, setIsSavingCrunchy] = useState(false);
  const [isMuse, setIsMuse] = useState(false);
  const [isSavingMuse, setIsSavingMuse] = useState(false);
  const [isEngDub, setIsEngDub] = useState(false);
  const [isSavingEngDub, setIsSavingEngDub] = useState(false);
  const [scheduleDay, setScheduleDay] = useState<string>('auto');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Anime info editing
  const [editTitle, setEditTitle] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [editBannerImage, setEditBannerImage] = useState('');
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editReleaseYear, setEditReleaseYear] = useState('');
  const [editReleaseDate, setEditReleaseDate] = useState<Date | undefined>(undefined);
  const [editStudio, setEditStudio] = useState('');
  const [editTotalEpisodes, setEditTotalEpisodes] = useState('');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // New episode form
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [newEpisodeDescription, setNewEpisodeDescription] = useState('');
  const [newEpisodeVideoUrl, setNewEpisodeVideoUrl] = useState('');
  const [newEpisodeExternalUrl, setNewEpisodeExternalUrl] = useState('');
  const [newEpisodeThumbnail, setNewEpisodeThumbnail] = useState('');
  const [newEpisodeDuration, setNewEpisodeDuration] = useState('');

  useEffect(() => {
    // Wait for auth + roles to be fully loaded before enforcing redirects
    if (!isAuthReady) return;

    // Check if user has code verification
    const isCodeVerified = sessionStorage.getItem('upload_code_verified') === 'true';

    if (!user && !isCodeVerified) {
      navigate('/');
      return;
    }

    // Allow access if code is verified OR user is an uploader
    if (!isCodeVerified && !isUploader) {
      navigate('/');
      return;
    }

    fetchAnimeData();
  }, [isAuthReady, user, isUploader, animeId, navigate]);

  useEffect(() => {
    if (selectedSeason) {
      fetchEpisodes(selectedSeason);
    }
  }, [selectedSeason]);

  const fetchAnimeData = async () => {
    const { data: animeData, error } = await supabase
      .from('anime')
      .select('*')
      .eq('id', animeId)
      .single();

    if (error || !animeData) {
      toast.error('Anime not found');
      navigate('/upload');
      return;
    }

    // Check ownership or code verification
    const isCodeVerified = sessionStorage.getItem('upload_code_verified') === 'true';
    if (!isCodeVerified && animeData.uploader_id !== user?.id && !isAdmin) {
      toast.error('You do not have permission to edit this anime');
      navigate('/upload');
      return;
    }

    setAnime(animeData);
    setAnimeStatus(animeData.status || 'ongoing');
    setIsCrunchyroll((animeData as any).is_crunchyroll || false);
    setIsMuse((animeData as any).is_muse || false);
    setIsEngDub((animeData as any).is_eng_dub || false);
    setScheduleDay((animeData as any).schedule_day !== null && (animeData as any).schedule_day !== undefined ? String((animeData as any).schedule_day) : 'auto');
    setEditTitle(animeData.title || '');
    setEditCoverImage(animeData.cover_image || '');
    setEditBannerImage(animeData.banner_image || '');
    setEditGenres(animeData.genres || []);
    setEditReleaseYear(animeData.release_year ? String(animeData.release_year) : '');
    setEditStudio((animeData as any).studio || '');
    setEditTotalEpisodes((animeData as any).total_episodes != null ? String((animeData as any).total_episodes) : '');

    // Fetch seasons
    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('*')
      .eq('anime_id', animeId)
      .order('season_number');

    if (seasonsData) {
      setSeasons(seasonsData);
      if (seasonsData.length > 0) {
        setSelectedSeason(seasonsData[0].id);
      }
    }

    setIsLoading(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsSavingStatus(true);
    setAnimeStatus(newStatus);
    
    const { error } = await supabase
      .from('anime')
      .update({ status: newStatus })
      .eq('id', animeId);
    
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Status updated to ${newStatus}`);
    }
    setIsSavingStatus(false);
  };

  const fetchEpisodes = async (seasonId: string) => {
    const { data } = await supabase
      .from('episodes')
      .select('*')
      .eq('season_id', seasonId)
      .order('episode_number');

    if (data) {
      setEpisodes(data);
    }
  };

  const handleAddSeason = async () => {
    const parsed = parseInt(newSeasonNumber, 10);
    const fallback = seasons.length > 0 ? Math.max(...seasons.map((s) => s.season_number)) + 1 : 1;
    const seasonNum = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;

    const { data, error } = await supabase
      .from('seasons')
      .insert({
        anime_id: animeId,
        season_number: seasonNum,
        title: newSeasonTitle.trim() || null,
        release_date: newSeasonReleaseDate ? format(newSeasonReleaseDate, 'yyyy-MM-dd') : null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message?.includes('duplicate') ? `Season ${seasonNum} already exists` : 'Failed to add season');
    } else {
      toast.success(`Season ${seasonNum} added`);
      setNewSeasonTitle('');
      setNewSeasonReleaseDate(undefined);
      setNewSeasonNumber('');
      setSeasons([...seasons, data].sort((a, b) => a.season_number - b.season_number));
      setSelectedSeason(data.id);
    }
  };

  const handleUpdateSeasonNumber = async (seasonId: string, value: string) => {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error('Season number must be a positive integer');
      return;
    }
    if (seasons.some((s) => s.id !== seasonId && s.season_number === num)) {
      toast.error(`Season ${num} already exists`);
      return;
    }
    const { error } = await supabase
      .from('seasons')
      .update({ season_number: num })
      .eq('id', seasonId);
    if (error) {
      toast.error('Failed to update season number');
    } else {
      toast.success(`Renumbered to Season ${num}`);
      setSeasons(
        seasons
          .map((s) => (s.id === seasonId ? { ...s, season_number: num } : s))
          .sort((a, b) => a.season_number - b.season_number),
      );
    }
  };

  const handleUpdateSeasonReleaseDate = async (seasonId: string, date: Date | undefined) => {
    const { error } = await supabase
      .from('seasons')
      .update({ release_date: date ? format(date, 'yyyy-MM-dd') : null })
      .eq('id', seasonId);

    if (error) {
      toast.error('Failed to update release date');
    } else {
      toast.success('Release date updated');
      setSeasons(seasons.map(s => 
        s.id === seasonId ? { ...s, release_date: date ? format(date, 'yyyy-MM-dd') : null } : s
      ));
    }
  };

  const handleToggleSeasonUpcoming = async (seasonId: string, isUpcoming: boolean) => {
    const { error } = await supabase
      .from('seasons')
      .update({ is_upcoming: isUpcoming } as any)
      .eq('id', seasonId);

    if (error) {
      toast.error('Failed to update upcoming status');
    } else {
      toast.success(isUpcoming ? 'Added to Upcoming' : 'Removed from Upcoming');
      setSeasons(seasons.map(s => 
        s.id === seasonId ? { ...s, is_upcoming: isUpcoming } : s
      ));
    }
  };
  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm('Delete this season and all its episodes?')) return;

    const { error } = await supabase.from('seasons').delete().eq('id', seasonId);

    if (error) {
      toast.error('Failed to delete season');
    } else {
      toast.success('Season deleted');
      setSeasons(seasons.filter((s) => s.id !== seasonId));
      setSelectedSeason(seasons.length > 1 ? seasons[0].id : null);
    }
  };

  const handleAddEpisode = async () => {
    if (!selectedSeason || !newEpisodeTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    const nextEpisodeNumber = episodes.length > 0 ? Math.max(...episodes.map((e) => e.episode_number)) + 1 : 1;

    const { data, error } = await supabase
      .from('episodes')
      .insert({
        season_id: selectedSeason,
        episode_number: nextEpisodeNumber,
        title: newEpisodeTitle.trim(),
        description: newEpisodeDescription.trim() || null,
        video_url: newEpisodeVideoUrl.trim() || null,
        external_url: extractEmbedSrc(newEpisodeExternalUrl) || null,
        thumbnail: newEpisodeThumbnail.trim() || null,
        duration: newEpisodeDuration ? parseInt(newEpisodeDuration) : null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add episode');
    } else {
      toast.success('Episode added');
      if (data?.id && newEpisodeVideoUrl.trim()) void autoEnsureEmbed(data.id);
      // Reset form
      setNewEpisodeTitle('');
      setNewEpisodeDescription('');
      setNewEpisodeVideoUrl('');
      setNewEpisodeExternalUrl('');
      setNewEpisodeThumbnail('');
      setNewEpisodeDuration('');
      // Add to list
      setEpisodes([...episodes, data]);
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm('Delete this episode?')) return;

    const { error } = await supabase.from('episodes').delete().eq('id', episodeId);

    if (error) {
      toast.error('Failed to delete episode');
    } else {
      toast.success('Episode deleted');
      setEpisodes(episodes.filter((e) => e.id !== episodeId));
    }
  };

  if (!isAuthReady || isLoading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Button variant="ghost" onClick={() => navigate('/upload')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">
              Edit: <span className="anime-gradient-text">{anime?.title}</span>
            </h1>
            <p className="text-muted-foreground">Manage seasons, episodes and status</p>
          </div>
        </div>

        {/* Settings card — grouped: Status / Visibility / Schedule */}
        <div className="mt-6 p-5 sm:p-6 bg-card/50 rounded-2xl border border-border/50 space-y-6">
          <div className="flex items-center justify-between gap-3 pb-1">
            <div>
              <h3 className="text-sm font-bold text-foreground">Series Settings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Status, tab visibility and release calendar</p>
            </div>
            {(isSavingStatus || isSavingCrunchy || isSavingMuse || isSavingEngDub || isSavingSchedule) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                Saving…
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anime Status</Label>
              <Select value={animeStatus} onValueChange={handleUpdateStatus} disabled={isSavingStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Release Calendar Day</Label>
              <Select
                value={scheduleDay}
                onValueChange={async (val) => {
                  setScheduleDay(val);
                  setIsSavingSchedule(true);
                  const dayValue = val === 'auto' ? null : parseInt(val);
                  const { error } = await supabase
                    .from('anime')
                    .update({ schedule_day: dayValue } as any)
                    .eq('id', animeId);
                  if (error) {
                    toast.error('Failed to update schedule day');
                  } else {
                    toast.success(val === 'auto' ? 'Schedule day set to auto' : val === '-1' ? "Hidden from release calendar" : parseInt(val) === 7 ? 'Schedule day set to Everyday' : `Schedule day set to ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(val)]}`);
                  }
                  setIsSavingSchedule(false);
                }}
                disabled={isSavingSchedule}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (default)</SelectItem>
                  <SelectItem value="-1">Don't show (hide from calendar)</SelectItem>
                  <SelectItem value="7">Everyday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tab Visibility */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tab Visibility</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label htmlFor="edit_is_crunchyroll" className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-primary/40 transition-colors">
                <input
                  type="checkbox"
                  id="edit_is_crunchyroll"
                  checked={isCrunchyroll}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setIsCrunchyroll(val);
                    setIsSavingCrunchy(true);
                    const { error } = await supabase
                      .from('anime')
                      .update({ is_crunchyroll: val } as any)
                      .eq('id', animeId);
                    if (error) { toast.error('Failed to update Crunchy status'); setIsCrunchyroll(!val); }
                    else { toast.success(val ? 'Added to Crunchy tab' : 'Removed from Crunchy tab'); }
                    setIsSavingCrunchy(false);
                  }}
                  className="w-5 h-5 rounded border-border accent-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium block">Add to Crunchy Tab</span>
                  <span className="text-[10px] text-muted-foreground">Show under the Crunchyroll collection</span>
                </div>
              </label>

              <label htmlFor="edit_is_muse" className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-primary/40 transition-colors">
                <input
                  type="checkbox"
                  id="edit_is_muse"
                  checked={isMuse}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setIsMuse(val);
                    setIsSavingMuse(true);
                    const { error } = await supabase
                      .from('anime')
                      .update({ is_muse: val } as any)
                      .eq('id', animeId);
                    if (error) { toast.error('Failed to update MUSE status'); setIsMuse(!val); }
                    else { toast.success(val ? 'Added to MUSE tab' : 'Removed from MUSE tab'); }
                    setIsSavingMuse(false);
                  }}
                  className="w-5 h-5 rounded border-border accent-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium block">Add to MUSE Tab</span>
                  <span className="text-[10px] text-muted-foreground">Show under the MuseIN collection</span>
                </div>
              </label>

              <label htmlFor="edit_is_eng_dub" className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-indigo-400/50 transition-colors">
                <input
                  type="checkbox"
                  id="edit_is_eng_dub"
                  checked={isEngDub}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setIsEngDub(val);
                    setIsSavingEngDub(true);
                    const { error } = await (supabase as any)
                      .from('anime')
                      .update({ is_eng_dub: val })
                      .eq('id', animeId);
                    if (error) { toast.error('Failed to update ENG DUB status'); setIsEngDub(!val); }
                    else { toast.success(val ? 'Added to ENG DUB tab' : 'Removed from ENG DUB tab'); }
                    setIsSavingEngDub(false);
                  }}
                  className="w-5 h-5 rounded border-border accent-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium block">Add to ENG DUB Tab</span>
                  <span className="text-[10px] text-muted-foreground">Show under the English Dub collection</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-4 p-5 sm:p-6 bg-card/50 rounded-2xl border border-border/50 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-foreground">Edit Series Info</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Title, year, artwork, genres and studio</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const query = editTitle.trim() || anime?.title;
                if (!query) { toast.error('Enter a title first'); return; }
                const t = toast.loading('Fetching metadata…');
                let filled = 0;
                const apply = (studio?: string | null, eps?: number | null, year?: number | null, genres?: string[] | null, cover?: string | null, banner?: string | null) => {
                  if (studio) { setEditStudio(studio); filled++; }
                  if (typeof eps === 'number' && eps > 0) { setEditTotalEpisodes(String(eps)); filled++; }
                  if (year && !editReleaseYear) { setEditReleaseYear(String(year)); filled++; }
                  if (genres?.length && (!editGenres || editGenres.length === 0)) { setEditGenres(genres); filled++; }
                  if (cover && !editCoverImage) { setEditCoverImage(cover); filled++; }
                  if (banner && !editBannerImage) { setEditBannerImage(banner); filled++; }
                };
                try {
                  const gql = `query ($search: String) { Media(search: $search, type: ANIME) { episodes seasonYear description(asHtml: false) genres coverImage { extraLarge large } bannerImage studios { nodes { name isAnimationStudio } } } }`;
                  const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: gql, variables: { search: query } }),
                  });
                  const json = await res.json();
                  const m = json?.data?.Media;
                  if (m) {
                    const animStudio = m.studios?.nodes?.find((n: any) => n.isAnimationStudio)?.name || m.studios?.nodes?.[0]?.name;
                    apply(animStudio, m.episodes, m.seasonYear, m.genres, m.coverImage?.extraLarge || m.coverImage?.large, m.bannerImage);
                  }
                } catch { /* ignore, try Jikan */ }
                if (filled === 0) {
                  try {
                    const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=false`);
                    const j = await r.json();
                    const a = j?.data?.[0];
                    if (a) apply(a.studios?.[0]?.name, a.episodes, a.year, a.genres?.map((g: any) => g.name), a.images?.jpg?.large_image_url, null);
                  } catch { /* ignore */ }
                }
                if (filled === 0) toast.error('No metadata found', { id: t });
                else toast.success(`Filled ${filled} field${filled === 1 ? '' : 's'} — review & Save.`, { id: t });
              }}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Fetch Metadata
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Series Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Anime title"
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>{animeStatus === 'upcoming' ? 'Release Date' : 'Release Year'}</Label>
              {animeStatus === 'upcoming' ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-muted/50">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {editReleaseDate ? format(editReleaseDate, 'PPP') : (editReleaseYear ? editReleaseYear : 'Pick a date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editReleaseDate}
                      onSelect={(d) => {
                        setEditReleaseDate(d);
                        if (d) setEditReleaseYear(String(d.getFullYear()));
                      }}
                      disabled={(date) => date < new Date() || date.getFullYear() > 2037}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Input
                  type="number"
                  placeholder="2024"
                  value={editReleaseYear}
                  onChange={(e) => setEditReleaseYear(e.target.value)}
                  min="1900"
                  max="2099"
                  className="bg-muted/50"
                />
              )}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <FileUploadInput
              label="Cover Image (Thumbnail)"
              accept="image"
              value={editCoverImage}
              onChange={setEditCoverImage}
              folder="covers"
              placeholder="https://example.com/cover.jpg"
            />
            <FileUploadInput
              label="Banner Image"
              accept="image"
              value={editBannerImage}
              onChange={setEditBannerImage}
              folder="banners"
              placeholder="https://example.com/banner.jpg"
            />
          </div>
          {/* Genre Selection */}
          <div className="space-y-2">
            <Label>Genres / Tags</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    setEditGenres(prev => {
                      const updated = prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre];
                      // Auto-sync MUSE/Crunchy flags based on genre
                      if (genre === 'Muse India') {
                        supabase.from('anime').update({ is_muse: updated.includes('Muse India') } as any).eq('id', animeId);
                      }
                      if (genre === 'Crunchyroll') {
                        supabase.from('anime').update({ is_crunchyroll: updated.includes('Crunchyroll') } as any).eq('id', animeId);
                      }
                      return updated;
                    });
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    editGenres.includes(genre)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Studio</Label>
              <Input
                value={editStudio}
                onChange={(e) => setEditStudio(e.target.value)}
                placeholder="e.g. MAPPA, Bones, Ufotable"
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Episodes</Label>
              <Input
                type="number"
                min={0}
                value={editTotalEpisodes}
                onChange={(e) => setEditTotalEpisodes(e.target.value)}
                placeholder="e.g. 24"
                className="bg-muted/50"
              />
            </div>
          </div>
          <Button
            className="anime-button"
            disabled={isSavingInfo}
            onClick={async () => {
              if (!editTitle.trim()) {
                toast.error('Title is required');
                return;
              }
              setIsSavingInfo(true);
              const yearToStore = animeStatus === 'upcoming' && editReleaseDate
                ? editReleaseDate.getFullYear()
                : (editReleaseYear ? parseInt(editReleaseYear) : null);
              const totalEpisodesToStore = editTotalEpisodes.trim() ? parseInt(editTotalEpisodes) : null;
              const studioToStore = editStudio.trim() || null;
              const { error } = await supabase
                .from('anime')
                .update({
                  title: editTitle.trim(),
                  cover_image: editCoverImage.trim() || null,
                  banner_image: editBannerImage.trim() || null,
                  genres: editGenres.length > 0 ? editGenres : null,
                  release_year: yearToStore,
                  studio: studioToStore,
                  total_episodes: totalEpisodesToStore,
                })
                .eq('id', animeId);
              if (error) {
                toast.error('Failed to update');
              } else {
                toast.success('Series info updated!');
                setAnime(prev => prev ? { ...prev, title: editTitle.trim(), cover_image: editCoverImage.trim() || null, banner_image: editBannerImage.trim() || null, genres: editGenres, release_year: yearToStore, studio: studioToStore, total_episodes: totalEpisodesToStore } : null);
              }
              setIsSavingInfo(false);
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSavingInfo ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="seasons">Seasons</TabsTrigger>
          <TabsTrigger value="episodes" disabled={seasons.length === 0}>
            Episodes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seasons">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Existing Seasons */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tv className="h-5 w-5" />
                  Seasons ({seasons.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {seasons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No seasons yet. Add one to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {seasons.map((season) => (
                      <div
                        key={season.id}
                        className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-medium text-sm shrink-0">Season</span>
                            <Input
                              type="number"
                              min={1}
                              defaultValue={season.season_number}
                              key={season.season_number}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (parseInt(v, 10) !== season.season_number) {
                                  handleUpdateSeasonNumber(season.id, v);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="h-8 w-20 bg-background"
                            />
                            {season.title && (
                              <span className="text-sm text-muted-foreground truncate">— {season.title}</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => handleDeleteSeason(season.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "justify-start text-left font-normal",
                                  !season.release_date && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {season.release_date 
                                  ? format(new Date(season.release_date), 'PPP') 
                                  : 'Set release date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                              <Calendar
                                mode="single"
                                selected={season.release_date ? new Date(season.release_date) : undefined}
                                onSelect={(date) => handleUpdateSeasonReleaseDate(season.id, date)}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex items-center justify-between gap-2 px-1 py-1.5 rounded-md bg-orange-500/5 border border-orange-500/20">
                          <Label htmlFor={`upcoming-${season.id}`} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <CalendarClock className="h-3.5 w-3.5 text-orange-500" />
                            Add to Upcoming
                          </Label>
                          <Switch
                            id={`upcoming-${season.id}`}
                            checked={!!season.is_upcoming}
                            onCheckedChange={(checked) => handleToggleSeasonUpcoming(season.id, checked)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Season */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Season
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seasonNumber">Season Number</Label>
                  <Input
                    id="seasonNumber"
                    type="number"
                    min={1}
                    placeholder={`Defaults to ${seasons.length > 0 ? Math.max(...seasons.map((s) => s.season_number)) + 1 : 1}`}
                    value={newSeasonNumber}
                    onChange={(e) => setNewSeasonNumber(e.target.value)}
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose any number — e.g. add Season 1 after Season 2, or skip to Season 5.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seasonTitle">Season Title (Optional)</Label>
                  <Input
                    id="seasonTitle"
                    placeholder="e.g., The Beginning"
                    value={newSeasonTitle}
                    onChange={(e) => setNewSeasonTitle(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Release Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newSeasonReleaseDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newSeasonReleaseDate ? format(newSeasonReleaseDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                      <Calendar
                        mode="single"
                        selected={newSeasonReleaseDate}
                        onSelect={setNewSeasonReleaseDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button onClick={handleAddSeason} className="anime-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Season
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="episodes">
          {seasons.length > 1 && (
            <div className="mb-6">
              <Label>Select Season</Label>
              <div className="flex gap-2 mt-2">
                {seasons.map((season) => (
                  <Button
                    key={season.id}
                    variant={selectedSeason === season.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSeason(season.id)}
                  >
                    Season {season.season_number}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Batch Upload Section */}
          {selectedSeason && (
            <div className="mb-8">
              <BatchEpisodeUpload
                animeId={animeId!}
                seasonId={selectedSeason}
                currentEpisodeCount={episodes.length}
                onEpisodesAdded={() => fetchEpisodes(selectedSeason)}
              />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Existing Episodes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5" />
                  Episodes ({episodes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {episodes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No episodes yet. Add one using the batch uploader above.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {episodes.map((episode) => (
                      <div
                        key={episode.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {episode.thumbnail && (
                            <img 
                              src={episode.thumbnail} 
                              alt={episode.title}
                              className="w-16 h-10 object-cover rounded"
                            />
                          )}
                          <div>
                            <span className="text-sm text-muted-foreground">
                              EP {episode.episode_number}:
                            </span>
                            <span className="ml-2 font-medium">{episode.title}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a href={`/upload/anime/${animeId}/episode/${episode.id}/edit`}>
                              <Edit className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline text-xs">Edit / CC</span>
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEpisode(episode.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Episode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Episode
                </CardTitle>
                <CardDescription>
                  Upload a video file or add external link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="episodeTitle">Title *</Label>
                  <Input
                    id="episodeTitle"
                    placeholder="Episode title"
                    value={newEpisodeTitle}
                    onChange={(e) => setNewEpisodeTitle(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="episodeDescription">Description</Label>
                  <Textarea
                    id="episodeDescription"
                    placeholder="Brief description..."
                    value={newEpisodeDescription}
                    onChange={(e) => setNewEpisodeDescription(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <FileUploadInput
                  label="Episode Video"
                  accept="video"
                  value={newEpisodeVideoUrl}
                  onChange={setNewEpisodeVideoUrl}
                  folder={`anime/${animeId}/episodes`}
                  placeholder="https://example.com/video.mp4"
                />

                <div className="space-y-2">
                  <Label htmlFor="externalUrl">External Link (Alternative)</Label>
                  <Input
                    id="externalUrl"
                    type="url"
                    placeholder="https://example.com/watch/episode"
                    value={newEpisodeExternalUrl}
                    onChange={(e) => setNewEpisodeExternalUrl(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FileUploadInput
                    label="Thumbnail"
                    accept="image"
                    value={newEpisodeThumbnail}
                    onChange={setNewEpisodeThumbnail}
                    folder={`anime/${animeId}/thumbnails`}
                    placeholder="https://..."
                  />
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      placeholder="24"
                      value={newEpisodeDuration}
                      onChange={(e) => setNewEpisodeDuration(e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <Button onClick={handleAddEpisode} className="anime-button w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Episode
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
