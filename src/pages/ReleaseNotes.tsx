import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Wrench, FlaskConical, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_VERSION, RELEASE_DATE, DOWNLOAD_SIZE_MB, BETA_NOTE, VERSION_GROUPS, BADGE_LABELS, type ChangelogItem } from '@/data/releaseNotes';

function ReleaseSection({ title, items, fix = false }: {title: string; items: ChangelogItem[]; fix?: boolean}) {
  if (!items.length) return null;
  return <section className="py-7 border-b border-border"><h2 className="text-lg font-semibold flex items-center gap-2">{fix ? <Wrench className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}{title}<span className="text-xs text-muted-foreground ml-auto">{items.length}</span></h2>
    <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">{items.map(item => <li key={item.title} className="flex items-start gap-3 py-4"><span className={`release-icon-v6 release-${item.badge.toLowerCase()} shrink-0 h-9 w-9 rounded-lg grid place-items-center`}>{item.icon}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{item.title}</h3><span className={`release-label-v6 release-${item.badge.toLowerCase()}`}>{BADGE_LABELS[item.badge]}</span></div><p className="text-xs text-muted-foreground leading-relaxed mt-1.5">{item.desc}</p></div></li>)}</ul>
  </section>;
}
export default function ReleaseNotes() {
  const navigate = useNavigate(); const group = VERSION_GROUPS[0];
  return <main className="release-page-v6 min-h-screen"><div className="container max-w-4xl py-6 sm:py-10">
    <Button variant="glass" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
    <header className="release-header-v6 py-8 sm:py-10 mt-5 border-y border-border"><div className="flex items-center justify-between flex-wrap gap-3"><span className="text-xs font-semibold text-primary">{APP_VERSION}</span><span className="text-xs text-muted-foreground">{RELEASE_DATE}</span></div><h1 className="text-3xl sm:text-4xl font-bold mt-4">Release Notes</h1><p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-xl">{group.highlight}</p><span className="flex items-center gap-2 text-xs text-muted-foreground mt-5"><Download className="h-3.5 w-3.5" />Update size · {DOWNLOAD_SIZE_MB}MB</span></header>
    <ReleaseSection title="Improvements" items={group.items.filter(i => i.badge !== 'FIX')} />
    <ReleaseSection title="Fixes" fix items={group.items.filter(i => i.badge === 'FIX')} />
    <section className="py-7"><h2 className="text-sm font-semibold flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" />Embed Player · BETA 2.1</h2><p className="text-xs text-muted-foreground leading-relaxed mt-3">{BETA_NOTE}</p></section>
  </div></main>;
}
