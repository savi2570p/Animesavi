import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Share2, Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Fav {
  anime_id: string;
  anime: { id: string; title: string; cover_image: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ShareCollectionDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [favs, setFavs] = useState<Fav[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('My Anime Picks');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setShareUrl(null); setCopied(false);
    supabase.from('user_favorites')
      .select('anime_id, anime:anime_id(id,title,cover_image)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const rows = (data || []) as unknown as Fav[];
        setFavs(rows);
        setPicked(new Set(rows.map((r) => r.anime_id)));
      });
  }, [open, user]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  const create = async () => {
    if (!user) return;
    if (picked.size === 0) { toast.error('Pick at least one series'); return; }
    if (!title.trim()) { toast.error('Add a title'); return; }
    setCreating(true);
    const { data, error } = await supabase.from('shared_collections').insert({
      user_id: user.id,
      title: title.trim(),
      description: desc.trim() || null,
      anime_ids: Array.from(picked),
    }).select('share_token').maybeSingle();
    setCreating(false);
    if (error || !data) { toast.error(error?.message || 'Failed to create'); return; }
    const url = `${window.location.origin}/share/${encodeURIComponent(data.share_token)}`;
    setShareUrl(url);
    toast.success('Share link ready');
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 1500);
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title, text: desc, url: shareUrl }); } catch {}
    } else {
      copy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 border-b border-border/40 bg-gradient-to-br from-primary/10 to-transparent">
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Share with Friends</DialogTitle>
          <DialogDescription>Curate a list from your favorites and share a public link.</DialogDescription>
        </DialogHeader>

        {shareUrl ? (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/30">
              <p className="text-xs text-muted-foreground mb-2">Your public link</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copy}>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={nativeShare} className="w-full"><Share2 className="h-4 w-4 mr-2" /> Share</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-3 border-b border-border/40">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Collection title" maxLength={80} />
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="A short description (optional)" maxLength={280} rows={2} />
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Pick from your favorites ({picked.size}/{favs.length})</p>
              {favs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Add anime to your favorites first.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {favs.map((f) => f.anime && (
                    <button key={f.anime_id} onClick={() => toggle(f.anime_id)}
                      className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${picked.has(f.anime_id) ? 'border-primary shadow-lg shadow-primary/30' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                      <img src={f.anime.cover_image || '/placeholder.svg'} alt={f.anime.title} className="w-full h-full object-cover" />
                      {picked.has(f.anime_id) && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary grid place-items-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="p-4 border-t border-border/40">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={create} disabled={creating || picked.size === 0}>
                {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</> : <><Share2 className="h-4 w-4 mr-2" /> Create link</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
