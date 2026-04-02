import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import crunchyrollLogo from "@/assets/crunchyroll-logo.png";
import museinLogo from "@/assets/musein-logo.jpg";
import { FeaturedSlider } from "@/components/home/FeaturedSlider";
import { ContinueWatching } from "@/components/home/ContinueWatching";
import { RecommendedAnime } from "@/components/home/RecommendedAnime";
import { LatestEpisodes } from "@/components/home/LatestEpisodes";
import { LatestMovies } from "@/components/home/LatestMovies";
import { LatestSeries } from "@/components/home/LatestSeries";
import { RecentlyCompleted } from "@/components/home/RecentlyCompleted";
import { EpisodeProgress } from "@/components/home/EpisodeProgress";
import { ComingSoon } from "@/components/home/ComingSoon";
import { SocialShare } from "@/components/home/SocialShare";
import { MostPopular } from "@/components/home/MostPopular";
import { AnimeCalendar } from "@/components/AnimeCalendar";
import { TrendingBanner } from "@/components/home/TrendingBanner";

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect first-time visitors to /welcome
  useEffect(() => {
    const hasVisited = localStorage.getItem("has_visited_home");
    if (!hasVisited) {
      localStorage.setItem("has_visited_home", "true");
      navigate("/welcome", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <FeaturedSlider />

      {/* Trending Now */}
      <TrendingBanner />

      {/* Continue Watching */}
      <ContinueWatching showOnHomeOnly={true} />

      {/* Platform Links */}
      <section className="py-3">
        <div className="container flex items-center gap-3">
          <Link
            to="/crunchy"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border bg-card/50 text-muted-foreground border-border/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
          >
            <img src={crunchyrollLogo} alt="Crunchy" className="h-5 w-auto object-contain" />
            Crunchy
          </Link>
          <Link
            to="/musein"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border bg-card/50 text-muted-foreground border-border/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
          >
            <img src={museinLogo} alt="MuseIN" className="h-5 w-5 rounded-full object-cover" />
            MuseIN
          </Link>
        </div>
      </section>

      {/* Recommended / Popular */}
      <RecommendedAnime />

      {/* Most Popular */}
      <MostPopular />

      {/* Latest Series */}
      <LatestSeries />

      {/* Latest Episodes */}
      <LatestEpisodes />

      {/* Coming Soon */}
      <ComingSoon />

      {/* Release Calendar */}
      <AnimeCalendar />

      {/* Pending Upload */}
      <EpisodeProgress />

      {/* Latest Movies */}
      <LatestMovies />

      {/* Recently Completed */}
      <RecentlyCompleted />

      {/* Social Share */}
      <section className="py-8">
        <div className="container">
          <SocialShare />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container">
          <div className="relative overflow-visible rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 p-8 md:p-12">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Start Watching Today</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Start Your Anime Journey?</h2>
              <p className="text-muted-foreground mb-6 max-w-xl">
                Sign up now and get access to thousands of anime series and movies for free. No credit card required.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
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
