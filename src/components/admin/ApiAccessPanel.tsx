import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, KeyRound, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { API_VERSION, DOCS_URL, INTEGRATION_PROMPT, PUBLIC_BASE_URL } from '../../../supabase/functions/api-hub/contract.ts';

/** Everything another website needs to start reading the public catalogue. */
export const API_CONNECTION_DETAILS = `AnimeSavi+ API Hub (v${API_VERSION})
API address: ${PUBLIC_BASE_URL}
API key: not required — catalogue reads are public
Docs: ${DOCS_URL}
OpenAPI schema: ${PUBLIC_BASE_URL}/v1/openapi.json
Integration prompt: ${PUBLIC_BASE_URL}/v1/integration-prompt`;

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast.success(`${label} copied`);
      setTimeout(() => setDone(false), 1800);
    } catch {
      toast.error('Could not copy — select the text and copy it manually');
    }
  };
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <code className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs break-all whitespace-pre-wrap select-all">{value}</code>
        <Button variant="glass" size="sm" onClick={copy} aria-label={`Copy ${label}`} className="shrink-0">
          {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{done ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ApiAccessPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />API Access</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Copy these details into another website so it can show the AnimeSavi+ catalogue. No secret key is needed — the API address is all other sites require.
        </p>
      </div>

      <CopyRow label="API address" value={PUBLIC_BASE_URL} hint="Paste this wherever the other site asks for an API URL or key." />
      <CopyRow label="All connection details" value={API_CONNECTION_DETAILS} hint="Address, docs and schema in one block." />

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Setup prompt for AI site builders</p>
        <p className="text-[11px] text-muted-foreground">Paste into Lovable, Bolt, Replit or Cursor on the other website to connect it automatically.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={async () => {
            try { await navigator.clipboard.writeText(INTEGRATION_PROMPT); toast.success('Setup prompt copied'); }
            catch { toast.error('Could not copy the prompt'); }
          }}><Sparkles className="h-3.5 w-3.5" />Copy setup prompt</Button>
          <Button variant="glass" size="sm" asChild><Link to="/developers"><ExternalLink className="h-3.5 w-3.5" />Developer docs</Link></Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
        Shared: all published anime except MuseIN. Video links in the API are public, so anyone with the address can read them.
      </p>
    </div>
  );
}
