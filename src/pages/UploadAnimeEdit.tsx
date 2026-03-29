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
import { Plus, Trash2, Film, Tv, ArrowLeft, Save, CalendarIcon, Edit, Subtitles } from 'lucide-react';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import { BatchEpisodeUpload } from '@/components/upload/BatchEpisodeUpload';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const ALL_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mysterious', 'Anime', 'Anime Series', 'Hindi', 'English', 'Tamil', 'Telugu', 'Japanese', 'Crunchyroll', 'Muse India', 'Amazon Prime'];

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
}

interface Season {
  id: string;
  season_number: number;
  title: string | null;
  anime_id: string;
  release_date: string | null;
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
  
  // Anime status
  const [animeStatus, setAnimeStatus] = useState<string>('ongoing');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isCrunchyroll, setIsCrunchyroll] = useState(false);
  const [isSavingCrunchy, setIsSavingCrunchy] = useState(false);
  const [isMuse, setIsMuse] = useState(false);
  const [isSavingMuse, setIsSavingMuse] = useState(false);
  const [scheduleDay, setScheduleDay] = useState<string>('auto');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Anime info editing
  const [editTitle, setEditTitle] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [editBannerImage, setEditBannerImage] = useState('');
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editReleaseYear, setEditReleaseYear] = useState('');
  const [editReleaseDate, setEditReleaseDate] = useState<Date | undefined>(undefined);
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
    setScheduleDay((animeData as any).schedule_day !== null && (animeData as any).schedule_day !== undefined ? String((animeData as any).schedule_day) : 'auto');
    setEditTitle(animeData.title || '');
    setEditCoverImage(animeData.cover_image || '');
    setEditBannerImage(animeData.banner_image || '');
    setEditGenres(animeData.genres || []);
    setEditReleaseYear(animeData.release_year ? String(animeData.release_year) : '');

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
    const nextSeasonNumber = seasons.length > 0 ? Math.max(...seasons.map((s) => s.season_number)) + 1 : 1;

    const { data, error } = await supabase
      .from('seasons')
      .insert({
        anime_id: animeId,
        season_number: nextSeasonNumber,
        title: newSeasonTitle.trim() || null,
        release_date: newSeasonReleaseDate ? format(newSeasonReleaseDate, 'yyyy-MM-dd') : null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add season');
    } else {
      toast.success('Season added');
      setNewSeasonTitle('');
      setNewSeasonReleaseDate(undefined);
      setSeasons([...seasons, data]);
      setSelectedSeason(data.id);
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
        external_url: newEpisodeExternalUrl.trim() || null,
        thumbnail: newEpisodeThumbnail.trim() || null,
        duration: newEpisodeDuration ? parseInt(newEpisodeDuration) : null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add episode');
    } else {
      toast.success('Episode added');
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
        <h1 className="text-3xl font-heading font-bold mb-2">
          Edit: <span className="anime-gradient-text">{anime?.title}</span>
        </h1>
        <p className="text-muted-foreground">Manage seasons, episodes and status</p>
        
        {/* Status Editor */}
        <div className="mt-4 flex items-center gap-4 p-4 bg-card/50 rounded-xl border border-border/50">
          <Label className="text-sm font-medium">Anime Status:</Label>
          <Select value={animeStatus} onValueChange={handleUpdateStatus} disabled={isSavingStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {isSavingStatus && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          )}
        </div>

        {/* Crunchy Toggle */}
        <div className="mt-4 flex items-center gap-4 p-4 bg-card/50 rounded-xl border border-border/50">
          <label htmlFor="edit_is_crunchyroll" className="flex items-center gap-3 cursor-pointer">
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
                if (error) {
                  toast.error('Failed to update Crunchy status');
                  setIsCrunchyroll(!val);
                } else {
                  toast.success(val ? 'Added to Crunchy tab' : 'Removed from Crunchy tab');
                }
                setIsSavingCrunchy(false);
              }}
              className="w-5 h-5 rounded border-border accent-primary"
            />
            <span className="text-sm font-medium">Add to Crunchy Tab</span>
          </label>
          {isSavingCrunchy && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          )}
        </div>

        {/* MUSE Toggle */}
        <div className="mt-4 flex items-center gap-4 p-4 bg-card/50 rounded-xl border border-border/50">
          <label htmlFor="edit_is_muse" className="flex items-center gap-3 cursor-pointer">
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
                if (error) {
                  toast.error('Failed to update MUSE status');
                  setIsMuse(!val);
                } else {
                  toast.success(val ? 'Added to MUSE tab' : 'Removed from MUSE tab');
                }
                setIsSavingMuse(false);
              }}
              className="w-5 h-5 rounded border-border accent-primary"
            />
            <span className="text-sm font-medium">Add to MUSE Tab</span>
          </label>
          {isSavingMuse && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          )}
        </div>

        <div className="mt-4 flex items-center gap-4 p-4 bg-card/50 rounded-xl border border-border/50">
          <Label className="text-sm font-medium">Release Calendar Day:</Label>
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
                toast.success(val === 'auto' ? 'Schedule day set to auto' : parseInt(val) === 7 ? 'Schedule day set to Everyday' : `Schedule day set to ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(val)]}`);
              }
              setIsSavingSchedule(false);
            }}
            disabled={isSavingSchedule}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (default)</SelectItem>
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
          {isSavingSchedule && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          )}
        </div>
        <div className="mt-4 p-4 bg-card/50 rounded-xl border border-border/50 space-y-4">
          <h3 className="text-sm font-semibold">Edit Series Info</h3>
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
              const { error } = await supabase
                .from('anime')
                .update({
                  title: editTitle.trim(),
                  cover_image: editCoverImage.trim() || null,
                  banner_image: editBannerImage.trim() || null,
                  genres: editGenres.length > 0 ? editGenres : null,
                  release_year: yearToStore,
                })
                .eq('id', animeId);
              if (error) {
                toast.error('Failed to update');
              } else {
                toast.success('Series info updated!');
                setAnime(prev => prev ? { ...prev, title: editTitle.trim(), cover_image: editCoverImage.trim() || null, banner_image: editBannerImage.trim() || null, genres: editGenres, release_year: yearToStore } : null);
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
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Season {season.season_number}
                            {season.title && ` - ${season.title}`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
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
