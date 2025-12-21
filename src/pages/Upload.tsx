import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Upload as UploadIcon,
  Plus,
  Trash2,
  Film,
  Tv,
  Edit,
  Eye,
  Link as LinkIcon,
} from 'lucide-react';

const genres = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports'];

interface Anime {
  id: string;
  title: string;
  cover_image: string | null;
  status: string | null;
  created_at: string;
}

export default function Upload() {
  const { user, isUploader } = useAuth();
  const navigate = useNavigate();
  const [myAnime, setMyAnime] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for new anime
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [releaseYear, setReleaseYear] = useState('');
  const [type, setType] = useState('series');
  const [status, setStatus] = useState('ongoing');

  useEffect(() => {
    // Check if user has code verification
    const isCodeVerified = sessionStorage.getItem('upload_code_verified') === 'true';
    
    if (!user && !isCodeVerified) {
      navigate('/auth');
      return;
    }

    // Allow access if code is verified OR user is an uploader
    if (!isCodeVerified && !isUploader) {
      navigate('/apply-uploader');
      return;
    }

    fetchMyAnime();
  }, [user, isUploader]);

  const fetchMyAnime = async () => {
    // If user is logged in, fetch their anime; otherwise fetch all (for code-verified users)
    if (user) {
      const { data } = await supabase
        .from('anime')
        .select('*')
        .eq('uploader_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setMyAnime(data);
      }
    }
    setIsLoading(false);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmitAnime = async (e: React.FormEvent) => {
    e.preventDefault();

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
        uploader_id: user?.id || null,
      })
      .select()
      .single();

    if (error) {
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
      fetchMyAnime();
      // Navigate to add episodes
      navigate(`/upload/anime/${data.id}`);
    }

    setIsSubmitting(false);
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
      fetchMyAnime();
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

      <Tabs defaultValue="my-anime">
        <TabsList className="mb-8">
          <TabsTrigger value="my-anime">My Anime</TabsTrigger>
          <TabsTrigger value="new">Add New Anime</TabsTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="coverImage">Cover Image URL</Label>
                    <Input
                      id="coverImage"
                      type="url"
                      placeholder="https://example.com/cover.jpg"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bannerImage">Banner Image URL</Label>
                    <Input
                      id="bannerImage"
                      type="url"
                      placeholder="https://example.com/banner.jpg"
                      value={bannerImage}
                      onChange={(e) => setBannerImage(e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
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
      </Tabs>
    </div>
  );
}
