import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Lock, Upload, Pencil, Trash2, Play, Plus, X, Link, Image, Film,
  LogOut, Search, Pause, Maximize, Minimize, SkipForward, SkipBack,
  Settings, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import shadowFlixLogo from '@/assets/shadowflix-logo.jpg';

const SHADOW_FLIX_PASSWORD = 'SHADOW X SAVI';

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Thriller', 'Mystery', 'Supernatural'];

interface ShadowFlixItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  uploaded_by: string;
  created_at: string;
  season_number: number | null;
  episode_number: number | null;
  genre: string | null;
}

/* ─── Custom Netflix-style Video Player ─── */
function ShadowFlixPlayer({ item, onClose }: { item: ShadowFlixItem; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [resetHideTimer]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  };

  const skip = (sec: number) => {
    if (videoRef.current) videoRef.current.currentTime += sec;
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) videoRef.current.currentTime = pct * duration;
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setShowSettings(false);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black flex flex-col"
      onMouseMove={resetHideTimer} onClick={resetHideTimer}>
      <video
        ref={videoRef}
        src={item.video_url || ''}
        autoPlay
        className="w-full h-full object-contain"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* Controls Overlay */}
      <div className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
              <X className="w-5 h-5 text-white" />
            </button>
            <div>
              <h3 className="text-white font-bold text-sm sm:text-base">{item.title}</h3>
              {(item.season_number || item.episode_number) && (
                <p className="text-white/50 text-xs">
                  {item.season_number ? `S${item.season_number}` : ''}{item.episode_number ? ` E${item.episode_number}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="bg-gradient-to-t from-black/90 to-transparent p-4 space-y-2">
          {/* Progress bar */}
          <div ref={progressRef} className="w-full h-1 bg-white/20 rounded-full cursor-pointer group"
            onClick={handleProgressClick}>
            <div className="h-full bg-red-600 rounded-full relative transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => skip(-10)} className="text-white hover:text-red-400 transition-colors">
                <SkipBack className="w-5 h-5" />
              </button>
              <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors">
                {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
              </button>
              <button onClick={() => skip(10)} className="text-white hover:text-red-400 transition-colors">
                <SkipForward className="w-5 h-5" />
              </button>
              <span className="text-white/70 text-xs ml-2">{fmt(currentTime)} / {fmt(duration)}</span>
            </div>

            <div className="flex items-center gap-2 relative">
              <div className="relative">
                <button onClick={() => setShowSettings(!showSettings)}
                  className="text-white hover:text-red-400 transition-colors p-1">
                  <Settings className="w-5 h-5" />
                </button>
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-lg p-2 min-w-[140px] shadow-xl">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1 px-2">Speed</p>
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                      <button key={r} onClick={() => setSpeed(r)}
                        className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${playbackRate === r ? 'text-red-500 bg-red-500/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                        {r === 1 ? 'Normal' : `${r}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={toggleFullscreen} className="text-white hover:text-red-400 transition-colors p-1">
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formSeason, setFormSeason] = useState('1');
  const [formEpisode, setFormEpisode] = useState('');
  const [formGenre, setFormGenre] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbnailMode, setThumbnailMode] = useState<'file' | 'url'>('file');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unlocked = sessionStorage.getItem('shadowflix_unlocked');
    if (unlocked === 'true') setIsUnlocked(true);
  }, []);

  useEffect(() => {
    if (isUnlocked) fetchItems();
  }, [isUnlocked]);

  // Thumbnail file preview
  useEffect(() => {
    if (thumbnailFile) {
      const url = URL.createObjectURL(thumbnailFile);
      setThumbnailPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setThumbnailPreview(null);
    }
  }, [thumbnailFile]);

  const handleUnlock = () => {
    if (password.toUpperCase() === SHADOW_FLIX_PASSWORD) {
      setIsUnlocked(true);
      sessionStorage.setItem('shadowflix_unlocked', 'true');
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Try again.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('shadowflix_unlocked');
    setIsUnlocked(false);
    setPassword('');
    toast.info('Shadow Flix locked');
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
    setFormSeason('1');
    setFormEpisode('');
    setFormGenre('');
    setThumbnailFile(null);
    setVideoFile(null);
    setThumbnailMode('file');
    setThumbnailPreview(null);
    setEditingItem(null);
  };

  const uploadFileToStorage = async (file: File, bucket: string, folder: string) => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) { toast.error('Title is required'); return; }
    if (!user) { toast.error('You must be logged in'); return; }

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

      const payload = {
        title: formTitle,
        thumbnail_url: finalThumbnail || null,
        video_url: finalVideo || null,
        season_number: formSeason ? parseInt(formSeason) : 1,
        episode_number: formEpisode ? parseInt(formEpisode) : null,
        genre: formGenre || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('shadow_flix_content')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Updated successfully');
      } else {
        const { error } = await supabase
          .from('shadow_flix_content')
          .insert({ ...payload, uploaded_by: user.id });
        if (error) throw error;
        toast.success('Uploaded successfully');
      }

      setShowUpload(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      console.error('[ShadowFlix] Upload error:', err);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    const { error } = await supabase.from('shadow_flix_content').delete().eq('id', id);
    if (error) toast.error('Delete failed');
    else { toast.success('Deleted'); fetchItems(); }
  };

  const openEdit = (item: ShadowFlixItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormThumbnailUrl(item.thumbnail_url || '');
    setFormVideoUrl(item.video_url || '');
    setFormSeason(String(item.season_number || 1));
    setFormEpisode(item.episode_number ? String(item.episode_number) : '');
    setFormGenre(item.genre || '');
    setThumbnailMode('url');
    setShowUpload(true);
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || item.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  // Group by series (title) for display
  const availableGenres = [...new Set(items.map(i => i.genre).filter(Boolean))] as string[];

  // ─── PASSWORD GATE ───
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'radial-gradient(ellipse at 30% 70%, rgba(180,0,0,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(180,0,0,0.08) 0%, transparent 50%), #0a0a0a' }}>
        <div className="w-full max-w-sm rounded-2xl p-8 text-center space-y-6"
          style={{
            background: 'rgba(20,10,10,0.9)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(220,30,30,0.25)',
            boxShadow: '0 0 60px rgba(220,30,30,0.08)',
          }}>
          <img src={shadowFlixLogo} alt="ShadowFlix" className="w-20 h-20 rounded-xl mx-auto shadow-lg" />
          <h1 className="text-2xl font-black tracking-wider text-white">
            SHADOW<span className="text-red-500">FLIX</span>
          </h1>
          <p className="text-white/50 text-sm">This section is password protected</p>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500 shrink-0" />
            <Input type="password" placeholder="Enter password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
          <Button onClick={handleUnlock}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
            Unlock Access
          </Button>
        </div>
      </div>
    );
  }

  // ─── PLAYER ───
  if (playingItem) {
    return <ShadowFlixPlayer item={playingItem} onClose={() => setPlayingItem(null)} />;
  }

  // ─── MAIN ───
  return (
    <div className="min-h-screen pb-20" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(220,30,30,0.15)' }}>
        <div className="flex items-center gap-3">
          <img src={shadowFlixLogo} alt="ShadowFlix" className="w-8 h-8 rounded-lg" />
          <h1 className="text-lg font-black text-white tracking-wider hidden sm:block">
            SHADOW<span className="text-red-500">FLIX</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Button size="sm" onClick={() => { resetForm(); setShowUpload(true); }}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
              <Plus className="w-4 h-4" /> Upload
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleLogout}
            className="text-white/50 hover:text-red-400 hover:bg-white/5 gap-1.5">
            <LogOut className="w-4 h-4" /> Lock
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="container py-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Shadow Flix..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="all" className="text-white">All Genres</SelectItem>
              {availableGenres.map(g => (
                <SelectItem key={g} value={g} className="text-white">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Grid */}
      <div className="container">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{searchQuery || selectedGenre !== 'all' ? 'No results found' : 'No content yet. Be the first to upload!'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredItems.map(item => (
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
                      <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </div>
                    </div>
                  )}
                  {/* Episode badge */}
                  {(item.season_number || item.episode_number) && (
                    <div className="absolute top-1.5 left-1.5 bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {item.season_number ? `S${item.season_number}` : ''}{item.episode_number ? `E${item.episode_number}` : ''}
                    </div>
                  )}
                  {item.genre && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white/70 text-[9px] px-1.5 py-0.5 rounded">
                      {item.genre}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-white text-xs font-medium truncate">{item.title}</p>
                </div>
                {user && user.id === item.uploaded_by && (
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); openEdit(item); }}
                      className="p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors">
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
        <DialogContent className="bg-[#141414] border-red-500/20 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-red-500">{editingItem ? 'Edit Content' : 'Upload Content'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Title *</label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="Enter title" className="bg-white/5 border-white/10 text-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Season</label>
                <Input type="number" min="1" value={formSeason} onChange={e => setFormSeason(e.target.value)}
                  placeholder="1" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Episode</label>
                <Input type="number" min="1" value={formEpisode} onChange={e => setFormEpisode(e.target.value)}
                  placeholder="e.g. 1" className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 mb-1 block">Genre</label>
              <Select value={formGenre} onValueChange={setFormGenre}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {GENRES.map(g => (
                    <SelectItem key={g} value={g} className="text-white">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Thumbnail */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Thumbnail</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setThumbnailMode('file')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${thumbnailMode === 'file' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/50'}`}>
                  <Image className="w-3 h-3 inline mr-1" /> File
                </button>
                <button onClick={() => setThumbnailMode('url')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${thumbnailMode === 'url' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/50'}`}>
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
              {/* Thumbnail Preview */}
              {(thumbnailPreview || (thumbnailMode === 'url' && formThumbnailUrl)) && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                  <img
                    src={thumbnailPreview || formThumbnailUrl}
                    alt="Thumbnail preview"
                    className="w-full h-32 object-cover"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                </div>
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
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
              {uploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </span>
              ) : editingItem ? 'Save Changes' : 'Upload'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
