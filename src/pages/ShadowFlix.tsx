import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Lock, Upload, Pencil, Trash2, Play, Plus, X, Link, Image, Film,
  LogOut, Search, Pause, Maximize, Minimize, SkipForward, SkipBack,
  Settings, ChevronDown, TrendingUp, Eye
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

interface SeriesGroup {
  title: string;
  items: ShadowFlixItem[];
  thumbnail: string | null;
  genre: string | null;
  totalViews: number;
}

/* ─── Watch count helpers ─── */
function getWatchCount(id: string): number {
  return parseInt(localStorage.getItem(`sf_views_${id}`) || '0', 10);
}
function incrementWatchCount(id: string) {
  const key = `sf_views_${id}`;
  localStorage.setItem(key, String(getWatchCount(id) + 1));
}

/* ─── Custom Netflix-style Video Player ─── */
function ShadowFlixPlayer({ item, onClose }: { item: ShadowFlixItem; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { incrementWatchCount(item.id); }, [item.id]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => { resetHideTimer(); return () => clearTimeout(hideTimer.current); }, [resetHideTimer]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  };

  const skip = (sec: number) => { if (videoRef.current) videoRef.current.currentTime += sec; };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) { await el.requestFullscreen?.(); setIsFullscreen(true); }
    else { await document.exitFullscreen?.(); setIsFullscreen(false); }
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

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black flex flex-col" onMouseMove={resetHideTimer} onClick={resetHideTimer}>
      <video ref={videoRef} src={item.video_url || ''} autoPlay className="w-full h-full object-contain"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)} onClick={togglePlay} />
      <div className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
            <div>
              <h3 className="text-white font-bold text-sm sm:text-base">{item.title}</h3>
              {(item.season_number || item.episode_number) && (
                <p className="text-white/50 text-xs">{item.season_number ? `S${item.season_number}` : ''}{item.episode_number ? ` E${item.episode_number}` : ''}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-white/40 text-xs"><Eye className="w-3.5 h-3.5" /> {getWatchCount(item.id)}</div>
        </div>
        <div className="bg-gradient-to-t from-black/90 to-transparent p-4 space-y-2">
          <div className="w-full h-1 bg-white/20 rounded-full cursor-pointer group" onClick={handleProgressClick}>
            <div className="h-full bg-red-600 rounded-full relative transition-all" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => skip(-10)} className="text-white hover:text-red-400 transition-colors"><SkipBack className="w-5 h-5" /></button>
              <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors">
                {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
              </button>
              <button onClick={() => skip(10)} className="text-white hover:text-red-400 transition-colors"><SkipForward className="w-5 h-5" /></button>
              <span className="text-white/70 text-xs ml-2">{fmt(currentTime)} / {fmt(duration)}</span>
            </div>
            <div className="flex items-center gap-2 relative">
              <div className="relative">
                <button onClick={() => setShowSettings(!showSettings)} className="text-white hover:text-red-400 transition-colors p-1"><Settings className="w-5 h-5" /></button>
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

/* ─── Series Detail View ─── */
function SeriesDetail({ group, userId, onPlay, onEdit, onDelete, onBack }: {
  group: SeriesGroup; userId?: string; onPlay: (i: ShadowFlixItem) => void;
  onEdit: (i: ShadowFlixItem) => void; onDelete: (id: string) => void; onBack: () => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const seasons = [...new Set(group.items.map(i => i.season_number || 1))].sort((a, b) => a - b);
  const episodes = group.items
    .filter(i => (i.season_number || 1) === selectedSeason)
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ChevronDown className="w-4 h-4 rotate-90" /> Back to library
      </button>

      {/* Series header */}
      <div className="flex gap-4 items-start">
        {group.thumbnail && (
          <img src={group.thumbnail} alt={group.title} className="w-28 sm:w-36 aspect-[2/3] rounded-xl object-cover border border-white/10" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-black text-white">{group.title}</h2>
          {group.genre && <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-400">{group.genre}</span>}
          <p className="text-white/40 text-xs mt-2">{group.items.length} episode{group.items.length > 1 ? 's' : ''} • {group.totalViews} views</p>
        </div>
      </div>

      {/* Season selector */}
      {seasons.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {seasons.map(s => (
            <button key={s} onClick={() => setSelectedSeason(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${selectedSeason === s ? 'bg-red-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
              Season {s}
            </button>
          ))}
        </div>
      )}

      {/* Episodes list */}
      <div className="space-y-2">
        {episodes.map(ep => (
          <div key={ep.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
            style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            onClick={() => ep.video_url && onPlay(ep)}>
            <div className="w-20 sm:w-28 aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
              {ep.thumbnail_url ? <img src={ep.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Film className="w-6 h-6 text-white/20 absolute inset-0 m-auto" />}
              {ep.video_url && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <Play className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {ep.episode_number ? `E${ep.episode_number} — ` : ''}{ep.title}
              </p>
              <p className="text-white/30 text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> {getWatchCount(ep.id)} views</p>
            </div>
            {userId && userId === ep.uploaded_by && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onEdit(ep); }} className="p-1.5 rounded-full bg-black/50 text-white hover:bg-red-600"><Pencil className="w-3 h-3" /></button>
                <button onClick={e => { e.stopPropagation(); onDelete(ep.id); }} className="p-1.5 rounded-full bg-black/50 text-white hover:bg-red-600"><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        ))}
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
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

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
    if (sessionStorage.getItem('shadowflix_unlocked') === 'true') setIsUnlocked(true);
  }, []);

  useEffect(() => { if (isUnlocked) fetchItems(); }, [isUnlocked]);

  useEffect(() => {
    if (thumbnailFile) {
      const url = URL.createObjectURL(thumbnailFile);
      setThumbnailPreview(url);
      return () => URL.revokeObjectURL(url);
    } else { setThumbnailPreview(null); }
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
    const { data, error } = await supabase.from('shadow_flix_content').select('*').order('created_at', { ascending: false });
    if (!error && data) setItems(data as ShadowFlixItem[]);
    setLoading(false);
  };

  const resetForm = () => {
    setFormTitle(''); setFormThumbnailUrl(''); setFormVideoUrl(''); setFormSeason('1');
    setFormEpisode(''); setFormGenre(''); setThumbnailFile(null); setVideoFile(null);
    setThumbnailMode('file'); setThumbnailPreview(null); setEditingItem(null);
  };

  const uploadFileToStorage = async (file: File, bucket: string, folder: string) => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) { toast.error('Title is required'); return; }
    if (!user) { toast.error('You must be logged in'); return; }
    setUploading(true);
    try {
      let finalThumbnail = formThumbnailUrl;
      let finalVideo = formVideoUrl;
      if (thumbnailFile) finalThumbnail = await uploadFileToStorage(thumbnailFile, 'anime-thumbnails', 'shadowflix');
      if (videoFile) finalVideo = await uploadFileToStorage(videoFile, 'anime-videos', 'shadowflix');

      const payload = {
        title: formTitle, thumbnail_url: finalThumbnail || null, video_url: finalVideo || null,
        season_number: formSeason ? parseInt(formSeason) : 1,
        episode_number: formEpisode ? parseInt(formEpisode) : null,
        genre: formGenre || null,
      };

      if (editingItem) {
        const { error } = await supabase.from('shadow_flix_content').update(payload).eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Updated successfully');
      } else {
        const { error } = await supabase.from('shadow_flix_content').insert({ ...payload, uploaded_by: user.id });
        if (error) throw error;
        toast.success('Uploaded successfully');
      }
      setShowUpload(false); resetForm(); fetchItems();
    } catch (err: any) {
      console.error('[ShadowFlix] Upload error:', err);
      toast.error(err.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    const { error } = await supabase.from('shadow_flix_content').delete().eq('id', id);
    if (error) toast.error('Delete failed');
    else { toast.success('Deleted'); fetchItems(); }
  };

  const openEdit = (item: ShadowFlixItem) => {
    setEditingItem(item); setFormTitle(item.title); setFormThumbnailUrl(item.thumbnail_url || '');
    setFormVideoUrl(item.video_url || ''); setFormSeason(String(item.season_number || 1));
    setFormEpisode(item.episode_number ? String(item.episode_number) : '');
    setFormGenre(item.genre || ''); setThumbnailMode('url'); setShowUpload(true);
  };

  // Group items by title for series grouping
  const seriesGroups = useMemo<SeriesGroup[]>(() => {
    const map = new Map<string, ShadowFlixItem[]>();
    items.forEach(item => {
      const key = item.title.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).map(([, groupItems]) => ({
      title: groupItems[0].title,
      items: groupItems.sort((a, b) => {
        const sa = a.season_number || 1, sb = b.season_number || 1;
        if (sa !== sb) return sa - sb;
        return (a.episode_number || 0) - (b.episode_number || 0);
      }),
      thumbnail: groupItems[0].thumbnail_url,
      genre: groupItems[0].genre,
      totalViews: groupItems.reduce((sum, i) => sum + getWatchCount(i.id), 0),
    }));
  }, [items]);

  const filteredGroups = seriesGroups.filter(g => {
    const matchesSearch = !searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || g.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  // Most Popular (top 5 by views)
  const mostPopular = useMemo(() =>
    [...seriesGroups].sort((a, b) => b.totalViews - a.totalViews).slice(0, 5).filter(g => g.totalViews > 0),
  [seriesGroups]);

  const availableGenres = [...new Set(items.map(i => i.genre).filter(Boolean))] as string[];

  const activeSeriesGroup = selectedSeries ? seriesGroups.find(g => g.title.toLowerCase() === selectedSeries.toLowerCase()) : null;

  // ─── PASSWORD GATE ───
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'radial-gradient(ellipse at 30% 70%, rgba(180,0,0,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(180,0,0,0.08) 0%, transparent 50%), #0a0a0a' }}>
        <div className="w-full max-w-sm rounded-2xl p-8 text-center space-y-6"
          style={{ background: 'rgba(20,10,10,0.9)', backdropFilter: 'blur(24px)', border: '1px solid rgba(220,30,30,0.25)', boxShadow: '0 0 60px rgba(220,30,30,0.08)' }}>
          <img src={shadowFlixLogo} alt="ShadowFlix" className="w-20 h-20 rounded-xl mx-auto shadow-lg" />
          <h1 className="text-2xl font-black tracking-wider text-white">SHADOW<span className="text-red-500">FLIX</span></h1>
          <p className="text-white/40 text-xs uppercase tracking-widest">Private Streaming Vault</p>
          <div className="space-y-2 text-left bg-white/5 rounded-lg p-3">
            <p className="text-white/60 text-xs leading-relaxed">
              🔒 This is a restricted section exclusively for authorized members. Shadow Flix hosts premium content managed independently from the main library.
            </p>
            <p className="text-white/40 text-[10px] leading-relaxed">
              • Upload & manage your own anime series with seasons & episodes<br/>
              • Custom Netflix-style player with speed controls<br/>
              • Content here is private and won't appear in public feeds<br/>
              • Contact an admin if you don't have the access code
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500 shrink-0" />
            <Input type="password" placeholder="Enter access code" value={password}
              onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
          <Button onClick={handleUnlock} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">Unlock Access</Button>
          <p className="text-white/20 text-[10px]">Secured by Shadow Toons & AnimeSavi</p>
        </div>
      </div>
    );
  }

  if (playingItem) return <ShadowFlixPlayer item={playingItem} onClose={() => setPlayingItem(null)} />;

  // ─── MAIN ───
  return (
    <div className="min-h-screen pb-20" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(220,30,30,0.15)' }}>
        <div className="flex items-center gap-3">
          <img src={shadowFlixLogo} alt="ShadowFlix" className="w-8 h-8 rounded-lg" />
          <h1 className="text-lg font-black text-white tracking-wider hidden sm:block">SHADOW<span className="text-red-500">FLIX</span></h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Button size="sm" onClick={() => { resetForm(); setShowUpload(true); }} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
              <Plus className="w-4 h-4" /> Upload
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleLogout} className="text-white/50 hover:text-red-400 hover:bg-white/5 gap-1.5">
            <LogOut className="w-4 h-4" /> Lock
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="container py-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Shadow Flix..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white"><SelectValue placeholder="Genre" /></SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              <SelectItem value="all" className="text-white">All Genres</SelectItem>
              {availableGenres.map(g => <SelectItem key={g} value={g} className="text-white">{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="container space-y-6">
        {/* Series Detail View */}
        {activeSeriesGroup ? (
          <SeriesDetail group={activeSeriesGroup} userId={user?.id}
            onPlay={setPlayingItem} onEdit={openEdit} onDelete={handleDelete}
            onBack={() => setSelectedSeries(null)} />
        ) : (
          <>
            {/* Most Popular Section */}
            {mostPopular.length > 0 && !searchQuery && selectedGenre === 'all' && (
              <div>
                <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500" /> Most Popular
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {mostPopular.map((g, i) => (
                    <div key={g.title} className="shrink-0 w-32 sm:w-40 cursor-pointer group"
                      onClick={() => g.items.length > 1 ? setSelectedSeries(g.title) : g.items[0]?.video_url && setPlayingItem(g.items[0])}>
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-black">{i + 1}</div>
                        {g.thumbnail ? <img src={g.thumbnail} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Film className="w-6 h-6 text-white/20" /></div>}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white/50 text-[10px] flex items-center gap-1"><Eye className="w-3 h-3" /> {g.totalViews}</p>
                        </div>
                      </div>
                      <p className="text-white text-xs font-medium mt-1.5 truncate">{g.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Grid (grouped by series) */}
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-20 text-white/40">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{searchQuery || selectedGenre !== 'all' ? 'No results found' : 'No content yet. Be the first to upload!'}</p>
              </div>
            ) : (
              <div>
                <h2 className="text-white font-bold text-lg mb-3">Library</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredGroups.map(g => {
                    const isSeries = g.items.length > 1;
                    return (
                      <div key={g.title} className="group relative rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.03]"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        onClick={() => isSeries ? setSelectedSeries(g.title) : g.items[0]?.video_url && setPlayingItem(g.items[0])}>
                        <div className="aspect-[2/3] relative">
                          {g.thumbnail ? <img src={g.thumbnail} alt={g.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center bg-white/5"><Film className="w-8 h-8 text-white/20" /></div>}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                            <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                              <Play className="w-5 h-5 text-white ml-0.5" />
                            </div>
                          </div>
                          {isSeries && (
                            <div className="absolute top-1.5 right-1.5 bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              {g.items.length} EP
                            </div>
                          )}
                          {g.genre && (
                            <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white/70 text-[9px] px-1.5 py-0.5 rounded">{g.genre}</div>
                          )}
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <p className="text-white text-xs font-medium truncate flex-1">{g.title}</p>
                          {g.totalViews > 0 && (
                            <span className="text-white/30 text-[10px] flex items-center gap-0.5 shrink-0 ml-1"><Eye className="w-3 h-3" /> {g.totalViews}</span>
                          )}
                        </div>
                        {/* Edit/Delete for single items */}
                        {!isSeries && user && user.id === g.items[0].uploaded_by && (
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); openEdit(g.items[0]); }}
                              className="p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"><Pencil className="w-3 h-3" /></button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(g.items[0].id); }}
                              className="p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
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
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Enter title"
                className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Season</label>
                <Input type="number" min="1" value={formSeason} onChange={e => setFormSeason(e.target.value)} placeholder="1"
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Episode</label>
                <Input type="number" min="1" value={formEpisode} onChange={e => setFormEpisode(e.target.value)} placeholder="e.g. 1"
                  className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Genre</label>
              <Select value={formGenre} onValueChange={setFormGenre}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select genre" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {GENRES.map(g => <SelectItem key={g} value={g} className="text-white">{g}</SelectItem>)}
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
              {(thumbnailPreview || (thumbnailMode === 'url' && formThumbnailUrl)) && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                  <img src={thumbnailPreview || formThumbnailUrl} alt="Thumbnail preview"
                    className="w-full h-32 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
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
            <Button onClick={handleSubmit} disabled={uploading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
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
