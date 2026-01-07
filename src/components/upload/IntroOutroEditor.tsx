import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Play, Pause, SkipForward, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';

interface IntroOutroEditorProps {
  videoUrl: string | null;
  introStartTime: number | null;
  introEndTime: number | null;
  outroStartTime: number | null;
  outroEndTime: number | null;
  onSave: (data: {
    introStartTime: number | null;
    introEndTime: number | null;
    outroStartTime: number | null;
    outroEndTime: number | null;
  }) => void;
  isSaving?: boolean;
}

export function IntroOutroEditor({
  videoUrl,
  introStartTime,
  introEndTime,
  outroStartTime,
  outroEndTime,
  onSave,
  isSaving = false,
}: IntroOutroEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [introStart, setIntroStart] = useState<string>(introStartTime?.toString() || '');
  const [introEnd, setIntroEnd] = useState<string>(introEndTime?.toString() || '');
  const [outroStart, setOutroStart] = useState<string>(outroStartTime?.toString() || '');
  const [outroEnd, setOutroEnd] = useState<string>(outroEndTime?.toString() || '');

  useEffect(() => {
    setIntroStart(introStartTime?.toString() || '');
    setIntroEnd(introEndTime?.toString() || '');
    setOutroStart(outroStartTime?.toString() || '');
    setOutroEnd(outroEndTime?.toString() || '');
  }, [introStartTime, introEndTime, outroStartTime, outroEndTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const setCurrentAsTime = (setter: (val: string) => void) => {
    setter(Math.floor(currentTime).toString());
  };

  const seekTo = (time: string) => {
    const seconds = parseInt(time);
    if (!isNaN(seconds) && videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const handleSave = () => {
    onSave({
      introStartTime: introStart ? parseInt(introStart) : null,
      introEndTime: introEnd ? parseInt(introEnd) : null,
      outroStartTime: outroStart ? parseInt(outroStart) : null,
      outroEndTime: outroEnd ? parseInt(outroEnd) : null,
    });
  };

  if (!videoUrl) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No video URL available. Add a video URL first to set intro/outro times.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Intro & Outro Timestamps
        </CardTitle>
        <CardDescription>
          Play the video and click "Set Current" to mark intro/outro times
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Video Player */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full"
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {/* Simple controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={togglePlay} className="text-white hover:bg-white/20">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <span className="text-white text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const time = parseFloat(e.target.value);
                  if (videoRef.current) {
                    videoRef.current.currentTime = time;
                    setCurrentTime(time);
                  }
                }}
                className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Current Time Display */}
        <div className="text-center py-2 bg-muted/50 rounded-lg">
          <span className="text-lg font-mono font-bold text-primary">
            Current Time: {Math.floor(currentTime)} seconds ({formatTime(currentTime)})
          </span>
        </div>

        {/* Intro Settings */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="col-span-2 flex items-center gap-2 mb-2">
            <SkipForward className="h-4 w-4 text-primary" />
            <span className="font-medium">Skip Intro</span>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="introStart">Intro Start (seconds)</Label>
            <div className="flex gap-2">
              <Input
                id="introStart"
                type="number"
                value={introStart}
                onChange={(e) => setIntroStart(e.target.value)}
                placeholder="0"
                className="bg-background"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentAsTime(setIntroStart)}
              >
                Set Current
              </Button>
            </div>
            {introStart && (
              <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => seekTo(introStart)}>
                Go to {formatTime(parseInt(introStart))}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="introEnd">Intro End (seconds)</Label>
            <div className="flex gap-2">
              <Input
                id="introEnd"
                type="number"
                value={introEnd}
                onChange={(e) => setIntroEnd(e.target.value)}
                placeholder="90"
                className="bg-background"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentAsTime(setIntroEnd)}
              >
                Set Current
              </Button>
            </div>
            {introEnd && (
              <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => seekTo(introEnd)}>
                Go to {formatTime(parseInt(introEnd))}
              </Button>
            )}
          </div>
        </div>

        {/* Outro Settings */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="col-span-2 flex items-center gap-2 mb-2">
            <SkipForward className="h-4 w-4 text-accent" />
            <span className="font-medium">Skip Outro</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outroStart">Outro Start (seconds)</Label>
            <div className="flex gap-2">
              <Input
                id="outroStart"
                type="number"
                value={outroStart}
                onChange={(e) => setOutroStart(e.target.value)}
                placeholder="Auto"
                className="bg-background"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentAsTime(setOutroStart)}
              >
                Set Current
              </Button>
            </div>
            {outroStart && (
              <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => seekTo(outroStart)}>
                Go to {formatTime(parseInt(outroStart))}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="outroEnd">Outro End (seconds)</Label>
            <div className="flex gap-2">
              <Input
                id="outroEnd"
                type="number"
                value={outroEnd}
                onChange={(e) => setOutroEnd(e.target.value)}
                placeholder="End of video"
                className="bg-background"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentAsTime(setOutroEnd)}
              >
                Set Current
              </Button>
            </div>
            {outroEnd && (
              <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => seekTo(outroEnd)}>
                Go to {formatTime(parseInt(outroEnd))}
              </Button>
            )}
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full anime-button">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Timestamps'}
        </Button>
      </CardContent>
    </Card>
  );
}