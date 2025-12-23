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
import { toast } from 'sonner';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import {
  Upload as UploadIcon,
  Plus,
  Trash2,
  Film,
  Edit,
  Eye,
  FolderPlus,
} from 'lucide-react';

const genres = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports'];

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  status: string | null;
  created_at: string;
}

interface Season {
  id: string;
  season_number: number;
  title: string | null;
  anime_id: string;
}

export default function Upload() {
  const { user, isUploader, isRolesLoaded, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [myAnime, setMyAnime] = useState<Anime[]>([]);
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('my-anime');

  // Form state for new anime
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [releaseYear, setReleaseYear] = useState('');
  const [type, setType] = useState('series');
  const [status, setStatus] = useState('ongoing');

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

  // Allowed uploader emails
  const ALLOWED_UPLOADER_EMAILS = [
    'savi2570p@gmail.com',
    'savipanjeta2@gmail.com'
  ];

  const canUpload = () => {
    if (!user?.email) return false;
    return ALLOWED_UPLOADER_EMAILS.includes(user.email.toLowerCase());
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
          .order('created_at', { ascending: false });

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
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
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

    const { data, error } = await supabase
      .from('anime')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        cover_image: coverImage.trim() || null,
        banner_image: bannerImage.trim() || null,
        genres: selectedGenres.length > 0 ? selectedGenres : null,
        release_year: releaseYear ? parseInt(releaseYear) : null,
        type,
        status,
        uploader_id: user.id,
      })
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
      setSelectedGenres([]);
      setReleaseYear('');
      setType('series');
      setStatus('ongoing');
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

    const { error } = await supabase
      .from('episodes')
      .insert({
        season_id: selectedSeasonId,
        episode_number: nextEpisodeNumber,
        title: episodeTitle.trim(),
        description: episodeDescription.trim() || null,
        video_url: episodeVideoUrl.trim() || null,
        thumbnail: episodeThumbnail.trim() || null,
        duration: episodeDuration ? parseInt(episodeDuration) : null,
      });

    if (error) {
      console.error('Error adding episode:', error);
      toast.error('Failed to add episode');
    } else {
      toast.success(`Episode ${nextEpisodeNumber} added successfully!`);
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

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold">
            <span className="anime-gradient-text">Upload</span> Dashboard
          </h1>
          <p className="text-muted-foreground">Manage your anime uploads</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="my-anime">My Anime</TabsTrigger>
          <TabsTrigger value="new">Add New Anime</TabsTrigger>
          <TabsTrigger value="existing">
            <FolderPlus className="h-4 w-4 mr-2" />
            Existing Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-anime">
          {myAnime.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UploadIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No uploads yet</h3>
                <p className="text-muted-foreground mb-4">Start by adding your first anime</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myAnime.map((anime) => (
                <Card key={anime.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <img
                      src={anime.cover_image || '/placeholder.svg'}
                      alt={anime.title}
                      className="w-20 h-28 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg">{anime.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="capitalize">
                          {anime.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(anime.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/anime/${anime.id}`} target="_blank" rel="noopener">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/upload/anime/${anime.id}`}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAnime(anime.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="h-5 w-5" />
                Add New Anime
              </CardTitle>
              <CardDescription>
                Fill in the details to add a new anime to the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitAnime} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="Anime title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="bg-muted/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="releaseYear">Release Year</Label>
                    <Input
                      id="releaseYear"
                      type="number"
                      placeholder="2024"
                      value={releaseYear}
                      onChange={(e) => setReleaseYear(e.target.value)}
                      min="1900"
                      max="2099"
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="A brief description of the anime..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[100px] bg-muted/50"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <FileUploadInput
                    label="Cover Image"
                    accept="image"
                    value={coverImage}
                    onChange={setCoverImage}
                    folder="covers"
                    placeholder="https://example.com/cover.jpg"
                  />

                  <FileUploadInput
                    label="Banner Image"
                    accept="image"
                    value={bannerImage}
                    onChange={setBannerImage}
                    folder="banners"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="bg-muted/50">
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

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="bg-muted/50">
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

                <div className="space-y-2">
                  <Label>Genres</Label>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((genre) => (
                      <Button
                        key={genre}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleGenre(genre)}
                        className={selectedGenres.includes(genre) ? 'bg-primary text-primary-foreground' : ''}
                      >
                        {genre}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting} className="anime-button">
                  {isSubmitting ? 'Creating...' : 'Create Anime & Add Episodes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="existing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5" />
                Add Episode to Existing Anime
              </CardTitle>
              <CardDescription>
                Select an anime and season to add a new episode with video and thumbnail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEpisodeToExisting} className="space-y-6">
                {/* Anime Selection */}
                <div className="space-y-2">
                  <Label>Select Anime *</Label>
                  <Select value={selectedAnimeId} onValueChange={setSelectedAnimeId}>
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue placeholder="Choose an anime..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allAnime.map((anime) => (
                        <SelectItem key={anime.id} value={anime.id}>
                          {anime.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Season Selection */}
                {selectedAnimeId && (
                  <div className="space-y-2">
                    <Label>Select Season *</Label>
                    {seasons.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No seasons found. Please add a season first in the anime edit page.
                      </p>
                    ) : (
                      <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Choose a season..." />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons.map((season) => (
                            <SelectItem key={season.id} value={season.id}>
                              Season {season.season_number} {season.title && `- ${season.title}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* Episode Details */}
                {selectedSeasonId && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="episodeTitle">Episode Title *</Label>
                      <Input
                        id="episodeTitle"
                        placeholder="Episode title"
                        value={episodeTitle}
                        onChange={(e) => setEpisodeTitle(e.target.value)}
                        required
                        className="bg-muted/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="episodeDescription">Description</Label>
                      <Textarea
                        id="episodeDescription"
                        placeholder="Brief description..."
                        value={episodeDescription}
                        onChange={(e) => setEpisodeDescription(e.target.value)}
                        className="bg-muted/50"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <FileUploadInput
                        label="Episode Video"
                        accept="video"
                        value={episodeVideoUrl}
                        onChange={setEpisodeVideoUrl}
                        folder="episodes"
                        placeholder="https://example.com/video.mp4"
                      />

                      <FileUploadInput
                        label="Episode Thumbnail"
                        accept="image"
                        value={episodeThumbnail}
                        onChange={setEpisodeThumbnail}
                        folder="thumbnails"
                        placeholder="https://example.com/thumb.jpg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="episodeDuration">Duration (minutes)</Label>
                      <Input
                        id="episodeDuration"
                        type="number"
                        placeholder="24"
                        value={episodeDuration}
                        onChange={(e) => setEpisodeDuration(e.target.value)}
                        className="bg-muted/50 max-w-[200px]"
                      />
                    </div>

                    <Button type="submit" disabled={isAddingEpisode} className="anime-button">
                      {isAddingEpisode ? 'Adding Episode...' : 'Add Episode'}
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
