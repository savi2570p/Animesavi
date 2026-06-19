import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Eye, CheckCircle2, Users, Clock } from 'lucide-react';

interface Row {
  id: string;
  episode_id: string;
  opened_at: string;
  completed: boolean;
  duration_seconds: number;
  context: string;
  watch_party_id: string | null;
}

interface EpisodeMeta {
  id: string;
  title: string | null;
  episode_number: number | null;
}

export function RecapAnalyticsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, EpisodeMeta>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('recap_analytics')
        .select('id, episode_id, opened_at, completed, duration_seconds, context, watch_party_id')
        .order('opened_at', { ascending: false })
        .limit(500);
      const list = (data ?? []) as Row[];
      setRows(list);

      const ids = Array.from(new Set(list.map((r) => r.episode_id)));
      if (ids.length) {
        const { data: eps } = await supabase
          .from('episodes')
          .select('id, title, episode_number')
          .in('id', ids);
        const map: Record<string, EpisodeMeta> = {};
        (eps ?? []).forEach((e) => { map[e.id] = e as EpisodeMeta; });
        setEpisodes(map);
      }
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.completed).length;
    const inParty = rows.filter((r) => r.context === 'watch_party').length;
    const avgDur = total
      ? Math.round(rows.reduce((s, r) => s + (r.duration_seconds || 0), 0) / total)
      : 0;
    return { total, completed, inParty, avgDur, rate: total ? (completed / total) * 100 : 0 };
  }, [rows]);

  const topEpisodes = useMemo(() => {
    const byEp: Record<string, { opens: number; completed: number }> = {};
    rows.forEach((r) => {
      byEp[r.episode_id] ??= { opens: 0, completed: 0 };
      byEp[r.episode_id].opens += 1;
      if (r.completed) byEp[r.episode_id].completed += 1;
    });
    return Object.entries(byEp)
      .map(([id, v]) => ({ id, ...v, rate: v.opens ? (v.completed / v.opens) * 100 : 0 }))
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 10);
  }, [rows]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">Loading recap analytics…</CardContent>
      </Card>
    );
  }

  const tiles = [
    { icon: Eye, label: 'Total opens', value: stats.total, accent: 'text-sky-400', bg: 'from-sky-500/15 to-sky-500/5' },
    { icon: CheckCircle2, label: 'Completion rate', value: `${stats.rate.toFixed(0)}%`, accent: 'text-emerald-400', bg: 'from-emerald-500/15 to-emerald-500/5' },
    { icon: Users, label: 'Inside watch parties', value: stats.inParty, accent: 'text-fuchsia-400', bg: 'from-fuchsia-500/15 to-fuchsia-500/5' },
    { icon: Clock, label: 'Avg watched', value: `${stats.avgDur}s`, accent: 'text-amber-400', bg: 'from-amber-500/15 to-amber-500/5' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" /> AI Recap Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className={`rounded-xl border border-border/40 p-4 bg-gradient-to-br ${t.bg}`}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <t.icon className={`h-3.5 w-3.5 ${t.accent}`} /> {t.label}
              </div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{t.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top recapped episodes</CardTitle>
        </CardHeader>
        <CardContent>
          {topEpisodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recap opens yet.</p>
          ) : (
            <div className="space-y-2">
              {topEpisodes.map((e) => {
                const meta = episodes[e.id];
                const label = meta ? `Ep ${meta.episode_number ?? '?'} · ${meta.title ?? 'Untitled'}` : e.id.slice(0, 8);
                return (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border/30">
                    <span className="text-sm truncate">{label}</span>
                    <div className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="text-muted-foreground">{e.opens} opens</span>
                      <span className="text-emerald-400">{e.rate.toFixed(0)}% finished</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
