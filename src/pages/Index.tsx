import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { PlatformsSection } from '@/components/home/PlatformsSection';
import { HomeSearchHero } from "@/components/home/HomeSearchHero";
import { ContinueWatching } from "@/components/home/ContinueWatching";
import { RecommendedAnime } from "@/components/home/RecommendedAnime";
import { CloneSection } from "@/components/home/CloneSection";
import { LatestEpisodes } from "@/components/home/LatestEpisodes";
import { LatestMovies } from "@/components/home/LatestMovies";
import { LatestEngDub } from "@/components/home/LatestEngDub";
import { LatestSubOnly } from "@/components/home/LatestSubOnly";
import { LatestSeries } from "@/components/home/LatestSeries";
import { RecentlyCompleted } from "@/components/home/RecentlyCompleted";
import { EpisodeProgress } from "@/components/home/EpisodeProgress";

import { SocialShare } from "@/components/home/SocialShare";
import { MostPopular } from "@/components/home/MostPopular";
import { TrendingBanner } from "@/components/home/TrendingBanner";
import { SEO } from "@/components/SEO";
import { SectionBoundary } from "@/components/common/SectionBoundary";
import { DeferredSection } from "@/components/common/DeferredSection";


export default function Index() {
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
    <div className="home-smooth home-aurora min-h-screen [&_section]:py-2 [&_section]:md:py-4 [&_.container]:px-3 [&_.container]:md:px-4">
      <SEO
        title="AnimeSavi - Watch Anime in Hindi DUB"
        description="Watch your favorite anime in official Hindi DUB. Stream the best anime series and movies for free. Episode update same day as release calendar."
        path="/"
      />
      {/* Search header — artwork and "Watch now" follow the admin hero lineup */}
      <SectionBoundary label="home:search-hero"><HomeSearchHero /></SectionBoundary>

      {/* Trending Now */}
      <SectionBoundary label="home:trending"><TrendingBanner /></SectionBoundary>

      {/* Continue Watching */}
      <SectionBoundary label="home:continue-watching"><ContinueWatching showOnHomeOnly={true} /></SectionBoundary>

      <PlatformsSection />

      <hr className="lg-divider" />

      <DeferredSection minHeight={320}><SectionBoundary label="home:clones"><CloneSection /></SectionBoundary></DeferredSection>

      <DeferredSection minHeight={320}><SectionBoundary label="home:recommended"><RecommendedAnime /></SectionBoundary></DeferredSection>
      <DeferredSection minHeight={340}><SectionBoundary label="home:most-popular"><MostPopular /></SectionBoundary></DeferredSection>

      <hr className="lg-divider" />

      <DeferredSection minHeight={320}><SectionBoundary label="home:latest-series"><LatestSeries /></SectionBoundary></DeferredSection>
      <DeferredSection minHeight={320}><SectionBoundary label="home:latest-episodes"><LatestEpisodes /></SectionBoundary></DeferredSection>

      <hr className="lg-divider" />

      {/* Coming Soon lives on the /schedule tab only */}
      <DeferredSection minHeight={260}><SectionBoundary label="home:episode-progress"><EpisodeProgress /></SectionBoundary></DeferredSection>

      <hr className="lg-divider" />

      <DeferredSection minHeight={320}><SectionBoundary label="home:latest-movies"><LatestMovies /></SectionBoundary></DeferredSection>
      <DeferredSection minHeight={320}><SectionBoundary label="home:latest-eng-dub"><LatestEngDub /></SectionBoundary></DeferredSection>
      <DeferredSection minHeight={320}><SectionBoundary label="home:sub-only"><LatestSubOnly /></SectionBoundary></DeferredSection>
      <DeferredSection minHeight={320}><SectionBoundary label="home:recently-completed"><RecentlyCompleted /></SectionBoundary></DeferredSection>

      {/* Social Share */}
      <section className="py-3 md:py-6">
        <div className="container">
          <div className="lg-section p-3 md:p-4 max-w-3xl mx-auto">
            <DeferredSection minHeight={180}><SectionBoundary label="home:social-share"><SocialShare /></SectionBoundary></DeferredSection>
          </div>
        </div>
      </section>

    </div>
  );
}
