import { useCallback, useEffect, useState } from 'react';
import { Captions, CheckCircle2, ChevronDown, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { FileUploadInput } from '@/components/upload/FileUploadInput';

interface SeasonOption { id: string; season_number: number; title?: string | null }
interface SubEpisode { id: string; episode_number: number; title: string; thumbnail: string | null; sub_video_url: string | null }

/**
 * Lists the uploaded episodes of a series so a SUB (Japanese audio) video can be
 * attached to each one. The 4K+ server plays that file; episodes without one keep
 * playing their main file.
 */
export function SubEpisodesManager({ animeId, seasons, open, onOpenChange }: {
  animeId: string;
  seasons: SeasonOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [seasonId, setSeasonId] = useState<string | null>(seasons[0]?.id ?? null);
  const [episodes, setEpisodes] = useState<SubEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId || !seasons.some(s => s.id === seasonId)) setSeasonId(seasons[0]?.id ?? null);
  }, [seasons, seasonId]);

  const load = useCallback(async () => {
    if (!seasonId) { setEpisodes([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('episodes')
      .select('id, episode_number, title, thumbnail, sub_video_url')
      .eq('season_id', seasonId)
      .order('episode_number', { ascending: true });
    if (error) toast.error('Could not load episodes');
    setEpisodes((data as SubEpisode[]) || []);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const startEdit = (ep: SubEpisode) => { setEditingId(ep.id); setDraftUrl(ep.sub_video_url || ''); };

  const save = async (ep: SubEpisode, url: string | null) => {
    setSavingId(ep.id);
    const { error } = await supabase.from('episodes').update({ sub_video_url: url }).eq('id', ep.id);
    setSavingId(null);
    if (error) { toast.error('Failed to save the SUB video'); return; }
    setEpisodes(list => list.map(e => (e.id === ep.id ? { ...e, sub_video_url: url } : e)));
    setEditingId(null);
    setDraftUrl('');
    toast.success(url ? `SUB added to Episode ${ep.episode_number}` : `SUB removed from Episode ${ep.episode_number}`);
  };

  const added = episodes.filter(e => e.sub_video_url).length;

  return (
    <div className="sub-eps">
      <button type="button" className="sub-eps-head" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <span className="sub-eps-icon"><Captions className="h-4 w-4" /></span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-bold">SUB episodes · 4K+ server</span>
          <span className="block text-[11px] text-muted-foreground">
            Pick an uploaded episode and add its SUB (Japanese audio) video
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="sub-eps-body">
          {seasons.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No seasons yet. Add a season and episodes first.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {seasons.length > 1 && (
                  <select
                    aria-label="Season"
                    value={seasonId ?? ''}
                    onChange={e => { setSeasonId(e.target.value); setEditingId(null); }}
                    className="sub-eps-select"
                  >
                    {seasons.map(s => <option key={s.id} value={s.id}>Season {s.season_number}</option>)}
                  </select>
                )}
                {!loading && episodes.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">{added} of {episodes.length} episodes have SUB</span>
                )}
              </div>

              {loading ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground py-3"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading episodes…</p>
              ) : episodes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">No uploaded episodes in this season yet.</p>
              ) : (
                <ul className="sub-eps-list">
                  {episodes.map(ep => {
                    const editing = editingId === ep.id;
                    const busy = savingId === ep.id;
                    return (
                      <li key={ep.id} className="sub-eps-row">
                        <div className="flex items-center gap-3 min-w-0">
                          {ep.thumbnail
                            ? <img src={ep.thumbnail} alt="" className="w-16 aspect-video object-cover rounded shrink-0" loading="lazy" />
                            : <span className="w-16 aspect-video rounded bg-muted shrink-0" aria-hidden />}
                          <div className="min-w-0 flex-1">
                            <span className="block text-[11px] text-muted-foreground">EP {ep.episode_number}</span>
                            <span className="block text-sm font-medium truncate">{ep.title}</span>
                          </div>
                          {ep.sub_video_url
                            ? <span className="sub-eps-pill is-on"><CheckCircle2 className="h-3 w-3" /> SUB</span>
                            : <span className="sub-eps-pill">No SUB</span>}
                          {!editing && (
                            <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => startEdit(ep)}>
                              <Plus className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">{ep.sub_video_url ? 'Replace' : 'Add SUB'}</span>
                            </Button>
                          )}
                        </div>

                        {editing && (
                          <div className="sub-eps-editor">
                            <FileUploadInput
                              label={`SUB video for Episode ${ep.episode_number}`}
                              accept="video"
                              contentType="episode"
                              value={draftUrl}
                              onChange={setDraftUrl}
                              folder={`anime/${animeId}/sub-episodes`}
                              placeholder="Upload a file or paste the SUB video link"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" className="studio-v12-primary" disabled={!draftUrl.trim() || busy} onClick={() => save(ep, draftUrl.trim())}>
                                {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save SUB
                              </Button>
                              {ep.sub_video_url && (
                                <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => save(ep, null)}>
                                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove SUB
                                </Button>
                              )}
                              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setEditingId(null); setDraftUrl(''); }}>
                                <X className="h-3.5 w-3.5 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
