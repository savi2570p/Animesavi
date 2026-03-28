import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import museinLogo from '@/assets/musein-logo.jpg';
import { Sparkles, Clock, Film, Globe } from 'lucide-react';

export default function MuseINPage() {
  return (
    <div className="min-h-screen">
      <ContentNavTabs />

      <div className="container py-16 md:py-24 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-150" />
          <img
            src={museinLogo}
            alt="MuseIN"
            className="relative h-24 w-24 md:h-32 md:w-32 rounded-full object-cover border-4 border-primary/30 shadow-xl"
          />
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-heading font-bold mb-3">
          Muse<span className="anime-gradient-text">IN</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-2">Hindi Dubbed Anime by Muse India</p>

        {/* Coming Soon Badge */}
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 mb-8">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-semibold text-primary">Coming Soon</span>
        </div>

        {/* Description */}
        <p className="max-w-lg text-muted-foreground mb-10">
          We're building a dedicated space for all <span className="font-semibold text-foreground">Muse India</span> Hindi dubbed anime.
          Stay tuned — your favorite shows will be available here very soon!
        </p>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl w-full mb-12">
          {[
            { icon: Film, title: 'Official Hindi Dub', desc: 'Licensed content from Muse India' },
            { icon: Globe, title: 'HD & 4K Quality', desc: 'Crystal clear streaming experience' },
            { icon: Clock, title: 'Regular Updates', desc: 'New episodes added frequently' },
            { icon: Sparkles, title: 'Exclusive Collection', desc: 'Curated anime library' },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/40 border border-border/50">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="text-[11px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground">
          Anime marked with <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded">H-DUB</span> will appear here automatically.
        </p>
      </div>
    </div>
  );
}
