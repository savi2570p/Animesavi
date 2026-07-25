import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import { toast } from 'sonner';
import { Loader2, Trash2, Upload as UploadIcon, PartyPopper, ArrowLeft, Plus, Pencil, Play, Share2 } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<FloxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTitle, setSelectedTitleState] = useState<string | null>(searchParams.get('anime'));
  const [showWelcome, setShowWelcome] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editAnime, setEditAnime] = useState<FloxAnime | null>(null);

  const setSelectedTitle = (title: string | null) => {
    setSelectedTitleState(title);
    const next = new URLSearchParams(searchParams);
    if (title) next.set('anime', title);
    else next.delete('anime');
    setSearchParams(next, { replace: true });
  };

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
      {/* Welcome popup — liquid glass */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-md flox-glass-strong border-white/15 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <PartyPopper className="h-6 w-6 text-primary" />
              <DialogTitle className="text-white">Welcome to Flox +</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-base text-white/80">
              We got the streaming rights from{' '}
              <span className="font-semibold text-white">Flox Anime India</span> to bring you their premium Hindi Dub library — right here in a liquid-glass experience.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowWelcome(false)} className="rounded-full">Let's go</Button>
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

      {/* Ambient aurora backdrop */}
      <div className="relative min-h-screen overflow-hidden">
        <div className="flox-aurora" aria-hidden />

        <div className="relative z-10 container py-6 space-y-8 select-none">
          {/* Glass Header */}
          <header className="flox-glass px-4 py-3 flex items-center justify-between gap-3 rounded-3xl">
            <div className="flex items-center gap-3 min-w-0">
              {selectedAnime && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTitle(null)}
                  className="rounded-full hover:bg-white/10 text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <img
                src={floxLogo}
                alt="Flox +"
                draggable={false}
                className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/20 shadow-lg"
              />
              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl font-bold tracking-tight text-white truncate">
                  Flox <span className="text-primary">+</span>
                </h1>
                <p className="text-[11px] text-white/60 truncate">Premium Hindi dubs · Liquid experience</p>
              </div>
            </div>

            {isAdmin && (
              <Button
                size="sm"
                onClick={() => { setEditAnime(null); setUploadOpen(true); }}
                className="rounded-full bg-primary/90 hover:bg-primary shadow-lg shadow-primary/30"
              >
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
            <section className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Library</h2>
                  <p className="text-xs text-white/60">{animeList.length} title{animeList.length === 1 ? '' : 's'}</p>
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flox-card aspect-[2/3] animate-pulse bg-white/[0.03]" />
                  ))}
                </div>
              ) : animeList.length === 0 ? (
                <div className="flox-glass rounded-3xl p-10 text-center text-white/70">
                  <p className="text-sm">No Flox content yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                  {animeList.map((a) => (
                    <button
                      key={a.title}
                      onClick={() => setSelectedTitle(a.title)}
                      className="flox-card group text-left"
                    >
                      <div className="relative aspect-[2/3] bg-black overflow-hidden">
                        {a.poster_url ? (
                          <img
                            src={a.poster_url}
                            alt={a.title}
                            draggable={false}
                            className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out"
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
                          <div className="w-full h-full grid place-items-center text-xs text-white/70 p-2 text-center">
                            {a.title}
                          </div>
                        )}
                        {/* glass scrim */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 flox-scrim pointer-events-none" />
                        <div className="absolute top-2 left-2 flox-glass-chip px-2 py-0.5 rounded-full text-[10px] font-medium text-white">
                          {a.episodes.length} ep
                        </div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-xs md:text-sm font-semibold text-white line-clamp-1 drop-shadow">{a.title}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </AntiPiracyShield>
  );
}

/* -------------------- Detail view -------------------- */

function FloxDetailView({
  anime,
  isAdmin,
  onPlayEpisode,
  onAddEpisode,
  onEditAnime,
  onDeleteAnime,
  onDeleteEpisode,
}: {
  anime: FloxAnime;
  isAdmin: boolean;
  onPlayEpisode: (r: FloxRow) => void;
  onAddEpisode: () => void;
  onEditAnime: () => void;
  onDeleteAnime: () => void;
  onDeleteEpisode: (id: string) => void;
}) {
  const firstEpisode = anime.episodes[0];
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/flox?anime=${encodeURIComponent(anime.title)}`;
    const shareData = {
      title: `${anime.title} — Flox +`,
      text: `Watch ${anime.title} in Hindi Dub on Flox +`,
      url: shareUrl,
    };
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {
      // user cancelled
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Unable to share link');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cinematic hero */}
      <div className="relative rounded-3xl overflow-hidden flox-glass-strong">
        <div className="relative aspect-[16/8] md:aspect-[16/6] bg-black">
          {anime.banner_url ? (
            <img
              src={anime.banner_url}
              alt={anime.title}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
            />
          ) : anime.poster_url ? (
            <img
              src={anime.poster_url}
              alt={anime.title}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-70"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
        </div>

        <div className="relative -mt-28 md:-mt-40 px-4 md:px-8 pb-6 flex flex-col md:flex-row gap-5 md:gap-7 md:items-end">
          {anime.poster_url && (
            <img
              src={anime.poster_url}
              alt={anime.title}
              draggable={false}
              className="w-32 md:w-48 aspect-[2/3] object-cover rounded-2xl shadow-2xl ring-1 ring-white/20"
            />
          )}
          <div className="flex-1 space-y-3 pb-1">
            <div className="inline-flex flox-glass-chip px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest text-white/80">
              Flox + · Hindi Dub
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow">{anime.title}</h2>
            {anime.description && (
              <p className="text-sm text-white/75 max-w-2xl leading-relaxed line-clamp-3">{anime.description}</p>
            )}
            <p className="text-xs text-white/55">{anime.episodes.length} episode(s)</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {firstEpisode && (
                <Button
                  size="sm"
                  onClick={() => onPlayEpisode(firstEpisode)}
                  className="rounded-full bg-white text-black hover:bg-white/90 shadow-lg"
                >
                  <Play className="h-4 w-4 mr-1 fill-current" /> Watch Now
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleShare} className="rounded-full flox-glass-chip text-white hover:bg-white/15">
                <Share2 className="h-4 w-4 mr-1" /> Share
              </Button>
              {isAdmin && (
                <>
                  <Button size="sm" variant="ghost" onClick={onAddEpisode} className="rounded-full flox-glass-chip text-white hover:bg-white/15">
                    <Plus className="h-4 w-4 mr-1" /> Add episode
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onEditAnime} className="rounded-full flox-glass-chip text-white hover:bg-white/15">
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-full flox-glass-chip text-red-300 hover:text-red-200 hover:bg-red-500/20" onClick={onDeleteAnime}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Episode list — glass tiles */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold text-white">Episodes</h3>
          <span className="text-xs text-white/50">{anime.episodes.length} total</span>
        </div>
        {anime.episodes.length === 0 ? (
          <div className="flox-glass rounded-2xl p-8 text-center text-white/60 text-sm">No episodes yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {anime.episodes.map((ep) => (
              <div
                key={ep.id}
                className="flox-glass rounded-2xl p-3 flex items-center gap-3 group"
              >
                <button
                  className="flex-1 text-left flex items-center gap-3 min-w-0"
                  onClick={() => onPlayEpisode(ep)}
                >
                  <div className="h-11 w-11 grid place-items-center rounded-2xl bg-gradient-to-br from-primary to-red-700 text-white shadow-lg shadow-primary/30 shrink-0 group-hover:scale-105 transition-transform">
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">Episode {ep.episode_number ?? '—'}</p>
                    <p className="text-[11px] text-white/55 capitalize">{ep.source_type} source</p>
                  </div>
                </button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-300 hover:bg-red-500/20 rounded-full"
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
                <p className="text-xs font-medium text-muted-foreground">Edit details</p>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <FileUploadInput
                  label="Poster (replace, optional)"
                  accept="image"
                  value={posterUrl}
                  onChange={setPosterUrl}
                  folder="flox/posters"
                />
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
