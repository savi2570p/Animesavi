import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Trash2, Upload as UploadIcon, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FloxPlayer } from '@/components/video/FloxPlayer';
import { AntiPiracyShield } from '@/components/security/AntiPiracyShield';
import floxLogo from '@/assets/flox-anime-india-logo.jpg';

const ADMIN_EMAIL = 'savi2570p@gmail.com';
const BUCKET_IMAGES = 'anime-thumbnails';
const BUCKET_VIDEOS = 'anime-videos';

interface FloxItem {
  id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  poster_url: string | null;
  source_type: 'embed' | 'file';
  source_url: string;
  created_at: string;
}

export default function FloxAnimePage() {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [items, setItems] = useState<FloxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FloxItem | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('flox_welcome_seen')) {
      setShowWelcome(true);
      localStorage.setItem('flox_welcome_seen', '1');
    }
  }, []);

  // Upload form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [sourceMode, setSourceMode] = useState<'embed' | 'file'>('embed');
  const [embedUrl, setEmbedUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('flox_content')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data as FloxItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadTo = async (bucket: string, file: File, prefix: string) => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `flox/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const submit = async () => {
    if (!title.trim()) return toast.error('Title is required');
    if (sourceMode === 'embed' && !embedUrl.trim()) return toast.error('Embed URL is required');
    if (sourceMode === 'file' && !videoFile) return toast.error('Video file is required');

    setSubmitting(true);
    try {
      let banner_url: string | null = null;
      let poster_url: string | null = null;
      let source_url = embedUrl.trim();

      if (bannerFile) banner_url = await uploadTo(BUCKET_IMAGES, bannerFile, 'banner');
      if (posterFile) poster_url = await uploadTo(BUCKET_IMAGES, posterFile, 'poster');
      if (sourceMode === 'file' && videoFile) {
        source_url = await uploadTo(BUCKET_VIDEOS, videoFile, 'video');
      }

      const { error } = await supabase.from('flox_content').insert({
        title: title.trim(),
        description: description.trim() || null,
        banner_url,
        poster_url,
        source_type: sourceMode,
        source_url,
        uploaded_by: user?.id,
      });
      if (error) throw error;

      toast.success('Flox content added');
      setTitle('');
      setDescription('');
      setBannerFile(null);
      setPosterFile(null);
      setEmbedUrl('');
      setVideoFile(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this Flox item?')) return;
    const { error } = await supabase.from('flox_content').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      setSelected(null);
      load();
    }
  };

  return (
    <AntiPiracyShield mode="strict" noRedirect>
      <div className="container py-6 space-y-8 select-none">
        <header className="flex items-center gap-3">
          <img
            src={floxLogo}
            alt="Flox Anime India +"
            draggable={false}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/30"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Flox Anime India +</h1>
            <p className="text-xs text-muted-foreground">Premium curated drops · admin-only uploads</p>
          </div>
        </header>

        {selected && (
          <Card className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{selected.title}</h2>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => remove(selected.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
            <FloxPlayer
              sourceType={selected.source_type}
              sourceUrl={selected.source_url}
              poster={selected.poster_url || undefined}
              title={selected.title}
            />
            {selected.description && (
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            )}
          </Card>
        )}

        {isAdmin && (
          <Card className="p-4 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <UploadIcon className="h-4 w-4" /> Admin upload
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
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
                    Embed link
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

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Banner image</Label>
                <Input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1">
                <Label>Poster image</Label>
                <Input type="file" accept="image/*" onChange={(e) => setPosterFile(e.target.files?.[0] || null)} />
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
              <div className="space-y-1">
                <Label>Video file</Label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Publish to Flox
            </Button>
          </Card>
        )}

        <section>
          <h2 className="font-semibold mb-3">Library</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Flox content yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="group text-left rounded-md overflow-hidden bg-card border border-border/40 hover:border-primary/40 transition-colors"
                >
                  <div className="relative aspect-[2/3] bg-black overflow-hidden">
                    {item.poster_url ? (
                      <img
                        src={item.poster_url}
                        alt={item.title}
                        draggable={false}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    ) : item.banner_url ? (
                      <img
                        src={item.banner_url}
                        alt={item.title}
                        draggable={false}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
                        {item.title}
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-2">
                    <p className="text-xs font-medium line-clamp-1">{item.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </AntiPiracyShield>
  );
}
