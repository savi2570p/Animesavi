import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, Sparkles, TrendingUp, Users, Tv } from 'lucide-react';
import { FeaturedAnime } from '@/components/home/FeaturedAnime';
import { ContinueWatching } from '@/components/home/ContinueWatching';
import { RecommendedAnime } from '@/components/home/RecommendedAnime';

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Featured Anime Hero */}
      <FeaturedAnime />

      {/* Continue Watching */}
      <ContinueWatching />

      {/* Recommended Anime */}
      <RecommendedAnime />

      {/* Features Section */}
      <section className="py-20">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-12">
            Why Choose <span className="anime-gradient-text">AnimeStreamHub</span>?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="anime-card p-6 text-center">
              <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                <Tv className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-2">HD Quality</h3>
              <p className="text-muted-foreground">
                Stream in crystal clear HD with adaptive quality based on your connection.
              </p>
            </div>

            <div className="anime-card p-6 text-center">
              <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-2">Personalized</h3>
              <p className="text-muted-foreground">
                Get recommendations based on your watch history and favorite genres.
              </p>
            </div>

            <div className="anime-card p-6 text-center">
              <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold mb-2">Community</h3>
              <p className="text-muted-foreground">
                Join discussions, share your thoughts, and connect with fellow anime fans.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center">
            <div className="absolute inset-0 bg-[url('/placeholder.svg')] opacity-10" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
                Ready to Start Your Anime Journey?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                Sign up now and get access to thousands of anime series and movies for free.
              </p>
              <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-8">
                <Link to={user ? '/browse' : '/auth'}>
                  {user ? 'Browse Anime' : 'Get Started Free'}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
