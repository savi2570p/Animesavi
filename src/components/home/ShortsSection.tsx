import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Pause, Volume2, VolumeX, ChevronUp, ChevronDown, Eye, Scissors, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export function ShortsSection() {
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchShorts = async () => {
      const { data } = await supabase
        .from('shorts')
        .select('id, title, description, tags, duration, start_time, end_time, video_url, thumbnail, view_count, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setShorts(data as ShortItem[]);
      setLoading(false);
    };
    fetchShorts();
  }, []);

  useEffect(() => {
    if (videoRef.current && shorts[activeIndex]) {
      videoRef.current.currentTime = shorts[activeIndex].start_time;
      if (isPlaying) videoRef.current.play();
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

  const goNext = () => {
    if (activeIndex < shorts.length - 1) {
      setActiveIndex(prev => prev + 1);
      setIsPlaying(true);
    }
  };

  const goPrev = () => {
    if (activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
      setIsPlaying(true);
    }
  };

  if (loading) {
    return (
      <section className="py-8">
        <div className="container">
          <div className="flex items-center gap-2 mb-6">
            <Scissors className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Shorts</h2>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="w-[200px] h-[356px] rounded-xl shrink-0" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (shorts.length === 0) return null;

  const activeShort = shorts[activeIndex];

  return (
    <section className="py-8">
      <div className="container">
        <div className="flex items-center gap-2 mb-6">
          <Scissors className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Shorts</h2>
          <Badge variant="secondary" className="text-xs">{shorts.length}</Badge>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link to="/shorts" className="flex items-center gap-1">
              <Maximize2 className="h-4 w-4" />
              Full Screen
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Main Player */}
          <div className="relative w-full md:w-[280px] shrink-0">
            <div
              className="relative aspect-[9/16] bg-black rounded-2xl overflow-hidden cursor-pointer group"
              onClick={togglePlay}
            >
              <video
                ref={videoRef}
                src={activeShort.video_url}
                className="w-full h-full object-cover"
                muted={isMuted}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* Play/Pause overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-12 w-12 text-white fill-white" />
                </div>
              )}

              {/* Controls overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <h3 className="text-white font-semibold text-sm line-clamp-2">{activeShort.title}</h3>
                {activeShort.description && (
                  <p className="text-white/70 text-xs mt-1 line-clamp-1">{activeShort.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
                    {activeShort.duration}s
                  </Badge>
                  <span className="text-white/60 text-xs flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {activeShort.view_count}
                  </span>
                </div>
              </div>

              {/* Side controls */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  disabled={activeIndex === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  disabled={activeIndex === shorts.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress indicator */}
              <div className="absolute top-2 left-2 right-2">
                <div className="flex gap-1">
                  {shorts.slice(0, Math.min(shorts.length, 10)).map((_, i) => (
                    <div
                      key={i}
                      className={`h-0.5 flex-1 rounded-full transition-colors ${
                        i === activeIndex ? 'bg-primary' : i < activeIndex ? 'bg-white/60' : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Shorts Grid */}
          <div className="flex-1 min-w-0" ref={containerRef}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {shorts.map((short, index) => (
                <Card
                  key={short.id}
                  className={`cursor-pointer overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-primary/50 ${
                    index === activeIndex ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => { setActiveIndex(index); setIsPlaying(true); }}
                >
                  <div className="aspect-[9/16] bg-muted relative">
                    {short.thumbnail ? (
                      <img src={short.thumbnail} alt={short.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-primary/20 to-primary/5">
                        <Play className="h-8 w-8 text-primary/50" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-xs font-medium line-clamp-2">{short.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-[10px] h-4 bg-white/20 text-white border-0">
                          {short.duration}s
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Tags */}
        {activeShort.tags && activeShort.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {activeShort.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
