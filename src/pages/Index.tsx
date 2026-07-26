import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Flame, Sparkles, Tv, Film, Languages, CalendarClock, Compass } from "lucide-react";
import crunchyrollLogo from "@/assets/crunchyroll-logo.png";
import museinLogo from "@/assets/musein-logo.jpg";
import floxLogo from "@/assets/flox-anime-india-logo.jpg";
import { FeaturedSlider } from "@/components/home/FeaturedSlider";
import { ContinueWatching } from "@/components/home/ContinueWatching";
import { RecommendedAnime } from "@/components/home/RecommendedAnime";
import { LatestEpisodes } from "@/components/home/LatestEpisodes";
import { LatestMovies } from "@/components/home/LatestMovies";
import { LatestEngDub } from "@/components/home/LatestEngDub";
import { LatestSeries } from "@/components/home/LatestSeries";
import { RecentlyCompleted } from "@/components/home/RecentlyCompleted";
import { EpisodeProgress } from "@/components/home/EpisodeProgress";
import { ComingSoon } from "@/components/home/ComingSoon";
import { SocialShare } from "@/components/home/SocialShare";
import { MostPopular } from "@/components/home/MostPopular";
import { AnimeCalendar } from "@/components/AnimeCalendar";
import { TrendingBanner } from "@/components/home/TrendingBanner";
import { SEO } from "@/components/SEO";


export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Redirect first-time visitors to /welcome
  useEffect(() => {
    const hasVisited = localStorage.getItem("has_visited_home");
    if (!hasVisited) {
      localStorage.setItem("has_visited_home", "true");
      navigate("/welcome", { replace: true });
    }
  }, [navigate]);

  // Cursor-following aurora — rAF + 60ms time throttle. Enabled on touch too
  // (attached to pointermove which fires on tap/scroll drag) with low update rate.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = 0;
    const MIN_MS = 60; // ~16 FPS cap for the background paint — plenty for a glow

    const apply = (x: number, y: number) => {
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    };

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (raf || now - last < MIN_MS) return;
      last = now;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply((e.clientX / window.innerWidth) * 100, (e.clientY / window.innerHeight) * 100);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const collections = [
    { to: "/browse?sort=trending", label: "Trending", icon: Flame, tint: "from-fuchsia-500/30 to-purple-600/20" },
    { to: "/latest-series", label: "New Series", icon: Tv, tint: "from-purple-500/30 to-indigo-600/20" },
    { to: "/latest-movies", label: "Movies", icon: Film, tint: "from-violet-500/30 to-purple-600/20" },
    { to: "/eng-dub", label: "ENG DUB", icon: Languages, tint: "from-pink-500/25 to-fuchsia-600/20" },
    { to: "/schedule", label: "Schedule", icon: CalendarClock, tint: "from-indigo-500/25 to-purple-600/20" },
    { to: "/browse", label: "Explore", icon: Compass, tint: "from-purple-500/25 to-blue-600/20" },
  ];

  return (
    <div
      ref={rootRef}
      className="home-smooth home-aurora min-h-screen [&_section]:py-2 [&_section]:md:py-4 [&_.container]:px-3 [&_.container]:md:px-4"
    >
      <SEO
        title="AnimeSavi - Watch Anime in Hindi DUB"
        description="Watch your favorite anime in official Hindi DUB. Stream the best anime series and movies for free. Episode update same day as release calendar."
        path="/"
      />
      {/* Hero Banner */}
      <FeaturedSlider />

      {/* Trending Now */}
      <TrendingBanner />

      {/* Continue Watching */}
      <ContinueWatching showOnHomeOnly={true} />

      {/* Featured — Platform Chips + Collections */}
      <section className="pt-3 md:pt-5">
        <div className="container space-y-3 md:space-y-4">
          {/* Platform chips row */}
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto snap-row -mx-1 px-1 pb-1">
            <div className="hidden sm:flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground pr-2 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Platforms
            </div>
            {[
              { to: "/crunchy", src: crunchyrollLogo, label: "Crunchy", round: false },
              { to: "/musein", src: museinLogo, label: "MuseIN", round: true },
              { to: "/flox", src: floxLogo, label: "Flox +", round: true },
            ].map((p) => (
              <Link
                key={p.label}
                to={p.to}
                className="lg-chip shrink-0 inline-flex items-center gap-2 px-3.5 md:px-4 py-2 rounded-full text-sm font-semibold text-foreground/90 transition-transform duration-300 hover:text-primary hover:scale-[1.04] active:scale-95"
              >
                <img
                  src={p.src}
                  alt={p.label}
                  className={`h-5 w-5 object-cover ${p.round ? "rounded-full" : "w-auto object-contain"}`}
                />
                {p.label}
              </Link>
            ))}
          </div>

          {/* Featured collections grid */}
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
            {collections.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.label}
                  to={c.to}
                  className="lg-section group relative overflow-hidden aspect-[1.4/1] md:aspect-[1.6/1] p-2.5 md:p-3 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <div className={`absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${c.tint}`} />
                  <div className="absolute -top-6 -right-6 h-16 w-16 md:h-20 md:w-20 rounded-full bg-primary/30 blur-2xl pointer-events-none" />
                  <div className="relative flex items-center justify-between">
                    <div className="lg-chip rounded-full p-1.5 md:p-2">
                      <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground/90" />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="text-[11px] md:text-xs uppercase tracking-wider text-white/70">Explore</div>
                    <div className="text-sm md:text-base font-bold text-white leading-tight">{c.label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <hr className="lg-divider" />

      <RecommendedAnime />
      <MostPopular />

      <hr className="lg-divider" />

      <LatestSeries />
      <LatestEpisodes />

      <hr className="lg-divider" />

      <ComingSoon />
      <AnimeCalendar />
      <EpisodeProgress />

      <hr className="lg-divider" />

      <LatestMovies />
      <LatestEngDub />
      <RecentlyCompleted />

      {/* Social Share */}
      <section className="py-4 md:py-8">
        <div className="container">
          <div className="lg-section p-5 md:p-7">
            <SocialShare />
          </div>
        </div>
      </section>
    </div>
  );
}


