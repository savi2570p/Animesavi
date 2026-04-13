import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Upload, Pencil, Trash2, Play, Plus, X, Link, Image, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import shadowFlixLogo from '@/assets/shadowflix-logo.jpg';

const SHADOW_FLIX_PASSWORD = 'SHADOW X SAVI';

interface ShadowFlixItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  uploaded_by: string;
  created_at: string;
}

export default function ShadowFlix() {
  const { user } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [items, setItems] = useState<ShadowFlixItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingItem, setEditingItem] = useState<ShadowFlixItem | null>(null);
  const [playingItem, setPlayingItem] = useState<ShadowFlixItem | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbnailMode, setThumbnailMode] = useState<'file' | 'url'>('file');

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Check session unlock
  useEffect(() => {
    const unlocked = sessionStorage.getItem('shadowflix_unlocked');
    if (unlocked === 'true') setIsUnlocked(true);
  }, []);

  useEffect(() => {
    if (isUnlocked) fetchItems();
  }, [isUnlocked]);

  const handleUnlock = () => {
    if (password.toUpperCase() === SHADOW_FLIX_PASSWORD) {
      setIsUnlocked(true);
      sessionStorage.setItem('shadowflix_unlocked', 'true');
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Try again.');
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shadow_flix_content')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setItems(data as ShadowFlixItem[]);
    setLoading(false);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormThumbnailUrl('');
    setFormVideoUrl('');
    setThumbnailFile(null);
    setVideoFile(null);
    setThumbnailMode('file');
    setEditingItem(null);
  };

  const uploadFileToStorage = async (file: File, bucket: string, folder: string) => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setUploading(true);
    try {
      let finalThumbnail = formThumbnailUrl;
      let finalVideo = formVideoUrl;

      if (thumbnailFile) {
        finalThumbnail = await uploadFileToStorage(thumbnailFile, 'anime-thumbnails', 'shadowflix');
      }
      if (videoFile) {
        finalVideo = await uploadFileToStorage(videoFile, 'anime-videos', 'shadowflix');
      }

      if (editingItem) {
        const { error } = await supabase
          .from('shadow_flix_content')
          .update({
            title: formTitle,
            thumbnail_url: finalThumbnail || null,
            video_url: finalVideo || null,
          })
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Updated successfully');
      } else {
        const { error } = await supabase
          .from('shadow_flix_content')
          .insert({
            title: formTitle,
            thumbnail_url: finalThumbnail || null,
            video_url: finalVideo || null,
            uploaded_by: user.id,
          });
        if (error) throw error;
        toast.success('Uploaded successfully');
      }

      setShowUpload(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    const { error } = await supabase.from('shadow_flix_content').delete().eq('id', id);
    if (error) {
      toast.error('Delete failed');
    } else {
      toast.success('Deleted');
      fetchItems();
    }
  };

  const openEdit = (item: ShadowFlixItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormThumbnailUrl(item.thumbnail_url || '');
    setFormVideoUrl(item.video_url || '');
    setThumbnailMode('url');
    setShowUpload(true);
  };

  // PASSWORD GATE
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'radial-gradient(ellipse at 30% 70%, rgba(200,120,0,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(200,120,0,0.08) 0%, transparent 50%), #0a0a0a' }}>
        <div className="w-full max-w-sm rounded-2xl p-8 text-center space-y-6"
          style={{
            background: 'rgba(20,15,10,0.9)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(200,120,0,0.3)',
            boxShadow: '0 0 60px rgba(200,120,0,0.1)',
          }}>
          <img src={shadowFlixLogo} alt="ShadowFlix" className="w-20 h-20 rounded-xl mx-auto shadow-lg" />
          <h1 className="text-2xl font-black tracking-wider text-white">
            SHADOW<span className="text-orange-500">FLIX</span>
          </h1>
          <p className="text-white/50 text-sm">This section is password protected</p>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-500 shrink-0" />
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
          <Button onClick={handleUnlock} className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold">
            Unlock Access
          </Button>
        </div>
      </div>
    );
  }

  // MAIN CONTENT
  return (
    <div className="min-h-screen pb-20" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(200,120,0,0.2)' }}>
        <div className="flex items-center gap-3">
          <img src={shadowFlixLogo} alt="ShadowFlix" className="w-8 h-8 rounded-lg" />
          <h1 className="text-lg font-black text-white tracking-wider">
            SHADOW<span className="text-orange-500">FLIX</span>
          </h1>
        </div>
        {user && (
          <Button size="sm" onClick={() => { resetForm(); setShowUpload(true); }}
            className="bg-gradient-to-r from-orange-600 to-amber-500 text-white gap-1.5">
            <Plus className="w-4 h-4" /> Upload
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="container py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No content yet. Be the first to upload!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map(item => (
              <div key={item.id} className="group relative rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.03]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onClick={() => item.video_url && setPlayingItem(item)}>
                <div className="aspect-[2/3] relative">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <Film className="w-8 h-8 text-white/20" />
                    </div>
                  )}
                  {item.video_url && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <Play className="w-10 h-10 text-white" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-white text-xs font-medium truncate">{item.title}</p>
                </div>
                {/* Edit/Delete for owner */}
                {user && user.id === item.uploaded_by && (
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); openEdit(item); }}
                      className="p-1.5 rounded-full bg-black/70 text-white hover:bg-orange-600 transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                      className="p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload/Edit Dialog */}
      <Dialog open={showUpload} onOpenChange={o => { if (!o) { setShowUpload(false); resetForm(); } }}>
        <DialogContent className="bg-[#141414] border-orange-500/20 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-orange-500">{editingItem ? 'Edit Content' : 'Upload Content'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Title *</label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="Enter title" className="bg-white/5 border-white/10 text-white" />
            </div>

            {/* Thumbnail */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Thumbnail</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setThumbnailMode('file')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${thumbnailMode === 'file' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
                  <Image className="w-3 h-3 inline mr-1" /> File
                </button>
                <button onClick={() => setThumbnailMode('url')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${thumbnailMode === 'url' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'}`}>
                  <Link className="w-3 h-3 inline mr-1" /> URL
                </button>
              </div>
              {thumbnailMode === 'file' ? (
                <div>
                  <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && setThumbnailFile(e.target.files[0])} />
                  <Button variant="outline" size="sm" onClick={() => thumbnailInputRef.current?.click()}
                    className="border-white/10 text-white/70 gap-2 w-full">
                    <Upload className="w-3 h-3" /> {thumbnailFile ? thumbnailFile.name : 'Choose thumbnail image'}
                  </Button>
                </div>
              ) : (
                <Input value={formThumbnailUrl} onChange={e => setFormThumbnailUrl(e.target.value)}
                  placeholder="https://example.com/thumbnail.jpg" className="bg-white/5 border-white/10 text-white" />
              )}
            </div>

            {/* Video */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Video</label>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                onChange={e => e.target.files?.[0] && setVideoFile(e.target.files[0])} />
              <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()}
                className="border-white/10 text-white/70 gap-2 w-full mb-2">
                <Upload className="w-3 h-3" /> {videoFile ? videoFile.name : 'Choose video file'}
              </Button>
              <p className="text-[10px] text-white/30">Or paste a video URL below:</p>
              <Input value={formVideoUrl} onChange={e => setFormVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4" className="bg-white/5 border-white/10 text-white mt-1" />
            </div>

            <Button onClick={handleSubmit} disabled={uploading}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold">
              {uploading ? 'Uploading...' : editingItem ? 'Save Changes' : 'Upload'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Player Dialog */}
      <Dialog open={!!playingItem} onOpenChange={o => { if (!o) setPlayingItem(null); }}>
        <DialogContent className="bg-black border-white/10 text-white max-w-3xl p-0 overflow-hidden">
          <div className="relative">
            <button onClick={() => setPlayingItem(null)} className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white">
              <X className="w-4 h-4" />
            </button>
            {playingItem?.video_url && (
              <video src={playingItem.video_url} controls autoPlay className="w-full max-h-[80vh]" />
            )}
          </div>
          {playingItem && (
            <div className="p-3">
              <h3 className="text-white font-semibold">{playingItem.title}</h3>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
