import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Power, RefreshCw, ShieldCheck, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  buildLocalEmbedUrl,
  buildPublicEmbedUrl,
  manageEmbed,
  type EmbedStatus,
} from '@/lib/embedTokens';

interface Props { episodeId: string }

interface HealthCheck { step: string; ok: boolean; detail?: string }

const STATUS_STYLES: Record<string, string> = {
  READY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PROCESSING: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  FAILED: 'bg-red-500/15 text-red-400 border-red-500/30',
  DISABLED: 'bg-muted/40 text-muted-foreground border-border/50',
};

/**
 * Admin/uploader control surface for the custom embed system:
 * generate → verify → copy → open → regenerate → disable → health check.
 */
export function EmbedManagerPanel({ episodeId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<EmbedStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);

  const refresh = useCallback(async () => {
    const res = await manageEmbed('status', episodeId);
    if (res.exists && res.token) {
      setToken(res.token);
      setStatus((res.status as EmbedStatus) ?? 'READY');
      setError(res.error ?? null);
    } else {
      setToken(null);
      setStatus(null);
    }
  }, [episodeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (action: 'generate' | 'regenerate' | 'disable', label: string) => {
    setBusy(action);
    setChecks(null);
    const res = await manageEmbed(action, episodeId);
    setBusy(null);

    if (res.error) {
      setError(res.error);
      toast.error(res.error);
      if (res.token) { setToken(res.token); setStatus('FAILED'); }
      return;
    }
    if (action === 'disable') {
      setToken(null); setStatus(null);
      toast.success('Embed link disabled.');
      return;
    }
    if (res.verified === false) {
      setToken(res.token ?? null);
      setStatus('FAILED');
      setError(res.error ?? 'Embed verification failed.');
      toast.error('Embed created but verification failed.');
      return;
    }
    setToken(res.token ?? null);
    setStatus((res.status as EmbedStatus) ?? 'READY');
    setError(null);
    toast.success(`${label} — verified and ready.`);
  };

  const runTest = async () => {
    setBusy('test');
    const res = await manageEmbed('test', episodeId);
    setBusy(null);
    setChecks(res.checks ?? null);
    if (res.error) toast.error(res.error);
    else if (res.ok) toast.success('Embed health check passed.');
    else toast.error('Embed health check found a problem.');
  };

  const publicUrl = token ? buildPublicEmbedUrl(token) : '';

  const copy = async () => {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); } catch { /* ignore */ }
    setCopied(true);
    toast.success('Embed link copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Custom Embed Link</p>
          <p className="text-xs text-muted-foreground">
            Unique token that resolves to this exact episode.
          </p>
        </div>
        {status && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] ?? STATUS_STYLES.DISABLED}`}>
            {status}
          </span>
        )}
      </div>

      {token ? (
        <div className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 font-mono text-xs break-all">
          {publicUrl}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No embed generated yet. Generate one once the video has a valid playback source.
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!token && (
          <Button size="sm" onClick={() => run('generate', 'Embed generated')} disabled={busy !== null}>
            {busy === 'generate' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
            Generate
          </Button>
        )}
        {token && (
          <>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              Copy Embed Link
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(buildLocalEmbedUrl(token), '_blank')}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Embed
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('regenerate', 'New token generated')} disabled={busy !== null}>
              {busy === 'regenerate' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Regenerate
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('disable', 'Embed disabled')} disabled={busy !== null}>
              <Power className="h-3.5 w-3.5 mr-1.5" /> Disable
            </Button>
            <Button size="sm" variant="secondary" onClick={runTest} disabled={busy !== null}>
              {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
              Test Embed
            </Button>
          </>
        )}
      </div>

      {checks && (
        <ul className="space-y-1 rounded-lg border border-border/50 bg-background/50 p-3">
          {checks.map((c) => (
            <li key={c.step} className="flex items-start gap-2 text-xs">
              {c.ok
                ? <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                : <X className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />}
              <span className={c.ok ? 'text-foreground' : 'text-red-400'}>
                {c.step}
                {c.detail && <span className="text-muted-foreground"> — {c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
