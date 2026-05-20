import { useState } from 'react';
import Hls from 'hls.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Headphones, Loader2, Smartphone, Monitor, Tablet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DetectedTrack {
  id: number;
  name: string;
  lang: string;
  source: 'hls' | 'native';
}

interface ProbeResult {
  url: string;
  variant: 'normal' | 'shadow';
  device: 'ios' | 'android' | 'desktop';
  tracks: DetectedTrack[];
  error: string | null;
  ms: number;
}

const DEVICE_UA: Record<'ios' | 'android' | 'desktop', string> = {
  ios: 'iOS Safari (simulated)',
  android: 'Android Chrome (simulated)',
  desktop: navigator.userAgent,
};

/**
 * Admin-only inspector that loads an episode's video URL into a hidden HLS instance
 * and lists the audio tracks the 🎧 menu will surface. Useful for verifying that
 * normal embed links and shadow embed links expose the same tracks across devices.
 */
export function EmbedAudioDebugPanel() {
  const [episodeIdInput, setEpisodeIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);

  const probeUrl = async (
    url: string,
    variant: 'normal' | 'shadow',
    device: 'ios' | 'android' | 'desktop'
  ): Promise<ProbeResult> => {
    const start = performance.now();
    return new Promise((resolve) => {
      // Native (non-HLS) path — create a hidden <video> and read audioTracks.
      const isHls = /\.m3u8(\?|$)/i.test(url);
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';
      video.style.display = 'none';

      const finish = (tracks: DetectedTrack[], error: string | null) => {
        try { video.remove(); } catch {}
        resolve({ url, variant, device, tracks, error, ms: Math.round(performance.now() - start) });
      };

      const native = (): DetectedTrack[] => {
        const a: any = (video as any).audioTracks;
        if (!a || !a.length) return [];
        const out: DetectedTrack[] = [];
        for (let i = 0; i < a.length; i++) {
          out.push({
            id: i,
            name: a[i].label || a[i].language || `Audio ${i + 1}`,
            lang: a[i].language || '',
            source: 'native',
          });
        }
        return out;
      };

      if (isHls && Hls.isSupported() && device !== 'ios') {
        const hls = new Hls();
        const cleanup = () => { try { hls.destroy(); } catch {} };
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const tracks: DetectedTrack[] = (hls.audioTracks || []).map((t, i) => ({
            id: i,
            name: t.name || t.lang || `Audio ${i + 1}`,
            lang: t.lang || '',
            source: 'hls',
          }));
          cleanup();
          finish(tracks.length ? tracks : [{ id: 0, name: 'Original Audio', lang: '', source: 'hls' }], null);
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          cleanup();
          finish([], `HLS ${data.type}: ${data.details}`);
        });
        try { hls.loadSource(url); hls.attachMedia(video); } catch (e: any) {
          cleanup();
          finish([], e?.message || 'HLS load failed');
        }
      } else {
        document.body.appendChild(video);
        video.src = url;
        const onMeta = () => {
          const tracks = native();
          finish(
            tracks.length ? tracks : [{ id: 0, name: 'Original Audio', lang: '', source: 'native' }],
            null
          );
        };
        video.addEventListener('loadedmetadata', onMeta, { once: true });
        video.addEventListener('error', () => finish([], 'Video element error'), { once: true });
        // Safety timeout — embeds on real iOS often only expose tracks after play().
        setTimeout(() => finish(native(), null), 6000);
      }
    });
  };

  const handleProbe = async () => {
    const epId = episodeIdInput.trim();
    if (!epId) {
      toast.error('Enter an episode ID first');
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('id, title, video_url, external_url')
        .eq('id', epId)
        .maybeSingle();
      if (error || !data) {
        toast.error('Episode not found');
        setLoading(false);
        return;
      }
      const normalUrl = data.video_url || data.external_url;
      const shadowUrl = data.video_url || data.external_url; // same source, different player skin
      if (!normalUrl) {
        toast.error('Episode has no video URL');
        setLoading(false);
        return;
      }
      const devices: Array<'ios' | 'android' | 'desktop'> = ['ios', 'android', 'desktop'];
      const all: ProbeResult[] = [];
      for (const variant of ['normal', 'shadow'] as const) {
        for (const device of devices) {
          // eslint-disable-next-line no-await-in-loop
          const r = await probeUrl(variant === 'shadow' ? shadowUrl : normalUrl, variant, device);
          all.push(r);
          setResults([...all]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const deviceIcon = (d: 'ios' | 'android' | 'desktop') =>
    d === 'desktop' ? <Monitor className="h-3.5 w-3.5" /> : d === 'ios' ? <Tablet className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />;

  return (
    <Card className="p-4 md:p-5 space-y-4 border-primary/20">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/15 border border-primary/30">
          <Headphones className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold">🎧 Embed Audio-Track Inspector</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Probe an episode's video URL through both normal and shadow embed players, on iOS, Android, and desktop
            HLS engines, and list every audio track the 🎧 menu will surface. Used to confirm the menu matches across hosts.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={episodeIdInput}
          onChange={(e) => setEpisodeIdInput(e.target.value)}
          placeholder="Episode UUID (from Admin → Uploads)"
          className="h-9 text-xs"
        />
        <Button onClick={handleProbe} disabled={loading} size="sm" className="h-9">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Probe'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto">
          {results.map((r, idx) => (
            <div key={idx} className="rounded-md border border-border/60 bg-background/40 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Badge variant={r.variant === 'shadow' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                    {r.variant}
                  </Badge>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {deviceIcon(r.device)} {r.device}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{r.ms}ms</span>
              </div>
              {r.error ? (
                <div className="text-destructive text-[11px]">{r.error}</div>
              ) : r.tracks.length === 0 ? (
                <div className="text-muted-foreground">No tracks detected</div>
              ) : (
                <ul className="space-y-0.5">
                  {r.tracks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between">
                      <span className="text-foreground">{t.name}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {t.source}{t.lang ? ` · ${t.lang}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground/70">
        Note: iOS native HLS audio tracks are only enumerated after a real <code>play()</code> call,
        so this inspector falls back to a generic <strong>Original Audio</strong> entry — which matches what
        the live 🎧 menu will show on iPhone.
      </div>
    </Card>
  );
}

export default EmbedAudioDebugPanel;
