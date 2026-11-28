import { useState } from 'react';
import { Megaphone, ShieldCheck, CalendarDays, ChevronDown } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { SITE_NOTICES, sortNotices } from '@/data/notices';

export default function Notices() {
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const notices = sortNotices(SITE_NOTICES, order);

  return (
    <div className="container max-w-4xl py-6 md:py-10">
      <SEO title="Notices | AnimeSavi+" description="Security updates, service notices and the AnimeSavi+ release archive." path="/notices" />
      <header className="border-b border-border pb-6">
        <p className="text-xs text-primary font-semibold mb-2">AnimeSavi+</p>
        <h1 className="font-heading text-3xl font-bold flex items-center gap-3"><Megaphone className="h-7 w-7 text-primary shrink-0" />Notices</h1>
        <p className="mt-2 text-sm text-muted-foreground">Security updates, service changes and past releases.</p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <p className="text-sm text-muted-foreground">{notices.length} notices</p>
        <div className="flex items-center gap-1" role="group" aria-label="Notice order">
          <Button size="sm" variant={order === 'newest' ? 'default' : 'ghost'} aria-pressed={order === 'newest'} onClick={() => setOrder('newest')}>Newest</Button>
          <Button size="sm" variant={order === 'oldest' ? 'default' : 'ghost'} aria-pressed={order === 'oldest'} onClick={() => setOrder('oldest')}>Oldest</Button>
        </div>
      </div>
      <div className="divide-y divide-border" aria-label="Notice archive">
        {notices.map((notice) => (
          <article key={notice.id} id={notice.id} className="py-6 first:pt-0 scroll-mt-24">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs mb-3">
              <span className="text-primary font-semibold flex items-center gap-1.5">{notice.category === 'Security' ? <ShieldCheck className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}{notice.category}</span>
              <time dateTime={notice.date} className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{new Date(`${notice.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time>
            </div>
            <h2 className="font-heading text-xl font-semibold break-words">{notice.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">{notice.summary}</p>
            {notice.category === 'Release' ? (
              <details className="mt-4 group">
                <summary className="text-sm text-primary cursor-pointer list-none flex items-center gap-2 w-fit">Release details<ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" /></summary>
                <NoticeDetails items={notice.details} />
              </details>
            ) : <NoticeDetails items={notice.details} />}
          </article>
        ))}
      </div>
    </div>
  );
}

function NoticeDetails({ items }: { items: string[] }) {
  return <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc pl-5 marker:text-primary">{items.map((item) => <li key={item} className="pl-1 leading-relaxed">{item}</li>)}</ul>;
}