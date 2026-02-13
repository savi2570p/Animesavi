import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Pause, Volume2, VolumeX, ChevronUp, ChevronDown, Eye, Heart, Share2, ArrowLeft, Scissors, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ShortItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  duration: number;
  start_time: number;
  end_time: number;
  video_url: string;
  thumbnail: string | null;
  view_count: number;
  created_at: string;
}

export default function ShortsPage() {
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [likedShorts, setLikedShorts] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const touchStartY = useRef(0);
  const isTransitioning = useRef(false);

  useEffect(() => {
    const fetchShorts = async () => {
      const { data } = await supabase
        .from('shorts')
        .select('id, title, description, tags, duration, start_time, end_time, video_url, thumbnail, view_count, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setShorts(data as ShortItem[]);
      setLoading(false);
    };
    fetchShorts();
  }, []);

  useEffect(() => {
    if (videoRef.current && shorts[activeIndex]) {
      videoRef.current.currentTime = shorts[activeIndex].start_time;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [activeIndex, shorts]);

  const handleTimeUpdate = () => {
    if (videoRef.current && shorts[activeIndex]) {
      if (videoRef.current.currentTime >= shorts[activeIndex].end_time) {
        videoRef.current.currentTime = shorts[activeIndex].start_time;
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const goNext = useCallback(() => {
    if (isTransitioning.current) return;
    if (activeIndex < shorts.length - 1) {
      isTransitioning.current = true;
      setActiveIndex(prev => prev + 1);
      setTimeout(() => { isTransitioning.current = false; }, 300);
    }
  }, [activeIndex, shorts.length]);

  const goPrev = useCallback(() => {
    if (isTransitioning.current) return;
    if (activeIndex > 0) {
      isTransitioning.current = true;
      setActiveIndex(prev => prev - 1);
      setTimeout(() => { isTransitioning.current = false; }, 300);
    }
  }, [activeIndex]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) > 60) {
      if (deltaY > 0) goNext();
      else goPrev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') goNext();
      else if (e.key === 'ArrowUp' || e.key === 'k') goPrev();
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'm') setIsMuted(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  const handleShare = async (short: ShortItem) => {
    const url = `${window.location.origin}/shorts`;
    if (navigator.share) {
      try {
        await navigator.share({ title: short.title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  const toggleLike = (shortId: string) => {
    setLikedShorts(prev => {
      const next = new Set(prev);
      if (next.has(shortId)) {
        next.delete(shortId);
      } else {
        next.add(shortId);
        toast.success('Liked!');
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <Skeleton className="w-full h-full max-w-[420px] bg-muted/20" />
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 text-white">
        <Scissors className="h-16 w-16 mb-4 text-primary" />
        <h2 className="text-xl font-bold mb-2">No Shorts Yet</h2>
        <p className="text-white/60 mb-6">Check back later for new shorts!</p>
        <Button asChild variant="outline" className="border-white/20 text-white">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Home</Link>
        </Button>
      </div>
    );
  }

  const activeShort = shorts[activeIndex];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Back button */}
      <div className="absolute top-4 left-4 z-30">
        <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/10 h-10 w-10">
          <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
      </div>

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <h1 className="text-white font-bold text-lg flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          Shorts
        </h1>
      </div>

      {/* Counter */}
      <div className="absolute top-4 right-4 z-30">
        <Badge variant="secondary" className="bg-white/10 text-white border-0">
          {activeIndex + 1} / {shorts.length}
        </Badge>
      </div>

      {/* Video Container */}
      <div className="relative w-full h-full max-w-[420px] flex items-center justify-center">
        <div
          className="relative w-full h-full cursor-pointer"
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={activeShort.video_url}
            className="w-full h-full object-contain"
            muted={isMuted}
            playsInline
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Play/Pause indicator */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
              <div className="bg-black/50 rounded-full p-4">
                <Play className="h-12 w-12 text-white fill-white" />
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-20">
            <div className="flex gap-0.5 h-full px-1">
              {shorts.slice(0, Math.min(shorts.length, 20)).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors duration-200 ${
                    i === activeIndex ? 'bg-primary' : i < activeIndex ? 'bg-white/70' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
            <h3 className="text-white font-bold text-base mb-1 line-clamp-2">{activeShort.title}</h3>
            {activeShort.description && (
              <p className="text-white/70 text-sm line-clamp-2 mb-2">{activeShort.description}</p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-white/15 text-white border-0">
                {activeShort.duration}s
              </Badge>
              <span className="text-white/50 text-xs flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {activeShort.view_count}
              </span>
            </div>
            {activeShort.tags && activeShort.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activeShort.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="text-primary/80 text-xs">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20">
            <button
              className="flex flex-col items-center gap-1"
              onClick={(e) => { e.stopPropagation(); toggleLike(activeShort.id); }}
            >
              <div className={`backdrop-blur-sm rounded-full p-3 transition-colors ${likedShorts.has(activeShort.id) ? 'bg-red-500/30' : 'bg-white/10'}`}>
                <Heart className={`h-6 w-6 ${likedShorts.has(activeShort.id) ? 'text-red-500 fill-red-500' : 'text-white'}`} />
              </div>
              <span className="text-white/60 text-[10px]">Like</span>
            </button>

            <button
              className="flex flex-col items-center gap-1"
              onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
            >
              <div className={`backdrop-blur-sm rounded-full p-3 ${showComments ? 'bg-primary/30' : 'bg-white/10'}`}>
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <span className="text-white/60 text-[10px]">Comment</span>
            </button>

            <button
              className="flex flex-col items-center gap-1"
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
                {isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
              </div>
            </button>

            <button
              className="flex flex-col items-center gap-1"
              onClick={(e) => { e.stopPropagation(); handleShare(activeShort); }}
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
                <Share2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-white/60 text-[10px]">Share</span>
            </button>

            <button
              className="flex flex-col items-center gap-1"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              disabled={activeIndex === 0}
            >
              <div className={`bg-white/10 backdrop-blur-sm rounded-full p-3 ${activeIndex === 0 ? 'opacity-30' : ''}`}>
                <ChevronUp className="h-6 w-6 text-white" />
              </div>
            </button>

            <button
              className="flex flex-col items-center gap-1"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              disabled={activeIndex === shorts.length - 1}
            >
              <div className={`bg-white/10 backdrop-blur-sm rounded-full p-3 ${activeIndex === shorts.length - 1 ? 'opacity-30' : ''}`}>
                <ChevronDown className="h-6 w-6 text-white" />
              </div>
            </button>
          </div>
        </div>

        {/* Comment overlay */}
        {showComments && (
          <div 
            className="absolute bottom-0 left-0 right-0 max-h-[50%] bg-black/90 backdrop-blur-md rounded-t-2xl z-30 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-white/60 hover:text-white text-sm">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-white/40 text-sm text-center py-8">Comments coming soon!</p>
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                type="text"
                placeholder={user ? "Add a comment..." : "Login to comment"}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={!user}
                className="flex-1 bg-white/10 text-white text-sm rounded-full px-4 py-2 placeholder:text-white/30 outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <button
                disabled={!user || !commentText.trim()}
                className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
                onClick={() => { toast.info('Comments feature coming soon!'); setCommentText(''); }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
