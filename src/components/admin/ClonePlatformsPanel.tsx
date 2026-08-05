import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Lock,
  ImagePlus,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface ClonePlatform {
  id: string;
  name: string;
  slug: string;
  target_url: string;
  logo_url: string | null;
  category: string;
  sandbox_enabled: boolean;
  is_active: boolean;
  sort_order: number;
}

const CATEGORIES = ['anime', 'movies', 'manga', 'sports', 'live tv', 'other'];

const slugify = (v: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function ClonePlatformsPanel() {
  const [rows, setRows] = useState<ClonePlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalLock, setGlobalLock] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // add form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('anime');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [{ data, error }, { data: setting }] = await Promise.all([
      supabase.from('clone_platforms').select('*').order('sort_order', { ascending: true }),
      supabase.from('site_settings').select('value').eq('key', 'clone_platforms_locked').maybeSingle(),
    ]);
    if (error) toast.error('Failed to load clone platforms');
    setRows((data as ClonePlatform[]) ?? []);
    setGlobalLock(setting?.value === true);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleGlobalLock = async (checked: boolean) => {
    setGlobalLock(checked);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'clone_platforms_locked', value: checked }, { onConflict: 'key' });
    if (error) {
      setGlobalLock(!checked);
      toast.error('Could not update the lock setting');
      return;
    }
    toast.success(checked ? 'All clone pages locked' : 'All clone pages unlocked');
  };

  const createCard = async () => {
    const name = newName.trim();
    const slug = slugify(slugTouched ? newSlug : newName);
    if (!name || !slug) {
      toast.error('Name and slug are required');
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('clone_platforms').insert({
      name,
      slug,
      target_url: newUrl.trim(),
      category: newCategory,
      sort_order: rows.length,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'That slug already exists' : 'Failed to add card');
      return;
    }
    toast.success('Card added');
    setNewName('');
    setNewSlug('');
    setSlugTouched(false);
    setNewUrl('');
    load();
  };

  const patchLocal = (id: string, patch: Partial<ClonePlatform>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const saveRow = async (row: ClonePlatform) => {
    setSavingId(row.id);
    const { error } = await supabase
      .from('clone_platforms')
      .update({
        name: row.name,
        slug: slugify(row.slug),
        target_url: row.target_url,
        logo_url: row.logo_url,
        category: row.category,
        sandbox_enabled: row.sandbox_enabled,
        is_active: row.is_active,
        sort_order: row.sort_order,
      })
      .eq('id', row.id);
    setSavingId(null);
    if (error) {
      toast.error('Failed to save card');
      return;
    }
    toast.success(`${row.name} saved`);
    load();
  };

  const deleteRow = async (row: ClonePlatform) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('clone_platforms').delete().eq('id', row.id);
    if (error) {
      toast.error('Failed to delete card');
      return;
    }
    toast.success('Card deleted');
    load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((r, i) => ({ ...r, sort_order: i }));
    setRows(reordered);

    const results = await Promise.all(
      reordered.map((r) =>
        supabase.from('clone_platforms').update({ sort_order: r.sort_order }).eq('id', r.id)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error('Failed to reorder');
      load();
      return;
    }
    toast.success('Order updated');
  };

  const uploadLogo = async (row: ClonePlatform, file: File) => {
    setUploadingId(row.id);
    const ext = file.name.split('.').pop() || 'png';
    const path = `clone-logos/${row.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('anime-media')
      .upload(path, file, { contentType: file.type || 'image/png', upsert: true });
    if (error) {
      setUploadingId(null);
      toast.error('Logo upload failed');
      return;
    }
    const { data } = supabase.storage.from('anime-media').getPublicUrl(path);
    patchLocal(row.id, { logo_url: data.publicUrl });
    await supabase.from('clone_platforms').update({ logo_url: data.publicUrl }).eq('id', row.id);
    setUploadingId(null);
    toast.success('Logo updated');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(275_90%_72%)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Global lock */}
      <div className="clone-glass flex items-center justify-between gap-4 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5 backdrop-blur-xl">
            <Lock className="h-4 w-4 text-[hsl(275_90%_78%)]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Lock all clone pages</p>
            <p className="text-xs text-muted-foreground">
              Visitors must watch an ad before they can interact with any clone page.
            </p>
          </div>
        </div>
        <Switch checked={globalLock} onCheckedChange={toggleGlobalLock} />
      </div>

      {/* Add card */}
      <div className="clone-glass rounded-2xl p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-[hsl(275_90%_78%)]" />
          <p className="text-sm font-semibold">Add card</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Name</Label>
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (!slugTouched) setNewSlug(slugify(e.target.value));
              }}
              placeholder="HiAnime"
              className="clone-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Slug</Label>
            <Input
              value={newSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setNewSlug(e.target.value);
              }}
              placeholder="hianime"
              className="clone-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Target URL</Label>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com"
              className="clone-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Category</Label>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="clone-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={createCard} disabled={creating} className="clone-cta mt-4 rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Add card
        </Button>
      </div>

      {/* Rows */}
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={row.id} className="clone-glass rounded-2xl p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {row.logo_url ? (
                  <img
                    src={row.logo_url}
                    alt={`${row.name} logo`}
                    className="h-9 w-9 rounded-xl border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{row.name}</p>
                  <a
                    href={`/${row.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[hsl(275_90%_78%)] hover:underline"
                  >
                    /{row.slug}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => deleteRow(row)}
                  aria-label="Delete card"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Name</Label>
                <Input
                  value={row.name}
                  onChange={(e) => patchLocal(row.id, { name: e.target.value })}
                  className="clone-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Slug</Label>
                <Input
                  value={row.slug}
                  onChange={(e) => patchLocal(row.id, { slug: e.target.value })}
                  className="clone-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Category</Label>
                <Select value={row.category} onValueChange={(v) => patchLocal(row.id, { category: v })}>
                  <SelectTrigger className="clone-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Target URL</Label>
                <Input
                  value={row.target_url}
                  onChange={(e) => patchLocal(row.id, { target_url: e.target.value })}
                  placeholder="https://example.com"
                  className="clone-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Sort order</Label>
                <Input
                  type="number"
                  value={row.sort_order}
                  onChange={(e) => patchLocal(row.id, { sort_order: Number(e.target.value) })}
                  className="clone-input"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Logo</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={row.logo_url ?? ''}
                    onChange={(e) => patchLocal(row.id, { logo_url: e.target.value })}
                    placeholder="https://… or upload from gallery"
                    className="clone-input flex-1 min-w-[200px]"
                  />
                  <label className="clone-cta inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold">
                    {uploadingId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLogo(row, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-end gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.sandbox_enabled}
                    onCheckedChange={(v) => patchLocal(row.id, { sandbox_enabled: v })}
                  />
                  <span className="text-xs text-muted-foreground">Sandbox</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(v) => patchLocal(row.id, { is_active: v })}
                  />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => saveRow(row)}
              disabled={savingId === row.id}
              className="clone-cta mt-4 rounded-xl"
            >
              {savingId === row.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="clone-glass flex flex-col items-center justify-center rounded-2xl py-14 text-center">
            <p className="text-sm font-semibold">No clone platforms yet</p>
            <p className="text-xs text-muted-foreground">Add your first card above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClonePlatformsPanel;
