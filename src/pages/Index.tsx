import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, Tv, Clock, Award, ArrowRight, Film, Sparkles } from 'lucide-react';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import { FeaturedAnime } from '@/components/home/FeaturedAnime';
import { FeaturedSlider } from '@/components/home/FeaturedSlider';
import { ContinueWatching } from '@/components/home/ContinueWatching';
import { RecommendedAnime } from '@/components/home/RecommendedAnime';
import { LatestEpisodes } from '@/components/home/LatestEpisodes';
import { LatestMovies } from '@/components/home/LatestMovies';
import { LatestSeries } from '@/components/home/LatestSeries';
import { RecentlyCompleted } from '@/components/home/RecentlyCompleted';
import { EpisodeProgress } from '@/components/home/EpisodeProgress';
import { ComingSoon } from '@/components/home/ComingSoon';
import { SocialShare } from '@/components/home/SocialShare';
import { MostPopular } from '@/components/home/MostPopular';
import { AnimeCalendar } from '@/components/AnimeCalendar';
import { ShortsSection } from '@/components/home/ShortsSection';

export default function Index() {
  const { user } = useAuth();

  const stats = [
    { icon: Play, value: 'Latest', label: 'Series & movies upload every week' },
    { icon: Tv, value: '1,500+', label: 'Series' },
    { icon: Clock, value: '24/7', label: 'Available' },
    { icon: Award, value: 'Fully', label: 'Ad free and free' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Featured Anime Slider - Top section */}
      <FeaturedSlider />

      {/* Quick Stats Bar */}
      <section className="py-6 border-b border-border/30 bg-card/20">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <div 
                key={stat.label}
                className="flex items-center gap-3 justify-center group cursor-default"
              >
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold group-hover:text-primary transition-colors duration-200">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Continue Watching - Only shown on home page */}
      <ContinueWatching showOnHomeOnly={true} />

      {/* Crunchy Link - Always visible */}
      <section className="py-4">
        <div className="container">
          <Link
            to="/crunchy"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border bg-card/50 text-muted-foreground border-border/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
          >
            <img
              src={crunchyrollLogo}
              alt="Crunchy"
              className="h-5 w-auto object-contain"
            />
            Crunchy
          </Link>
        </div>
      </section>

      {/* Recommended Anime */}
      <RecommendedAnime />

      {/* Most Popular */}
      <MostPopular />

      {/* Latest Series */}
      <LatestSeries />

      {/* Latest Episodes */}
      <LatestEpisodes />

      {/* Coming Soon - Upcoming anime */}
      <ComingSoon />

      {/* Release Calendar */}
      <AnimeCalendar />

      {/* Pending Upload - Anime with no episodes yet */}
      <EpisodeProgress />

      {/* Latest Movies */}
      <LatestMovies />

      {/* Shorts - Bottom section */}
      <ShortsSection />

      {/* Recently Completed */}
      <RecentlyCompleted />

      {/* Social Share Section */}
      <section className="py-8">
        <div className="container">
          <SocialShare />
        </div>
      </section>

      {/* CTA Section - Simplified */}
      <section className="py-16">
        <div className="container">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 p-8 md:p-12">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Start Watching Today</span>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to Start Your Anime Journey?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-xl">
                Sign up now and get access to thousands of anime series and movies for free. No credit card required.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  asChild 
                  size="lg" 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Link to={user ? '/browse' : '/auth'}>
                    {user ? 'Browse Anime' : 'Get Started Free'}
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
