import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Lock, Upload, Pencil, Trash2, Play, Plus, X, Link, Image, Film,
  LogOut, Search, Pause, Maximize, Minimize, SkipForward, SkipBack,
  Settings, ChevronDown, ChevronLeft, TrendingUp, Eye, Share2, Copy, Check,
  Palette, Monitor, List, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import shadowFlixLogo from '@/assets/shadowflix-logo.jpg';

const SHADOW_FLIX_PASSWORD = 'SHADOW X SAVI';
const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Thriller', 'Mystery', 'Supernatural'];

const PLAYER_THEMES = [
  { name: 'Netflix Red', accent: '#e50914', bg: 'rgba(229,9,20,0.1)' },
  { name: 'Electric Blue', accent: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
  { name: 'Emerald', accent: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { name: 'Purple Haze', accent: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  { name: 'Gold', accent: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { name: 'Hot Pink', accent: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
];

interface ShadowFlixItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  banner_url?: string | null;
  video_url: string | null;
  uploaded_by: string;
  created_at: string;
  season_number: number | null;
  episode_number: number | null;
  genre: string | null;
  genres?: string[] | null;
  description?: string | null;
}

interface SeriesGroup {
  title: string;
  items: ShadowFlixItem[];
  thumbnail: string | null;
  banner: string | null;
  genre: string | null;
  genres: string[];
  totalViews: number;
  description: string | null;
}

function getWatchCount(id: string): number {
  return parseInt(localStorage.getItem(`sf_views_${id}`) || '0', 10);
}
function incrementWatchCount(id: string) {
  localStorage.setItem(`sf_views_${id}`, String(getWatchCount(id) + 1));
}

function getPlayerTheme(): typeof PLAYER_THEMES[0] {
  const saved = localStorage.getItem('sf_player_theme');
  if (saved) { try { return JSON.parse(saved); } catch { /* */ } }
  return PLAYER_THEMES[0];
}
function savePlayerTheme(theme: typeof PLAYER_THEMES[0]) {
  localStorage.setItem('sf_player_theme', JSON.stringify(theme));
}

function generateShareFilename(title: string, season?: number | null, episode?: number | null) {
  const clean = title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const ep = episode ? `_E${String(episode).padStart(2, '0')}` : '';
  const sn = season ? `_S${String(season).padStart(2, '0')}` : '';
  return `${clean}${sn}${ep}_H264_720p_{AnimeSavi_X_Shadow-Toons}.mp4`;
}

/* ── Helper: detect if URL is an embed/external link ── */
function isEmbedUrl(url: string | null): boolean {
  if (!url) return false;
  // If it's a direct file URL (storage, .mp4, .mkv, .webm) → not embed
  if (/\.(mp4|mkv|webm|avi|mov)(\?|$)/i.test(url)) return false;
  // If it contains embed or iframe-related patterns
  if (/embed|iframe|youtube\.com\/embed|player\.|dailymotion|streamtape|filemoon|mega\.nz/i.test(url)) return true;
  // If it's a supabase storage URL → not embed
  if (url.includes('supabase.co/storage')) return false;
  // Default: if it's an http(s) URL that doesn't look like a direct video file, treat as embed
  return /^https?:\/\//i.test(url) && !url.includes('supabase');
}

/* ─── Custom Video Player ─── */
function ShadowFlixPlayer({
  item, onClose, allEpisodes, onChangeEpisode, seriesGroup
}: {
  item: ShadowFlixItem;
  onClose: () => void;
  allEpisodes?: ShadowFlixItem[];
  onChangeEpisode?: (ep: ShadowFlixItem) => void;
  seriesGroup?: SeriesGroup | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [theme, setTheme] = useState(getPlayerTheme);
  const [selectedSeason, setSelectedSeason] = useState<number>(item.season_number || 1);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const isEmbed = isEmbedUrl(item.video_url);

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
    if (v.paused) { v.play(); setIsPlaying(true); } else { v.pause(); setIsPlaying(false); }
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
  const setSpeed = (rate: number) => { setPlaybackRate(rate); if (videoRef.current) videoRef.current.playbackRate = rate; setShowSettings(false); };
  const handleThemeChange = (t: typeof PLAYER_THEMES[0]) => { setTheme(t); savePlayerTheme(t); setShowThemePicker(false); };

  const shareText = `🎬 ${item.title}${item.season_number ? ` S${item.season_number}` : ''}${item.episode_number ? ` EP${item.episode_number}` : ''}\n📦 Codec: H.264 (AVC)\n📺 Quality: 720p HD\n📁 ${generateShareFilename(item.title, item.season_number, item.episode_number)}\n\n🔗 Powered by AnimeSavi X Shadow-Toons`;
  const handleCopyShare = async () => { await navigator.clipboard.writeText(shareText); setCopied(true); toast.success('Share info copied!'); setTimeout(() => setCopied(false), 2000); };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  const seasons = allEpisodes ? [...new Set(allEpisodes.map(e => e.season_number || 1))].sort((a, b) => a - b) : [];
  const seasonEpisodes = allEpisodes?.filter(e => (e.season_number || 1) === selectedSeason)
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0)) || [];

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      {/* Player Section */}
      <div className="relative w-full bg-black" style={{ aspectRatio: isFullscreen ? undefined : '16/9', height: isFullscreen ? '100vh' : undefined }}
        onMouseMove={resetHideTimer} onClick={resetHideTimer}>
        {isEmbed ? (
          <iframe src={item.video_url || ''} className="w-full h-full" allowFullScreen
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            style={{ border: 'none', minHeight: isFullscreen ? '100vh' : '300px' }} />
        ) : (
          <video ref={videoRef} src={item.video_url || ''} autoPlay className="w-full h-full object-contain"
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)} onClick={togglePlay} />
        )}

        {/* Controls Overlay (only for direct video) */}
        {!isEmbed && (
          <div className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
                <div>
                  <h3 className="text-white font-bold text-sm sm:text-base">{item.title}</h3>
                  {(item.season_number || item.episode_number) && (
                    <p className="text-white/50 text-xs">
                      {item.season_number ? `Season ${item.season_number}` : ''}{item.episode_number ? ` • Episode ${item.episode_number}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowShare(true); setShowEpisodes(false); }} className="p-2 rounded-full hover:bg-white/10"><Share2 className="w-4 h-4 text-white" /></button>
                {allEpisodes && allEpisodes.length > 1 && (
                  <button onClick={() => { setShowEpisodes(!showEpisodes); setShowShare(false); }} className="p-2 rounded-full hover:bg-white/10"><List className="w-4 h-4 text-white" /></button>
                )}
              </div>
            </div>

            {showEpisodes && allEpisodes && (
              <div className="absolute top-12 right-0 bottom-20 w-72 bg-black/95 border-l border-white/10 overflow-y-auto z-20 p-3 space-y-1" onClick={e => e.stopPropagation()}>
                <p className="text-white/50 text-xs uppercase tracking-wider mb-2 px-1">Episodes</p>
                {allEpisodes.map(ep => (
                  <button key={ep.id} onClick={() => { onChangeEpisode?.(ep); setShowEpisodes(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${ep.id === item.id ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                    style={ep.id === item.id ? { background: `${theme.accent}22`, color: theme.accent } : {}}>
                    {ep.thumbnail_url && <img src={ep.thumbnail_url} className="w-12 h-8 rounded object-cover shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ep.episode_number ? `E${ep.episode_number}` : ''} {ep.title}</p>
                      <p className="text-[10px] text-white/30">{ep.season_number ? `S${ep.season_number}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showShare && (
              <div className="absolute top-12 right-0 w-80 bg-black/95 border-l border-white/10 z-20 p-4 space-y-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold text-sm">Share Info</p>
                  <button onClick={() => setShowShare(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-xs text-white/70 space-y-1 font-mono whitespace-pre-wrap">{shareText}</div>
                <Button onClick={handleCopyShare} size="sm" className="w-full gap-2" style={{ background: theme.accent }}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied!' : 'Copy Share Info'}
                </Button>
              </div>
            )}

            <div className="bg-gradient-to-t from-black/90 to-transparent p-4 space-y-2">
              <div className="w-full h-1 bg-white/20 rounded-full cursor-pointer group" onClick={handleProgressClick}>
                <div className="h-full rounded-full relative transition-all" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%`, background: theme.accent }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: theme.accent }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => skip(-10)} className="text-white hover:opacity-80"><SkipBack className="w-5 h-5" /></button>
                  <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90" style={{ background: theme.accent }}>
                    {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                  </button>
                  <button onClick={() => skip(10)} className="text-white hover:opacity-80"><SkipForward className="w-5 h-5" /></button>
                  <span className="text-white/70 text-xs ml-2">{fmt(currentTime)} / {fmt(duration)}</span>
                </div>
                <div className="flex items-center gap-2 relative">
                  <div className="relative">
                    <button onClick={() => { setShowThemePicker(!showThemePicker); setShowSettings(false); }} className="text-white hover:opacity-80 p-1"><Palette className="w-5 h-5" /></button>
                    {showThemePicker && (
                      <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-lg p-2 min-w-[160px] shadow-xl" onClick={e => e.stopPropagation()}>
                        <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1 px-2">Player Color</p>
                        {PLAYER_THEMES.map(t => (
                          <button key={t.name} onClick={() => handleThemeChange(t)}
                            className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${theme.name === t.name ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.accent }} />{t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button onClick={() => { setShowSettings(!showSettings); setShowThemePicker(false); }} className="text-white hover:opacity-80 p-1"><Settings className="w-5 h-5" /></button>
                    {showSettings && (
                      <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-lg p-2 min-w-[140px] shadow-xl" onClick={e => e.stopPropagation()}>
                        <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1 px-2">Speed</p>
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                          <button key={r} onClick={() => setSpeed(r)}
                            className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${playbackRate === r ? 'bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                            style={playbackRate === r ? { color: theme.accent } : {}}>
                            {r === 1 ? 'Normal' : `${r}x`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={toggleFullscreen} className="text-white hover:opacity-80 p-1">
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* For embed: just a close and title bar */}
        {isEmbed && (
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
              <h3 className="text-white font-bold text-sm">{item.title}
                {item.season_number ? ` S${item.season_number}` : ''}{item.episode_number ? ` EP${item.episode_number}` : ''}
              </h3>
            </div>
          </div>
        )}
      </div>

      {/* Below Player: Anime Details + Episodes */}
      <div className="flex-1 px-4 py-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Anime Info */}
        <div className="flex gap-4">
          {(seriesGroup?.thumbnail || item.thumbnail_url) && (
            <img src={seriesGroup?.thumbnail || item.thumbnail_url || ''} alt="" className="w-24 sm:w-32 aspect-[2/3] rounded-xl object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-xl sm:text-2xl font-black">{item.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {(seriesGroup?.genre || item.genre) && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${theme.accent}22`, color: theme.accent }}>
                  {seriesGroup?.genre || item.genre}
                </span>
              )}
              {item.season_number && <span className="text-white/40 text-xs">Season {item.season_number}</span>}
              {item.episode_number && <span className="text-white/40 text-xs">• Episode {item.episode_number}</span>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-white/40">
              <div><span className="text-white/20">Codec:</span> H.264</div>
              <div><span className="text-white/20">Quality:</span> 720p HD</div>
              <div><span className="text-white/20">Format:</span> MP4</div>
              <div><span className="text-white/20">Source:</span> AnimeSavi X Shadow-Toons</div>
            </div>
            {seriesGroup?.description && (
              <p className="text-white/50 text-sm mt-3 leading-relaxed">{seriesGroup.description}</p>
            )}
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={handleCopyShare} className="border-white/10 text-white/70 hover:text-white gap-2">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}{copied ? 'Copied!' : 'Share'}
              </Button>
            </div>
          </div>
        </div>

        {/* Season & Episode Selector */}
        {allEpisodes && allEpisodes.length > 0 && (
          <div className="space-y-4">
            {seasons.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {seasons.map(s => (
                  <button key={s} onClick={() => setSelectedSeason(s)}
                    className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
                    style={selectedSeason === s ? { background: theme.accent, color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                    Season {s}
                  </button>
                ))}
              </div>
            )}
            <h3 className="text-white font-bold text-base">{seasons.length > 1 ? `Season ${selectedSeason} Episodes` : 'Episodes'}</h3>
            <div className="space-y-2">
              {seasonEpisodes.map((ep, idx) => (
                <div key={ep.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors group ${ep.id === item.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  style={{ border: ep.id === item.id ? `1px solid ${theme.accent}44` : '1px solid rgba(255,255,255,0.05)' }}
                  onClick={() => ep.video_url && onChangeEpisode?.(ep)}>
                  <span className="text-white/20 text-sm font-bold w-6 text-center shrink-0">{idx + 1}</span>
                  <div className="w-20 sm:w-28 aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
                    {ep.thumbnail_url ? <img src={ep.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Film className="w-5 h-5 text-white/20 absolute inset-0 m-auto" />}
                    {ep.id === item.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: theme.accent }}>
                          <Play className="w-3 h-3 text-white ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate" style={ep.id === item.id ? { color: theme.accent } : {}}>
                      {ep.episode_number ? `Episode ${ep.episode_number}` : ep.title}
                    </p>
                    <p className="text-white/30 text-xs mt-0.5">{ep.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Anime Detail View ─── */
function AnimeDetailView({
  group, userId, onPlay, onEdit, onDelete, onBack, playerTheme
}: {
  group: SeriesGroup;
  userId?: string;
  onPlay: (item: ShadowFlixItem, allEps: ShadowFlixItem[]) => void;
  onEdit: (i: ShadowFlixItem) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  playerTheme: typeof PLAYER_THEMES[0];
}) {
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [copied, setCopied] = useState(false);
  const seasons = [...new Set(group.items.map(i => i.season_number || 1))].sort((a, b) => a - b);
  const episodes = group.items
    .filter(i => (i.season_number || 1) === selectedSeason)
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  const firstEp = episodes[0];

  const shareText = `🎬 ${group.title}\n📺 ${group.items.length} Episode${group.items.length > 1 ? 's' : ''} • ${seasons.length} Season${seasons.length > 1 ? 's' : ''}\n📦 Codec: H.264 (AVC) | Quality: 720p HD\n📁 ${generateShareFilename(group.title, 1, 1)}\n\n🔗 Powered by AnimeSavi X Shadow-Toons`;
  const handleCopyShare = async () => { await navigator.clipboard.writeText(shareText); setCopied(true); toast.success('Share info copied!'); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to library
      </button>

      {/* Cinematic Banner Hero */}
      {group.banner && (
        <div className="relative w-full rounded-2xl overflow-hidden aspect-[21/9] sm:aspect-[21/8]">
          <img src={group.banner} alt={group.title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <h2 className="text-3xl sm:text-5xl font-black text-white drop-shadow-2xl leading-tight">{group.title}</h2>
            {group.description && <p className="text-white/70 text-sm sm:text-base mt-2 max-w-2xl line-clamp-3">{group.description}</p>}
            {firstEp?.video_url && (
              <Button onClick={() => onPlay(firstEp, group.items)} className="gap-2 font-bold text-white mt-4" style={{ background: playerTheme.accent }}>
                <Play className="w-4 h-4" /> Watch Now
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex flex-col sm:flex-row gap-0">
          <div className="sm:w-56 shrink-0">
            {group.thumbnail ? (
              <img src={group.thumbnail} alt={group.title} className="w-full aspect-[2/3] sm:h-full object-cover" />
            ) : (
              <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center"><Film className="w-12 h-12 text-white/20" /></div>
            )}
          </div>
          <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(30,10,10,0.95) 100%)' }}>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{group.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {group.genres.length > 0 ? (
                  group.genres.map(g => (
                    <span key={g} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${playerTheme.accent}22`, color: playerTheme.accent }}>{g}</span>
                  ))
                ) : group.genre && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${playerTheme.accent}22`, color: playerTheme.accent }}>{group.genre}</span>
                )}
                <span className="text-white/40 text-xs">•</span>
                <span className="text-white/50 text-xs">{group.items.length} Episode{group.items.length > 1 ? 's' : ''}</span>
                <span className="text-white/40 text-xs">•</span>
                <span className="text-white/50 text-xs">{seasons.length} Season{seasons.length > 1 ? 's' : ''}</span>
                <span className="text-white/40 text-xs">•</span>
                <span className="text-white/50 text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> {group.totalViews} views</span>
              </div>
              {group.description && (
                <p className="text-white/50 text-sm mt-3 leading-relaxed">{group.description}</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/40">
                <div><span className="text-white/20">Codec:</span> H.264 (AVC)</div>
                <div><span className="text-white/20">Quality:</span> 720p HD</div>
                <div><span className="text-white/20">Format:</span> MP4</div>
                <div><span className="text-white/20">Source:</span> AnimeSavi X Shadow-Toons</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {firstEp?.video_url && (
                <Button onClick={() => onPlay(firstEp, group.items)} className="gap-2 font-bold text-white" style={{ background: playerTheme.accent }}>
                  <Play className="w-4 h-4" /> Watch Now
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyShare} className="border-white/10 text-white/70 hover:text-white gap-2">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}{copied ? 'Copied!' : 'Share'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {seasons.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {seasons.map(s => (
            <button key={s} onClick={() => setSelectedSeason(s)}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
              style={selectedSeason === s ? { background: playerTheme.accent, color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
              Season {s}
            </button>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-white font-bold text-base mb-3">{seasons.length > 1 ? `Season ${selectedSeason} Episodes` : 'Episodes'}</h3>
        <div className="space-y-2">
          {episodes.map((ep, idx) => (
            <div key={ep.id}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
              style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              onClick={() => ep.video_url && onPlay(ep, group.items)}>
              <span className="text-white/20 text-sm font-bold w-6 text-center shrink-0">{idx + 1}</span>
              <div className="w-24 sm:w-32 aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
                {ep.thumbnail_url ? <img src={ep.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Film className="w-6 h-6 text-white/20 absolute inset-0 m-auto" />}
                {ep.video_url && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <Play className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{ep.episode_number ? `Episode ${ep.episode_number}` : ep.title}</p>
                <p className="text-white/30 text-xs mt-0.5">{ep.title}</p>
                <p className="text-white/20 text-[10px] flex items-center gap-1 mt-1"><Eye className="w-3 h-3" /> {getWatchCount(ep.id)} views</p>
              </div>
              {userId && userId === ep.uploaded_by && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); onEdit(ep); }} className="p-1.5 rounded-full bg-black/50 text-white hover:bg-white/20"><Pencil className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); onDelete(ep.id); }} className="p-1.5 rounded-full bg-black/50 text-white hover:bg-white/20"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          ))}
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
  const [playingEpisodes, setPlayingEpisodes] = useState<ShadowFlixItem[]>([]);
  const [playingSeriesGroup, setPlayingSeriesGroup] = useState<SeriesGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [playerTheme] = useState(getPlayerTheme);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState('');
  const [formBannerUrl, setFormBannerUrl] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formSeason, setFormSeason] = useState('1');
  const [formEpisode, setFormEpisode] = useState('');
  const [formGenres, setFormGenres] = useState<string[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbnailMode, setThumbnailMode] = useState<'file' | 'url'>('file');
  const [bannerMode, setBannerMode] = useState<'file' | 'url'>('file');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingSeries, setSelectedExistingSeries] = useState<string | null>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (bannerFile) {
      const url = URL.createObjectURL(bannerFile);
      setBannerPreview(url);
      return () => URL.revokeObjectURL(url);
    } else { setBannerPreview(null); }
  }, [bannerFile]);

  const toggleGenre = (g: string) => {
    setFormGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

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
    setFormTitle(''); setFormDescription(''); setFormThumbnailUrl(''); setFormBannerUrl('');
    setFormVideoUrl(''); setFormSeason('1');
    setFormEpisode(''); setFormGenres([]); setThumbnailFile(null); setBannerFile(null); setVideoFile(null);
    setThumbnailMode('file'); setBannerMode('file'); setThumbnailPreview(null); setBannerPreview(null);
    setEditingItem(null); setUploadProgress('');
    setUploadMode('new'); setSelectedExistingSeries(null);
  };

  const uploadFileToStorage = async (file: File, bucket: string, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'bin';
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${folder}/${safeName}`;

    // Determine content type
    let contentType = file.type;
    if (!contentType || contentType === 'application/octet-stream') {
      const extMap: Record<string, string> = {
        mp4: 'video/mp4', mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo',
        mov: 'video/quicktime', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif'
      };
      contentType = extMap[ext.toLowerCase()] || 'application/octet-stream';
    }

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) { toast.error('Title is required'); return; }
    if (!user) { toast.error('You must be logged in'); return; }
    setUploading(true);
    setUploadProgress('Preparing...');
    try {
      let finalThumbnail = formThumbnailUrl;
      let finalBanner = formBannerUrl;
      let finalVideo = formVideoUrl;

      if (thumbnailFile) {
        setUploadProgress('Uploading thumbnail...');
        finalThumbnail = await uploadFileToStorage(thumbnailFile, 'anime-thumbnails', 'shadowflix');
      }
      if (bannerFile) {
        setUploadProgress('Uploading banner...');
        finalBanner = await uploadFileToStorage(bannerFile, 'anime-thumbnails', 'shadowflix-banners');
      }
      if (videoFile) {
        setUploadProgress(`Uploading video (${(videoFile.size / (1024 * 1024)).toFixed(1)} MB)...`);
        finalVideo = await uploadFileToStorage(videoFile, 'anime-videos', 'shadowflix');
      }

      setUploadProgress('Saving to database...');
      const payload: any = {
        title: formTitle,
        thumbnail_url: finalThumbnail || null,
        banner_url: finalBanner || null,
        video_url: finalVideo || null,
        season_number: formSeason ? parseInt(formSeason) : 1,
        episode_number: formEpisode ? parseInt(formEpisode) : null,
        genre: formGenres[0] || null,
        genres: formGenres.length ? formGenres : null,
        description: formDescription || null,
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
    } finally { setUploading(false); setUploadProgress(''); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    const { error } = await supabase.from('shadow_flix_content').delete().eq('id', id);
    if (error) toast.error('Delete failed');
    else { toast.success('Deleted'); fetchItems(); }
  };

  const openEdit = (item: ShadowFlixItem) => {
    setEditingItem(item); setFormTitle(item.title); setFormDescription((item as any).description || '');
    setFormThumbnailUrl(item.thumbnail_url || '');
    setFormBannerUrl((item as any).banner_url || '');
    setFormVideoUrl(item.video_url || ''); setFormSeason(String(item.season_number || 1));
    setFormEpisode(item.episode_number ? String(item.episode_number) : '');
    const existingGenres = (item.genres && item.genres.length) ? item.genres : (item.genre ? [item.genre] : []);
    setFormGenres(existingGenres);
    setThumbnailMode('url'); setBannerMode('url'); setUploadMode('new'); setShowUpload(true);
  };

  const startNewEpisodeForExisting = (seriesTitle: string) => {
    const group = seriesGroups.find(g => g.title.toLowerCase() === seriesTitle.toLowerCase());
    if (!group) return;
    const lastEp = group.items[group.items.length - 1];
    setEditingItem(null);
    setFormTitle(group.title);
    setFormDescription(group.description || '');
    setFormThumbnailUrl(group.thumbnail || '');
    setFormBannerUrl(group.banner || '');
    setFormGenres(group.genres);
    setFormSeason(String(lastEp?.season_number || 1));
    setFormEpisode(String((lastEp?.episode_number || 0) + 1));
    setFormVideoUrl('');
    setThumbnailFile(null); setBannerFile(null); setVideoFile(null);
    setThumbnailMode('url'); setBannerMode('url');
    setSelectedExistingSeries(seriesTitle);
    toast.success(`Adding new episode to "${group.title}"`);
  };

  const handlePlayWithEpisodes = (item: ShadowFlixItem, eps: ShadowFlixItem[]) => {
    const group = seriesGroups.find(g => g.title.toLowerCase() === item.title.trim().toLowerCase());
    setPlayingItem(item);
    setPlayingEpisodes(eps);
    setPlayingSeriesGroup(group || null);
  };

  const seriesGroups = useMemo<SeriesGroup[]>(() => {
    const map = new Map<string, ShadowFlixItem[]>();
    items.forEach(item => {
      const key = item.title.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).map(([, groupItems]) => {
      const allGenres = new Set<string>();
      groupItems.forEach(i => {
        if (i.genres && i.genres.length) i.genres.forEach(g => allGenres.add(g));
        else if (i.genre) allGenres.add(i.genre);
      });
      const bannerItem = groupItems.find(i => i.banner_url);
      return {
        title: groupItems[0].title,
        items: groupItems.sort((a, b) => {
          const sa = a.season_number || 1, sb = b.season_number || 1;
          if (sa !== sb) return sa - sb;
          return (a.episode_number || 0) - (b.episode_number || 0);
        }),
        thumbnail: groupItems[0].thumbnail_url,
        banner: bannerItem?.banner_url || null,
        genre: groupItems[0].genre,
        genres: Array.from(allGenres),
        totalViews: groupItems.reduce((sum, i) => sum + getWatchCount(i.id), 0),
        description: groupItems.find(i => (i as any).description)?.description || null,
      };
    });
  }, [items]);

  const filteredGroups = seriesGroups.filter(g => {
    const matchesSearch = !searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || g.genres.includes(selectedGenre) || g.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const mostPopular = useMemo(() =>
    [...seriesGroups].sort((a, b) => b.totalViews - a.totalViews).slice(0, 5).filter(g => g.totalViews > 0),
  [seriesGroups]);

  const recentlyAdded = useMemo(() =>
    seriesGroups.slice(0, 3),
  [seriesGroups]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.genres && i.genres.length) i.genres.forEach(g => set.add(g));
      else if (i.genre) set.add(i.genre);
    });
    return Array.from(set);
  }, [items]);

  const userOwnSeries = useMemo(() =>
    seriesGroups.filter(g => g.items.some(i => i.uploaded_by === user?.id)),
  [seriesGroups, user]);

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

  if (playingItem) {
    return (
      <ShadowFlixPlayer
        item={playingItem}
        onClose={() => { setPlayingItem(null); setPlayingEpisodes([]); setPlayingSeriesGroup(null); }}
        allEpisodes={playingEpisodes}
        onChangeEpisode={ep => setPlayingItem(ep)}
        seriesGroup={playingSeriesGroup}
      />
    );
  }

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
        {activeSeriesGroup ? (
          <AnimeDetailView
            group={activeSeriesGroup}
            userId={user?.id}
            onPlay={handlePlayWithEpisodes}
            onEdit={openEdit}
            onDelete={handleDelete}
            onBack={() => setSelectedSeries(null)}
            playerTheme={playerTheme}
          />
        ) : (
          <>
            {/* Recently Added Banner */}
            {recentlyAdded.length > 0 && !searchQuery && selectedGenre === 'all' && (
              <div>
                <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-500" /> Recently Added
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recentlyAdded.map(g => (
                    <div key={g.title} className="relative rounded-xl overflow-hidden cursor-pointer group"
                      style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                      onClick={() => setSelectedSeries(g.title)}>
                      <div className="aspect-video relative">
                        {g.thumbnail ? (
                          <img src={g.thumbnail} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center"><Film className="w-10 h-10 text-white/20" /></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h3 className="text-white font-bold text-sm truncate">{g.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {g.genre && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600/80 text-white">{g.genre}</span>}
                            <span className="text-white/40 text-[10px]">{g.items.length} ep{g.items.length > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Most Popular */}
            {mostPopular.length > 0 && !searchQuery && selectedGenre === 'all' && (
              <div>
                <h2 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-500" /> Most Popular
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {mostPopular.map((g, i) => (
                    <div key={g.title} className="shrink-0 w-32 sm:w-40 cursor-pointer group"
                      onClick={() => setSelectedSeries(g.title)}>
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

            {/* Content Grid */}
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
                  {filteredGroups.map(g => (
                    <div key={g.title}
                      className="group relative rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.03]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      onClick={() => setSelectedSeries(g.title)}>
                      <div className="aspect-[2/3] relative">
                        {g.thumbnail ? <img src={g.thumbnail} alt={g.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-white/5"><Film className="w-8 h-8 text-white/20" /></div>}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          </div>
                        </div>
                        {g.items.length > 1 && (
                          <div className="absolute top-1.5 right-1.5 bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{g.items.length} EP</div>
                        )}
                        {g.genre && (
                          <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white/70 text-[9px] px-1.5 py-0.5 rounded">{g.genre}</div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-white text-xs font-medium truncate">{g.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-white/30 text-[10px]">{g.items.length} ep{g.items.length > 1 ? 's' : ''}</span>
                          {g.totalViews > 0 && (
                            <span className="text-white/20 text-[10px] flex items-center gap-0.5"><Eye className="w-3 h-3" /> {g.totalViews}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload/Edit Dialog */}
      <Dialog open={showUpload} onOpenChange={o => { if (!o) { setShowUpload(false); resetForm(); } }}>
        <DialogContent className="bg-[#141414] border-red-500/20 text-white sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-red-500 text-lg">{editingItem ? 'Edit Content' : 'Upload to Shadow Flix'}</DialogTitle>
          </DialogHeader>

          {/* Upload mode tabs - hide when editing */}
          {!editingItem && (
            <div className="flex gap-2 border-b border-white/5 pb-3 -mt-2">
              <button onClick={() => { setUploadMode('new'); setSelectedExistingSeries(null); }}
                className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${uploadMode === 'new' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                <Plus className="w-3.5 h-3.5 inline mr-1.5" /> New Series
              </button>
              <button onClick={() => setUploadMode('existing')}
                className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${uploadMode === 'existing' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                <Film className="w-3.5 h-3.5 inline mr-1.5" /> Existing Upload
              </button>
            </div>
          )}

          {/* Existing series picker — show series, click to start adding episode */}
          {!editingItem && uploadMode === 'existing' && !selectedExistingSeries && (
            <div className="space-y-3">
              <p className="text-xs text-white/50">Select an existing series to add a new episode:</p>
              {userOwnSeries.length === 0 ? (
                <div className="text-center py-10 text-white/30 border border-dashed border-white/10 rounded-xl">
                  <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">You haven't uploaded any series yet.</p>
                  <p className="text-[10px] mt-1">Switch to "New Series" tab to start.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                  {userOwnSeries.map(g => (
                    <button key={g.title} onClick={() => startNewEpisodeForExisting(g.title)}
                      className="group text-left rounded-lg overflow-hidden bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                      <div className="aspect-[2/3] relative">
                        {g.thumbnail ? <img src={g.thumbnail} alt={g.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Film className="w-6 h-6 text-white/20" /></div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs font-bold truncate">{g.title}</p>
                          <p className="text-white/50 text-[10px]">{g.items.length} ep{g.items.length > 1 ? 's' : ''}</p>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <div className="px-3 py-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add Episode
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Show form: when in 'new' mode OR editing OR selected an existing series */}
          {(editingItem || uploadMode === 'new' || (uploadMode === 'existing' && selectedExistingSeries)) && (
          <>
          {selectedExistingSeries && (
            <div className="flex items-center justify-between p-2 bg-red-600/10 rounded-lg border border-red-600/20 -mb-2">
              <span className="text-xs text-white/70">Adding episode to: <span className="font-bold text-red-400">{selectedExistingSeries}</span></span>
              <button onClick={() => { setSelectedExistingSeries(null); resetForm(); setUploadMode('existing'); }}
                className="text-[10px] text-white/40 hover:text-white">Change</button>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Title *</label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Enter anime title"
                  className="bg-white/5 border-white/10 text-white text-base h-11" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Description / Synopsis</label>
                <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Write a brief synopsis of the anime..."
                  className="bg-white/5 border-white/10 text-white min-h-[80px] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Season</label>
                  <Input type="number" min="1" value={formSeason} onChange={e => setFormSeason(e.target.value)} placeholder="1"
                    className="bg-white/5 border-white/10 text-white h-11" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Episode</label>
                  <Input type="number" min="1" value={formEpisode} onChange={e => setFormEpisode(e.target.value)} placeholder="e.g. 1"
                    className="bg-white/5 border-white/10 text-white h-11" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Genres (select multiple)</label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map(g => {
                    const active = formGenres.includes(g);
                    return (
                      <button key={g} type="button" onClick={() => toggleGenre(g)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-colors ${active ? 'bg-red-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                        {g}
                      </button>
                    );
                  })}
                </div>
                {formGenres.length > 0 && (
                  <p className="text-[10px] text-white/30 mt-1.5">{formGenres.length} selected</p>
                )}
              </div>
              {/* Video */}
              <div>
                <label className="text-xs text-white/50 mb-1 block">Video</label>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) { setVideoFile(e.target.files[0]); setFormVideoUrl(''); } }} />
                <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()}
                  className="border-white/10 text-white/70 gap-2 w-full h-11">
                  <Upload className="w-4 h-4" /> {videoFile ? videoFile.name : 'Choose video file'}
                </Button>
                {videoFile && (
                  <p className="text-[10px] text-white/40 mt-1">📦 {(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                )}
                <p className="text-[10px] text-white/30 mt-1">Or paste a video/embed URL below:</p>
                <Input value={formVideoUrl} onChange={e => { setFormVideoUrl(e.target.value); if (e.target.value) setVideoFile(null); }}
                  placeholder="https://example.com/video.mp4 or embed URL" className="bg-white/5 border-white/10 text-white mt-1 h-11" />
              </div>
            </div>

            {/* Right Column - Banner + Thumbnail */}
            <div className="space-y-4">
              {/* Banner */}
              <div>
                <label className="text-xs text-white/50 mb-1 block flex items-center gap-1.5">
                  <Monitor className="w-3 h-3" /> Banner / Hero (cinematic, optional)
                </label>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setBannerMode('file')}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${bannerMode === 'file' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/50'}`}>
                    <Image className="w-3 h-3 inline mr-1" /> File
                  </button>
                  <button onClick={() => setBannerMode('url')}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${bannerMode === 'url' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/50'}`}>
                    <Link className="w-3 h-3 inline mr-1" /> URL
                  </button>
                </div>
                {bannerMode === 'file' ? (
                  <>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && setBannerFile(e.target.files[0])} />
                    <Button variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()}
                      className="border-white/10 text-white/70 gap-2 w-full h-11">
                      <Upload className="w-4 h-4" /> {bannerFile ? bannerFile.name : 'Choose banner image (16:9)'}
                    </Button>
                  </>
                ) : (
                  <Input value={formBannerUrl} onChange={e => setFormBannerUrl(e.target.value)}
                    placeholder="https://example.com/banner.jpg" className="bg-white/5 border-white/10 text-white h-11" />
                )}
                {/* Banner Preview */}
                <div className="rounded-xl overflow-hidden border border-white/10 aspect-video bg-white/5 flex items-center justify-center mt-2">
                  {(bannerPreview || (bannerMode === 'url' && formBannerUrl)) ? (
                    <img src={bannerPreview || formBannerUrl} alt="Banner Preview"
                      className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <div className="text-center text-white/20">
                      <Monitor className="w-8 h-8 mx-auto mb-1" />
                      <p className="text-[10px]">Banner preview (16:9)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Thumbnail */}
              <div>
                <label className="text-xs text-white/50 mb-1 block">Thumbnail (poster)</label>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setThumbnailMode('file')}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${thumbnailMode === 'file' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/50'}`}>
                    <Image className="w-3 h-3 inline mr-1" /> File
                  </button>
                  <button onClick={() => setThumbnailMode('url')}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${thumbnailMode === 'url' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/50'}`}>
                    <Link className="w-3 h-3 inline mr-1" /> URL
                  </button>
                </div>
                {thumbnailMode === 'file' ? (
                  <div>
                    <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && setThumbnailFile(e.target.files[0])} />
                    <Button variant="outline" size="sm" onClick={() => thumbnailInputRef.current?.click()}
                      className="border-white/10 text-white/70 gap-2 w-full h-11">
                      <Upload className="w-4 h-4" /> {thumbnailFile ? thumbnailFile.name : 'Choose thumbnail image'}
                    </Button>
                  </div>
                ) : (
                  <Input value={formThumbnailUrl} onChange={e => setFormThumbnailUrl(e.target.value)}
                    placeholder="https://example.com/thumbnail.jpg" className="bg-white/5 border-white/10 text-white h-11" />
                )}
              </div>
              {/* Thumbnail Preview */}
              <div className="rounded-xl overflow-hidden border border-white/10 aspect-video bg-white/5 flex items-center justify-center">
                {(thumbnailPreview || (thumbnailMode === 'url' && formThumbnailUrl)) ? (
                  <img src={thumbnailPreview || formThumbnailUrl} alt="Preview"
                    className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div className="text-center text-white/20">
                    <Image className="w-8 h-8 mx-auto mb-1" />
                    <p className="text-xs">Thumbnail preview</p>
                  </div>
                )}
              </div>
              {/* Generated filename preview */}
              {formTitle && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-white/30 mb-1">Generated share filename:</p>
                  <p className="text-[11px] text-white/60 font-mono break-all">
                    {generateShareFilename(formTitle, formSeason ? parseInt(formSeason) : null, formEpisode ? parseInt(formEpisode) : null)}
                  </p>
                </div>
              )}
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={uploading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 text-base mt-2">
            {uploading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uploadProgress || 'Uploading...'}
              </span>
            ) : editingItem ? 'Save Changes' : 'Upload'}
          </Button>
          </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
