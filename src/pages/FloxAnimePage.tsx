import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Trash2, Upload as UploadIcon, PartyPopper, ArrowLeft, Plus, Pencil, Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import { FloxPlayer } from '@/components/video/FloxPlayer';
import { AntiPiracyShield } from '@/components/security/AntiPiracyShield';
import floxLogo from '@/assets/flox-anime-india-logo.jpg';

const ADMIN_EMAIL = 'savi2570p@gmail.com';

interface FloxRow {
  id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  poster_url: string | null;
  source_type: 'embed' | 'file';
  source_url: string;
  episode_number: number | null;
  season_number: number | null;
  sort_order: number;
  created_at: string;
}

interface FloxAnime {
  title: string;
  description: string | null;
  banner_url: string | null;
  poster_url: string | null;
  episodes: FloxRow[];
}

export default function FloxAnimePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<FloxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editAnime, setEditAnime] = useState<FloxAnime | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('flox_welcome_seen')) {
      setShowWelcome(true);
      localStorage.setItem('flox_welcome_seen', '1');
    }
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('flox_content')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    else setRows((data as FloxRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Group rows by title → anime
  const animeList: FloxAnime[] = useMemo(() => {
    const map = new Map<string, FloxAnime>();
    for (const r of rows) {
      if (!map.has(r.title)) {
        map.set(r.title, {
          title: r.title,
          description: r.description,
          banner_url: r.banner_url,
          poster_url: r.poster_url,
          episodes: [],
        });
      }
      const a = map.get(r.title)!;
      // Prefer first row's poster/banner/description, but fill from any row that has it
      if (!a.poster_url && r.poster_url) a.poster_url = r.poster_url;
      if (!a.banner_url && r.banner_url) a.banner_url = r.banner_url;
      if (!a.description && r.description) a.description = r.description;
      a.episodes.push(r);
    }
    for (const a of map.values()) {
      a.episodes.sort(
        (x, y) =>
          (x.episode_number ?? 9999) - (y.episode_number ?? 9999) ||
          x.created_at.localeCompare(y.created_at)
      );
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [rows]);

  const selectedAnime = selectedTitle ? animeList.find((a) => a.title === selectedTitle) || null : null;

  const removeRow = async (id: string) => {
    if (!confirm('Delete this episode?')) return;
    const { error } = await supabase.from('flox_content').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Episode deleted');
    load();
  };

  const removeAnime = async (title: string) => {
    if (!confirm(`Delete the entire anime "${title}" and all its episodes?`)) return;
    const { error } = await supabase.from('flox_content').delete().eq('title', title);
    if (error) return toast.error(error.message);
    toast.success('Anime deleted');
    setSelectedTitle(null);
    load();
  };

  const openEpisode = (ep: FloxRow) => navigate(`/flox/watch/${ep.id}`);

  return (
    <AntiPiracyShield mode="strict" noRedirect>
      {/* Welcome popup */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <PartyPopper className="h-6 w-6 text-primary" />
              <DialogTitle>Great news!</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-base">
              Congratulations guys, we got the streaming rights from{' '}
              <span className="font-semibold text-foreground">Flox Anime India</span> to stream the Hindi
              Dubbed anime from Flox Anime India.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWelcome(false)}>Let's go</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      {isAdmin && (
        <FloxUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          existing={animeList}
          userId={user?.id}
          editAnime={editAnime}
          onClose={() => {
            setEditAnime(null);
            setUploadOpen(false);
          }}
          onSaved={load}
        />
      )}

      <div className="container py-6 space-y-6 select-none">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedAnime && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedTitle(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <img
              src={floxLogo}
              alt="Flox Anime India +"
              draggable={false}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/30"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Flox Anime India +</h1>
              <p className="text-[11px] text-muted-foreground">Premium curated Hindi dubs</p>
            </div>
          </div>

          {isAdmin && (
            <Button size="sm" onClick={() => { setEditAnime(null); setUploadOpen(true); }}>
              <UploadIcon className="h-4 w-4 mr-1.5" /> Upload
            </Button>
          )}
        </header>

        {/* Detail view */}
        {selectedAnime ? (
          <FloxDetailView
            anime={selectedAnime}
            isAdmin={isAdmin}
            onPlayEpisode={openEpisode}
            onAddEpisode={() => { setEditAnime(selectedAnime); setUploadOpen(true); }}
            onEditAnime={() => { setEditAnime(selectedAnime); setUploadOpen(true); }}
            onDeleteAnime={() => removeAnime(selectedAnime.title)}
            onDeleteEpisode={removeRow}
          />
        ) : (
          /* Library grid */
          <section>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : animeList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Flox content yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {animeList.map((a) => (
                  <button
                    key={a.title}
                    onClick={() => setSelectedTitle(a.title)}
                    className="group text-left rounded-md overflow-hidden bg-card border border-border/40 hover:border-primary/40 transition-colors"
                  >
                    <div className="relative aspect-[2/3] bg-black overflow-hidden">
                      {a.poster_url ? (
                        <img
                          src={a.poster_url}
                          alt={a.title}
                          draggable={false}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onContextMenu={(e) => e.preventDefault()}
                        />
                      ) : a.banner_url ? (
                        <img
                          src={a.banner_url}
                          alt={a.title}
                          draggable={false}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-xs text-muted-foreground p-2 text-center">
                          {a.title}
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-2">
                      <p className="text-xs font-medium line-clamp-1">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground">{a.episodes.length} ep</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AntiPiracyShield>
  );
}

/* -------------------- Detail view -------------------- */

function FloxDetailView({
  anime,
  playing,
  setPlaying,
  isAdmin,
  onAddEpisode,
  onEditAnime,
  onDeleteAnime,
  onDeleteEpisode,
}: {
  anime: FloxAnime;
  playing: FloxRow | null;
  setPlaying: (r: FloxRow | null) => void;
  isAdmin: boolean;
  onAddEpisode: () => void;
  onEditAnime: () => void;
  onDeleteAnime: () => void;
  onDeleteEpisode: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Banner hero with poster overlay */}
      <div className="relative w-full rounded-lg overflow-hidden">
        <div className="relative aspect-[16/7] bg-black">
          {anime.banner_url ? (
            <img
              src={anime.banner_url}
              alt={anime.title}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : anime.poster_url ? (
            <img
              src={anime.poster_url}
              alt={anime.title}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        <div className="relative -mt-24 md:-mt-32 px-4 md:px-6 flex flex-col md:flex-row gap-4 md:gap-6 md:items-end">
          {anime.poster_url && (
            <img
              src={anime.poster_url}
              alt={anime.title}
              draggable={false}
              className="w-32 md:w-44 aspect-[2/3] object-cover rounded-md shadow-xl ring-1 ring-border/40"
            />
          )}
          <div className="flex-1 space-y-2 pb-2">
            <h2 className="text-2xl md:text-3xl font-bold">{anime.title}</h2>
            {anime.description && (
              <p className="text-sm text-muted-foreground max-w-2xl">{anime.description}</p>
            )}
            <p className="text-xs text-muted-foreground">{anime.episodes.length} episode(s)</p>
            {isAdmin && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={onAddEpisode}>
                  <Plus className="h-4 w-4 mr-1" /> Add episode
                </Button>
                <Button size="sm" variant="outline" onClick={onEditAnime}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={onDeleteAnime}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player */}
      {playing && (
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                Ep {playing.episode_number ?? '—'} · {anime.title}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                Flox + (only server)
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPlaying(null)}>Close</Button>
          </div>
          <FloxPlayer
            sourceType={playing.source_type}
            sourceUrl={playing.source_url}
            poster={anime.poster_url || undefined}
            title={anime.title}
          />
        </Card>
      )}

      {/* Episode list */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Episodes</h3>
        {anime.episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No episodes yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {anime.episodes.map((ep) => (
              <div
                key={ep.id}
                className={`flex items-center gap-2 p-3 rounded-md border bg-card hover:border-primary/40 transition-colors ${
                  playing?.id === ep.id ? 'border-primary/60' : 'border-border/40'
                }`}
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => setPlaying(ep)}
                >
                  <p className="text-sm font-medium">Episode {ep.episode_number ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{ep.source_type}</p>
                </button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onDeleteEpisode(ep.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------- Upload dialog -------------------- */

function FloxUploadDialog({
  open,
  onOpenChange,
  existing,
  userId,
  editAnime,
  onClose,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: FloxAnime[];
  userId?: string;
  editAnime: FloxAnime | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!editAnime;
  const [mode, setMode] = useState<'new' | 'existing'>(editing ? 'existing' : 'new');

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Existing-anime selector
  const [selectedTitle, setSelectedTitle] = useState<string>('');

  // Episode fields
  const [episodeNumber, setEpisodeNumber] = useState<string>('');
  const [sourceMode, setSourceMode] = useState<'embed' | 'file'>('embed');
  const [embedUrl, setEmbedUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [skipEpisode, setSkipEpisode] = useState(false); // for edit-only

  const [submitting, setSubmitting] = useState(false);

  // Reset when dialog opens / target changes
  useEffect(() => {
    if (!open) return;
    if (editAnime) {
      setMode('existing');
      setSelectedTitle(editAnime.title);
      setTitle(editAnime.title);
      setDescription(editAnime.description || '');
      setPosterUrl(editAnime.poster_url || '');
      setBannerUrl(editAnime.banner_url || '');
      setEpisodeNumber(String((editAnime.episodes.at(-1)?.episode_number ?? 0) + 1));
      setSkipEpisode(true);
    } else {
      setMode('new');
      setSelectedTitle('');
      setTitle('');
      setDescription('');
      setPosterUrl('');
      setBannerUrl('');
      setEpisodeNumber('1');
      setSkipEpisode(false);
    }
    setEmbedUrl('');
    setVideoUrl('');
    setSourceMode('embed');
  }, [open, editAnime]);

  // When user picks an existing anime in "existing" mode, prefill ep number
  useEffect(() => {
    if (mode !== 'existing' || editing) return;
    const target = existing.find((a) => a.title === selectedTitle);
    if (target) {
      setEpisodeNumber(String((target.episodes.at(-1)?.episode_number ?? 0) + 1));
    }
  }, [selectedTitle, mode, existing, editing]);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'new') {
        if (!title.trim()) throw new Error('Title is required');
        if (!posterUrl) throw new Error('Poster image is required for new anime');
        const epNum = parseInt(episodeNumber || '1', 10);
        const src = sourceMode === 'embed' ? embedUrl.trim() : videoUrl.trim();
        if (!src) throw new Error('Episode source is required');

        const { error } = await supabase.from('flox_content').insert({
          title: title.trim(),
          description: description.trim() || null,
          poster_url: posterUrl,
          banner_url: bannerUrl || null,
          source_type: sourceMode,
          source_url: src,
          episode_number: epNum,
          season_number: 1,
          uploaded_by: userId,
        });
        if (error) throw error;
        toast.success('Anime created');
      } else {
        // existing anime: optionally edit metadata, optionally add an episode
        const targetTitle = editing ? editAnime!.title : selectedTitle;
        if (!targetTitle) throw new Error('Pick an anime');

        // Edit metadata on all rows for this title
        if (editing) {
          const patch: Record<string, any> = {};
          if (title.trim() && title.trim() !== editAnime!.title) patch.title = title.trim();
          if ((description || '') !== (editAnime!.description || '')) patch.description = description.trim() || null;
          if (bannerUrl !== (editAnime!.banner_url || '')) patch.banner_url = bannerUrl || null;
          // poster is only set at create time, do not overwrite if blank; allow update if changed
          if (posterUrl && posterUrl !== (editAnime!.poster_url || '')) patch.poster_url = posterUrl;

          if (Object.keys(patch).length > 0) {
            const { error } = await supabase
              .from('flox_content')
              .update(patch)
              .eq('title', editAnime!.title);
            if (error) throw error;
          }
        }

        if (!skipEpisode) {
          const epNum = parseInt(episodeNumber || '1', 10);
          const src = sourceMode === 'embed' ? embedUrl.trim() : videoUrl.trim();
          if (!src) throw new Error('Episode source is required');
          // Carry over poster/banner from existing for consistency
          const ref = existing.find((a) => a.title === targetTitle);
          const finalTitle = editing ? (title.trim() || editAnime!.title) : targetTitle;
          const { error } = await supabase.from('flox_content').insert({
            title: finalTitle,
            description: ref?.description || null,
            poster_url: ref?.poster_url || null,
            banner_url: ref?.banner_url || null,
            source_type: sourceMode,
            source_url: src,
            episode_number: epNum,
            season_number: 1,
            uploaded_by: userId,
          });
          if (error) throw error;
        }
        toast.success(editing ? 'Anime updated' : 'Episode added');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit · ${editAnime!.title}` : 'Upload to Flox'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update details or add a new episode.'
              : 'Create a new anime or add episodes to an existing one.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')} className="w-full">
          {!editing && (
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="new">New anime</TabsTrigger>
              <TabsTrigger value="existing" disabled={existing.length === 0}>
                Existing
              </TabsTrigger>
            </TabsList>
          )}

          {/* NEW ANIME */}
          <TabsContent value="new" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <FileUploadInput
              label="Poster (2:3) *"
              accept="image"
              value={posterUrl}
              onChange={setPosterUrl}
              folder="flox/posters"
            />
            <FileUploadInput
              label="Banner (16:9)"
              accept="image"
              value={bannerUrl}
              onChange={setBannerUrl}
              folder="flox/banners"
            />
            <EpisodeFields
              episodeNumber={episodeNumber}
              setEpisodeNumber={setEpisodeNumber}
              sourceMode={sourceMode}
              setSourceMode={setSourceMode}
              embedUrl={embedUrl}
              setEmbedUrl={setEmbedUrl}
              videoUrl={videoUrl}
              setVideoUrl={setVideoUrl}
            />
          </TabsContent>

          {/* EXISTING */}
          <TabsContent value="existing" className="space-y-3 pt-3">
            {!editing && (
              <div className="space-y-1">
                <Label>Pick anime</Label>
                <Select value={selectedTitle} onValueChange={setSelectedTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an existing anime" />
                  </SelectTrigger>
                  <SelectContent>
                    {existing.map((a) => (
                      <SelectItem key={a.title} value={a.title}>
                        {a.title} · {a.episodes.length} ep
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editing && (
              <div className="space-y-3 p-3 rounded-md border border-border/50 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">Edit details (poster is preserved)</p>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <FileUploadInput
                  label="Banner (replace, optional)"
                  accept="image"
                  value={bannerUrl}
                  onChange={setBannerUrl}
                  folder="flox/banners"
                />
                <div className="flex items-center gap-2">
                  <input
                    id="flox-skip-ep"
                    type="checkbox"
                    checked={skipEpisode}
                    onChange={(e) => setSkipEpisode(e.target.checked)}
                  />
                  <Label htmlFor="flox-skip-ep" className="text-xs">
                    Skip adding a new episode (only edit details)
                  </Label>
                </div>
              </div>
            )}

            {!skipEpisode && (
              <EpisodeFields
                episodeNumber={episodeNumber}
                setEpisodeNumber={setEpisodeNumber}
                sourceMode={sourceMode}
                setSourceMode={setSourceMode}
                embedUrl={embedUrl}
                setEmbedUrl={setEmbedUrl}
                videoUrl={videoUrl}
                setVideoUrl={setVideoUrl}
              />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? 'Save changes' : mode === 'new' ? 'Create anime' : 'Add episode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EpisodeFields({
  episodeNumber,
  setEpisodeNumber,
  sourceMode,
  setSourceMode,
  embedUrl,
  setEmbedUrl,
  videoUrl,
  setVideoUrl,
}: {
  episodeNumber: string;
  setEpisodeNumber: (v: string) => void;
  sourceMode: 'embed' | 'file';
  setSourceMode: (m: 'embed' | 'file') => void;
  embedUrl: string;
  setEmbedUrl: (v: string) => void;
  videoUrl: string;
  setVideoUrl: (v: string) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-md border border-border/50 bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Episode #</Label>
          <Input
            type="number"
            min={1}
            value={episodeNumber}
            onChange={(e) => setEpisodeNumber(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Source</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sourceMode === 'embed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceMode('embed')}
            >
              Embed
            </Button>
            <Button
              type="button"
              variant={sourceMode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceMode('file')}
            >
              Video file
            </Button>
          </div>
        </div>
      </div>

      {sourceMode === 'embed' ? (
        <div className="space-y-1">
          <Label>Embed URL</Label>
          <Input
            placeholder="https://..."
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
          />
        </div>
      ) : (
        <FileUploadInput
          label="Video file (resumable, fast)"
          accept="video"
          value={videoUrl}
          onChange={setVideoUrl}
          folder="flox/videos"
          contentType="episode"
        />
      )}
    </div>
  );
}
