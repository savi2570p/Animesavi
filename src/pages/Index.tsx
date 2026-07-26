import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
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

  // Track pointer for aurora glow (desktop only, throttled via rAF)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        el.style.setProperty("--mx", `${x}%`);
        el.style.setProperty("--my", `${y}%`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const Glass = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <section className={`py-2 md:py-4 ${className}`}>
      <div className="container">
        <div className="lg-section p-3 md:p-5">{children}</div>
      </div>
    </section>
  );

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

      {/* Platform Links */}
      <section className="py-2 md:py-3">
        <div className="container flex items-center gap-3 overflow-x-auto snap-row">
          <Link
            to="/crunchy"
            className="lg-chip inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 text-foreground/90 hover:text-primary hover:scale-[1.03]"
          >
            <img src={crunchyrollLogo} alt="Crunchy" className="h-5 w-auto object-contain" />
            Crunchy
          </Link>
          <Link
            to="/musein"
            className="lg-chip inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 text-foreground/90 hover:text-primary hover:scale-[1.03]"
          >
            <img src={museinLogo} alt="MuseIN" className="h-5 w-5 rounded-full object-cover" />
            MuseIN
          </Link>
          <Link
            to="/flox"
            className="lg-chip inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 text-foreground/90 hover:text-primary hover:scale-[1.03]"
          >
            <img src={floxLogo} alt="Flox +" className="h-5 w-5 rounded-full object-cover" />
            Flox +
          </Link>
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

      {/* CTA */}
      <section className="py-8 md:py-16">
        <div className="container">
          <div className="lg-section relative overflow-hidden p-8 md:p-12">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Start Watching Today</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-transparent">
                Ready to Start Your Anime Journey?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-xl">
                Sign up now and get access to thousands of anime series and movies for free. No credit card required.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-fuchsia-500 text-primary-foreground hover:opacity-90 shadow-[0_10px_30px_-10px_hsl(275_90%_50%/0.7)]">
                  <Link to={user ? "/browse" : "/auth"}>
                    {user ? "Browse Anime" : "Get Started Free"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

