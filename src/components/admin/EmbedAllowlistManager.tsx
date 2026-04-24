import { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  getAllowlist,
  setAllowlist,
  normalizeDomain,
  DEFAULT_SUGGESTED_DOMAINS,
  type AllowlistState,
} from '@/lib/embedAllowlist';

/**
 * Admin / uploader UI for managing the Embed-server domain allowlist.
 * Stored in localStorage (see src/lib/embedAllowlist.ts).
 */
export function EmbedAllowlistManager() {
  const [state, setState] = useState<AllowlistState>(() => getAllowlist());
  const [input, setInput] = useState('');

  useEffect(() => {
    setAllowlist(state);
  }, [state]);

  const addDomain = (raw: string) => {
    const normalized = normalizeDomain(raw);
    if (!normalized) {
      toast.error('Invalid domain');
      return;
    }
    if (state.domains.includes(normalized)) {
      toast.info(`${normalized} is already on the list`);
      return;
    }
    setState((prev) => ({ ...prev, domains: [...prev.domains, normalized] }));
    setInput('');
    toast.success(`Added ${normalized}`);
  };

  const removeDomain = (domain: string) => {
    setState((prev) => ({ ...prev, domains: prev.domains.filter((d) => d !== domain) }));
  };

  const toggleEnforcement = (enforced: boolean) => {
    setState((prev) => ({ ...prev, enforced }));
    toast.success(enforced ? 'Allowlist enforcement enabled' : 'Allowlist enforcement disabled');
  };

  const addSuggested = (d: string) => addDomain(d);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {state.enforced ? (
            <ShieldCheck className="h-5 w-5 text-primary" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          Embed Domain Allowlist
        </CardTitle>
        <CardDescription>
          Restrict the "Embed" server to trusted external hosts. When enforcement is off,
          all embed sources are allowed (default).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="enforce-toggle" className="text-base">
              Enforce allowlist
            </Label>
            <p className="text-sm text-muted-foreground">
              When on, only domains below can be iframed.
            </p>
          </div>
          <Switch
            id="enforce-toggle"
            checked={state.enforced}
            onCheckedChange={toggleEnforcement}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="domain-input">Add domain</Label>
          <div className="flex gap-2">
            <Input
              id="domain-input"
              placeholder="e.g. doodstream.com"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDomain(input);
                }
              }}
            />
            <Button onClick={() => addDomain(input)} disabled={!input.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Subdomains are matched automatically (e.g. <code>play.doodstream.com</code> when
            <code> doodstream.com</code> is added).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Allowed domains ({state.domains.length})</Label>
          {state.domains.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No domains added yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {state.domains.map((d) => (
                <Badge key={d} variant="secondary" className="gap-1.5 pr-1">
                  <span className="font-mono">{d}</span>
                  <button
                    onClick={() => removeDomain(d)}
                    className="hover:bg-destructive/20 rounded p-0.5"
                    aria-label={`Remove ${d}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Suggested hosts</Label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SUGGESTED_DOMAINS.filter((d) => !state.domains.includes(d)).map((d) => (
              <Button
                key={d}
                variant="outline"
                size="sm"
                onClick={() => addSuggested(d)}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                {d}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
