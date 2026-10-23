import { type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CatalogueHeading({ title, eyebrow, icon: Icon, href, rowRef }: {
  title: string; eyebrow: string; icon: LucideIcon; href?: string;
  rowRef: RefObject<HTMLDivElement>;
}) {
  const scroll = (direction: number) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * .8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <div className="flex items-end justify-between gap-3 mb-5">
    <div className="min-w-0">
      <span className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-muted-foreground mb-1"><Icon className="h-3 w-3 text-primary" />{eyebrow}</span>
      <h2 className="font-heading text-xl md:text-3xl font-bold leading-tight">{title}</h2>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="icon" aria-label={`Previous ${title.toLowerCase()}`} onClick={() => scroll(-1)} className="hidden sm:inline-flex h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" aria-label={`Next ${title.toLowerCase()}`} onClick={() => scroll(1)} className="h-8 w-8"><ArrowRight className="h-4 w-4" /></Button>
      {href && <Button asChild variant="ghost" size="sm"><Link to={href}>See all</Link></Button>}
    </div>
  </div>;
}