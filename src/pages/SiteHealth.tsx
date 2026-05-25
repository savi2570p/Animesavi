import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Gauge, ShieldCheck, ShieldAlert, RefreshCw, Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SITE_URL = 'https://animesavi.com/';
const ADMIN_EMAIL = 'savi2570p@gmail.com';
const LCP_STORAGE_KEY = 'siteHealth.lcpHistory.v1';
const LCP_REGRESSION_THRESHOLD_MS = 300;
const LAST_BUILD_KEY = 'siteHealth.lastBuildSig.v1';
const LAST_REGRESSION_KEY = 'siteHealth.lastRegression.v1';

interface LCPRun {
  ts: number;
  lcpMs: number | null;
  performanceScore: number | null;
  fcpMs: number | null;
  clsScore: number | null;
  ttiMs: number | null;
}

interface GSCStatus {
  verified: boolean;
  inSearchConsole: boolean;
  permissionLevel: string | null;
  verificationMethod: string | null;
  owners: string[];
  rawSiteStatus: number;
  rawVerifyStatus: number;
}

export default function SiteHealth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Lighthouse / LCP
  const [history, setHistory] = useState<LCPRun[]>([]);
  const [lcpLoading, setLcpLoading] = useState(false);
  const [lcpError, setLcpError] = useState<string | null>(null);

  // GSC
  const [gscStatus, setGscStatus] = useState<GSCStatus | null>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [liveMetaContent, setLiveMetaContent] = useState<string | null>(null);
  const [liveMetaError, setLiveMetaError] = useState<string | null>(null);
  const [liveMetaLoading, setLiveMetaLoading] = useState(false);
  const [lastRegression, setLastRegression] = useState<{ ts: number; deltaMs: number } | null>(null);

  // Gate: only admins (or the explicit recovery account)
  useEffect(() => {
    (async () => {
      if (!user) { setAuthChecked(true); return; }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const roles = (data || []).map(r => r.role);
      const allowed = roles.includes('admin') || user.email === ADMIN_EMAIL;
      setIsAdmin(allowed);
      setAuthChecked(true);
    })();
  }, [user]);

  // Load history + last regression from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LCP_STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
      const reg = localStorage.getItem(LAST_REGRESSION_KEY);
      if (reg) setLastRegression(JSON.parse(reg));
    } catch {}
  }, []);

  // Auto-load live meta on mount for admins
  useEffect(() => { if (isAdmin) fetchLiveMeta(); }, [isAdmin]);

  const persistHistory = (next: LCPRun[]) => {
    setHistory(next);
    try { localStorage.setItem(LCP_STORAGE_KEY, JSON.stringify(next.slice(0, 20))); } catch {}
  };

  const runLighthouse = useCallback(async (opts?: { silent?: boolean }) => {
    setLcpLoading(true);
    setLcpError(null);
    try {
      const res = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(SITE_URL)}&category=performance&strategy=mobile`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'PageSpeed Insights request failed');
      const audits = json?.lighthouseResult?.audits || {};
      const cat = json?.lighthouseResult?.categories?.performance;
      const run: LCPRun = {
        ts: Date.now(),
        lcpMs: audits['largest-contentful-paint']?.numericValue ?? null,
        performanceScore: typeof cat?.score === 'number' ? Math.round(cat.score * 100) : null,
        fcpMs: audits['first-contentful-paint']?.numericValue ?? null,
        clsScore: audits['cumulative-layout-shift']?.numericValue ?? null,
        ttiMs: audits['interactive']?.numericValue ?? null,
      };

      // Regression alert + admin notification — fires if LCP increased meaningfully
      const prev = history[0];
      if (prev?.lcpMs && run.lcpMs && run.lcpMs - prev.lcpMs > LCP_REGRESSION_THRESHOLD_MS) {
        const deltaMs = run.lcpMs - prev.lcpMs;
        const record = { ts: run.ts, deltaMs };
        setLastRegression(record);
        try { localStorage.setItem(LAST_REGRESSION_KEY, JSON.stringify(record)); } catch {}
        toast.warning(`LCP regressed by ${(deltaMs / 1000).toFixed(2)}s vs the previous scan`, {
          description: `Latest ${fmtMs(run.lcpMs)} · previous ${fmtMs(prev.lcpMs)}`,
          duration: 8000,
        });
      }

      persistHistory([run, ...history]);
      if (!opts?.silent) toast.success('Lighthouse scan complete');
    } catch (e) {
      setLcpError(e instanceof Error ? e.message : String(e));
      if (!opts?.silent) toast.error('Lighthouse scan failed');
    } finally {
      setLcpLoading(false);
    }
  }, [history]);

  // Live verification-meta-tag fetch — confirms the production HTML actually
  // serves the google-site-verification tag (proves the latest build is live).
  const fetchLiveMeta = useCallback(async () => {
    setLiveMetaLoading(true);
    setLiveMetaError(null);
    try {
      const res = await fetch(`${SITE_URL}?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const match = html.match(/<meta\s+name=["']google-site-verification["']\s+content=["']([^"']+)["']/i);
      setLiveMetaContent(match ? match[1] : null);
      if (!match) setLiveMetaError('Meta tag not found in production HTML — republish required');
    } catch (e) {
      setLiveMetaError(e instanceof Error ? e.message : 'Failed to fetch production HTML');
    } finally {
      setLiveMetaLoading(false);
    }
  }, []);

  // Auto Lighthouse scan after every publish — detected via change in the
  // production HTML signature (etag/last-modified or HTML hash fallback).
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SITE_URL}?_=${Date.now()}`, { cache: 'no-store' });
        const sig = res.headers.get('etag') || res.headers.get('last-modified') || String((await res.text()).length);
        const prev = localStorage.getItem(LAST_BUILD_KEY);
        if (cancelled) return;
        if (prev && prev !== sig) {
          toast.info('New build detected — running Lighthouse scan…');
          await runLighthouse({ silent: true });
        }
        localStorage.setItem(LAST_BUILD_KEY, sig);
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, [isAdmin, runLighthouse]);

  const fetchGSC = async () => {
    setGscLoading(true);
    setGscError(null);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-verification-status', { method: 'GET' });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGscStatus(data as GSCStatus);
    } catch (e) {
      setGscError(e instanceof Error ? e.message : String(e));
    } finally {
      setGscLoading(false);
    }
  };

  const triggerVerify = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-verification-status?action=verify', { method: 'POST' });
      if (error) throw error;
      if ((data as any)?.verified) {
        toast.success('Domain ownership verified — added to Search Console');
        await fetchGSC();
      } else {
        const msg = (data as any)?.error?.error?.message || 'Verification failed — make sure the latest build is published.';
        toast.error(msg);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => { if (isAdmin) fetchGSC(); }, [isAdmin]);

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert className="w-12 h-12 text-amber-400 mb-3" />
        <h1 className="text-xl font-semibold text-foreground mb-1">Admins only</h1>
        <p className="text-sm text-muted-foreground mb-4">This dashboard is restricted to administrators.</p>
        <Button variant="outline" onClick={() => navigate('/')}>Go home</Button>
      </div>
    );
  }

  const latest = history[0];
  const previous = history[1];
  const lcpDelta = latest && previous && latest.lcpMs && previous.lcpMs ? latest.lcpMs - previous.lcpMs : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> Site Health
            </h1>
            <p className="text-sm text-muted-foreground">Lighthouse LCP and Search Console verification for <span className="font-mono">animesavi.com</span></p>
          </div>
        </div>

        {/* Lighthouse */}
        <Card className="p-5 mb-6 border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Lighthouse LCP</h2>
            </div>
            <Button onClick={() => runLighthouse()} disabled={lcpLoading} size="sm">
              {lcpLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
              {lcpLoading ? 'Scanning…' : 'Run scan'}
            </Button>
          </div>

          {lcpError && <div className="text-sm text-destructive mb-3">{lcpError}</div>}

          {lastRegression && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-3 mb-3 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">LCP regression detected</div>
                <div className="opacity-80">Last scan was {(lastRegression.deltaMs / 1000).toFixed(2)}s slower than the previous one ({new Date(lastRegression.ts).toLocaleString()}).</div>
              </div>
            </div>
          )}

          {latest ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Metric label="LCP" value={fmtMs(latest.lcpMs)} delta={lcpDelta != null ? fmtDeltaMs(lcpDelta) : null} good={latest.lcpMs != null && latest.lcpMs < 2500} bad={latest.lcpMs != null && latest.lcpMs > 4000} />
              <Metric label="Performance" value={latest.performanceScore != null ? `${latest.performanceScore}` : '—'} good={(latest.performanceScore ?? 0) >= 90} bad={(latest.performanceScore ?? 100) < 50} />
              <Metric label="FCP" value={fmtMs(latest.fcpMs)} good={latest.fcpMs != null && latest.fcpMs < 1800} bad={latest.fcpMs != null && latest.fcpMs > 3000} />
              <Metric label="CLS" value={latest.clsScore != null ? latest.clsScore.toFixed(3) : '—'} good={latest.clsScore != null && latest.clsScore < 0.1} bad={latest.clsScore != null && latest.clsScore > 0.25} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/60 rounded-lg mb-3">
              No scans yet. Click <strong>Run scan</strong> after each publish to track LCP.
            </div>
          )}

          {history.length > 0 && (
            <div className="border-t border-border/40 pt-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">History (last {history.length})</div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {history.map((r, i) => (
                  <div key={r.ts} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/40">
                    <span className="text-muted-foreground">{new Date(r.ts).toLocaleString()}</span>
                    <div className="flex items-center gap-3">
                      <span>LCP <strong className="text-foreground">{fmtMs(r.lcpMs)}</strong></span>
                      <span>Perf <strong className="text-foreground">{r.performanceScore ?? '—'}</strong></span>
                      {i === 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Latest</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* GSC */}
        <Card className="p-5 border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Search Console Verification</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchGSC} disabled={gscLoading} size="sm" variant="outline">
                {gscLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                Refresh
              </Button>
              <Button onClick={triggerVerify} disabled={verifying} size="sm">
                {verifying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1.5" />}
                Verify now
              </Button>
            </div>
          </div>

          {gscError && <div className="text-sm text-destructive mb-3">{gscError}</div>}

          {gscStatus?.verified && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-semibold text-emerald-400">Verified by Google</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-500/80 font-bold">✓ Done</span>
            </div>
          )}

          {gscStatus ? (
            <div className="space-y-3">
              <Row icon={gscStatus.verified ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-destructive" />}
                label="Ownership verified"
                value={gscStatus.verified ? 'Yes' : 'No'} />
              <Row icon={gscStatus.inSearchConsole ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-amber-400" />}
                label="In Search Console properties"
                value={gscStatus.inSearchConsole ? `Yes (${gscStatus.permissionLevel || 'owner'})` : 'No'} />
              <Row label="Site" value={<span className="font-mono text-xs">{SITE_URL}</span>} />
              <Row label="Method" value={gscStatus.verificationMethod || 'META tag'} />
              {gscStatus.owners?.length > 0 && (
                <Row label="Owners" value={<span className="text-xs">{gscStatus.owners.join(', ')}</span>} />
              )}
              {!gscStatus.verified && (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-3 mt-3">
                  If "Verify now" fails with <code>failedToFindMetaTag</code>, republish the app — the verification meta tag must be live in the production HTML before Google can fetch it.
                </div>
              )}
              <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                Open Google Search Console <ExternalLink className="w-3 h-3" />
              </a>

              {/* Live verification meta tag — proves the tag is actually in production HTML */}
              <div className="mt-4 pt-3 border-t border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live meta tag in production HTML</div>
                  <Button onClick={fetchLiveMeta} disabled={liveMetaLoading} size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    {liveMetaLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Re-fetch
                  </Button>
                </div>
                {liveMetaContent ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-emerald-400 font-semibold mb-1">Tag is live on {SITE_URL}</div>
                      <code className="text-[10px] text-foreground/80 break-all block bg-background/40 rounded px-1.5 py-1">
                        &lt;meta name="google-site-verification" content="{liveMetaContent}" /&gt;
                      </code>
                    </div>
                  </div>
                ) : liveMetaError ? (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-2 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <div className="text-xs text-destructive">{liveMetaError}</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">{liveMetaLoading ? 'Fetching production HTML…' : '—'}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/60 rounded-lg">
              {gscLoading ? 'Checking…' : 'No status yet.'}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, delta, good, bad }: { label: string; value: string; delta?: string | null; good?: boolean; bad?: boolean }) {
  const color = good ? 'text-emerald-500' : bad ? 'text-destructive' : 'text-foreground';
  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      {delta && <div className="text-[10px] text-muted-foreground mt-0.5">{delta}</div>}
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
      <div className="w-5 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function fmtMs(v: number | null) { return v == null ? '—' : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`; }
function fmtDeltaMs(v: number) { const sign = v > 0 ? '+' : ''; return `${sign}${(v / 1000).toFixed(2)}s vs previous`; }
