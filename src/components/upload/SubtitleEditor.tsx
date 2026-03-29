import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Subtitles, Download, Upload, Clock, Type } from 'lucide-react';
import { toast } from 'sonner';

interface SubtitleCue {
  id: string;
  startTime: string; // HH:MM:SS.mmm
  endTime: string;
  text: string;
}

interface SubtitleEditorProps {
  initialCues?: SubtitleCue[];
  onSave: (vttContent: string, cues: SubtitleCue[]) => void;
  compact?: boolean;
}

const formatTimeForDisplay = (time: string): string => {
  return time || '00:00:00.000';
};

const timeToSeconds = (time: string): number => {
  const parts = time.split(':');
  if (parts.length !== 3) return 0;
  const [h, m, rest] = parts;
  const [s, ms] = (rest || '0.000').split('.');
  return parseInt(h || '0') * 3600 + parseInt(m || '0') * 60 + parseInt(s || '0') + parseInt(ms || '0') / 1000;
};

const generateVTT = (cues: SubtitleCue[]): string => {
  let vtt = 'WEBVTT\n\n';
  cues.forEach((cue, index) => {
    vtt += `${index + 1}\n`;
    vtt += `${formatTimeForDisplay(cue.startTime)} --> ${formatTimeForDisplay(cue.endTime)}\n`;
    vtt += `${cue.text.trim()}\n\n`;
  });
  return vtt;
};

const parseVTT = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const blocks = content.split(/\n\s*\n/).filter(b => b.trim());
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines[0]?.startsWith('WEBVTT')) continue;
    
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    
    const [start, end] = timeLine.split('-->').map(t => t.trim());
    const textStart = lines.indexOf(timeLine) + 1;
    const text = lines.slice(textStart).join('\n').trim();
    
    if (start && end && text) {
      cues.push({
        id: crypto.randomUUID(),
        startTime: start,
        endTime: end,
        text,
      });
    }
  }
  return cues;
};

const parseSRT = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const blocks = content.split(/\n\s*\n/).filter(b => b.trim());
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    
    const [start, end] = timeLine.split('-->').map(t => t.trim().replace(',', '.'));
    const textStart = lines.indexOf(timeLine) + 1;
    const text = lines.slice(textStart).join('\n').trim();
    
    if (start && end && text) {
      cues.push({
        id: crypto.randomUUID(),
        startTime: start,
        endTime: end,
        text,
      });
    }
  }
  return cues;
};

export function SubtitleEditor({ initialCues, onSave, compact }: SubtitleEditorProps) {
  const [cues, setCues] = useState<SubtitleCue[]>(initialCues || []);
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const addCue = useCallback(() => {
    const lastCue = cues[cues.length - 1];
    const newStart = lastCue ? lastCue.endTime : '00:00:00.000';
    const startSec = timeToSeconds(newStart);
    const endSec = startSec + 3;
    const h = Math.floor(endSec / 3600);
    const m = Math.floor((endSec % 3600) / 60);
    const s = Math.floor(endSec % 60);
    const newEnd = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.000`;

    setCues(prev => [...prev, {
      id: crypto.randomUUID(),
      startTime: newStart,
      endTime: newEnd,
      text: '',
    }]);
  }, [cues]);

  const removeCue = useCallback((id: string) => {
    setCues(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCue = useCallback((id: string, field: keyof SubtitleCue, value: string) => {
    setCues(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }, []);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      let parsed: SubtitleCue[] = [];
      if (file.name.endsWith('.vtt')) {
        parsed = parseVTT(content);
      } else if (file.name.endsWith('.srt')) {
        parsed = parseSRT(content);
      } else {
        toast.error('Unsupported format. Use .vtt or .srt');
        return;
      }
      setCues(parsed);
      toast.success(`Imported ${parsed.length} subtitle cues`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleExportVTT = useCallback(() => {
    const vtt = generateVTT(cues);
    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.vtt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('VTT file downloaded');
  }, [cues]);

  const handleBulkParse = useCallback(() => {
    // Parse bulk text: each line is "HH:MM:SS.mmm --> HH:MM:SS.mmm | text"
    // or simple: "start - end | text"
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const newCues: SubtitleCue[] = [];

    for (const line of lines) {
      const pipeIdx = line.indexOf('|');
      if (pipeIdx === -1) continue;
      const timePart = line.substring(0, pipeIdx).trim();
      const text = line.substring(pipeIdx + 1).trim();
      const [start, end] = timePart.split('-->').map(t => t.trim());
      if (start && end && text) {
        newCues.push({ id: crypto.randomUUID(), startTime: start, endTime: end, text });
      }
    }

    if (newCues.length > 0) {
      setCues(prev => [...prev, ...newCues]);
      setBulkText('');
      setShowBulk(false);
      toast.success(`Added ${newCues.length} cues from bulk text`);
    } else {
      toast.error('Could not parse. Format: HH:MM:SS.000 --> HH:MM:SS.000 | Text');
    }
  }, [bulkText]);

  const handleSave = useCallback(() => {
    const validCues = cues.filter(c => c.text.trim());
    if (validCues.length === 0) {
      toast.error('Add at least one subtitle cue');
      return;
    }
    const vtt = generateVTT(validCues);
    onSave(vtt, validCues);
  }, [cues, onSave]);

  return (
    <Card className={compact ? '' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Subtitles className="h-5 w-5 text-primary" />
          CC — Subtitle Editor
        </CardTitle>
        <CardDescription>
          Add subtitles manually with timing. Import .vtt/.srt or type directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action bar */}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addCue}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Cue
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowBulk(!showBulk)}>
            <Type className="h-3.5 w-3.5 mr-1" /> Bulk Add
          </Button>
          <label className="inline-flex">
            <Button type="button" variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-3.5 w-3.5 mr-1" /> Import .vtt/.srt
              </span>
            </Button>
            <input type="file" accept=".vtt,.srt" className="hidden" onChange={handleImport} />
          </label>
          {cues.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleExportVTT}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export VTT
            </Button>
          )}
        </div>

        {/* Bulk add */}
        {showBulk && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Label className="text-xs">Bulk Add (one per line)</Label>
            <Textarea
              placeholder={`00:00:01.000 --> 00:00:04.000 | Hello, welcome!\n00:00:05.000 --> 00:00:08.000 | This is a subtitle.`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="min-h-[80px] text-xs font-mono bg-background"
            />
            <Button type="button" size="sm" onClick={handleBulkParse}>Parse & Add</Button>
          </div>
        )}

        {/* Cue list */}
        {cues.length > 0 && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {cues.map((cue, index) => (
              <div key={cue.id} className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/30 border border-border/30">
                <span className="text-xs text-muted-foreground font-mono mt-2 min-w-[20px]">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Input
                      value={cue.startTime}
                      onChange={(e) => updateCue(cue.id, 'startTime', e.target.value)}
                      placeholder="00:00:00.000"
                      className="h-7 text-xs font-mono bg-background max-w-[140px]"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      value={cue.endTime}
                      onChange={(e) => updateCue(cue.id, 'endTime', e.target.value)}
                      placeholder="00:00:03.000"
                      className="h-7 text-xs font-mono bg-background max-w-[140px]"
                    />
                  </div>
                  <Input
                    value={cue.text}
                    onChange={(e) => updateCue(cue.id, 'text', e.target.value)}
                    placeholder="Subtitle text..."
                    className="h-7 text-xs bg-background"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive/70 hover:text-destructive"
                  onClick={() => removeCue(cue.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {cues.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No subtitle cues yet. Click "Add Cue" or import a .vtt/.srt file.
          </div>
        )}

        {/* Save */}
        {cues.length > 0 && (
          <Button type="button" onClick={handleSave} className="w-full anime-button">
            <Subtitles className="h-4 w-4 mr-2" />
            Save Subtitles ({cues.filter(c => c.text.trim()).length} cues)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
