import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, Sparkles, TrendingUp, Users, Tv } from 'lucide-react';

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-anime-purple/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-anime-pink/30 rounded-full blur-3xl animate-pulse animation-delay-200" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-anime-blue/20 rounded-full blur-3xl animate-pulse animation-delay-400" />

        <div className="relative z-10 container text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
            <Sparkles className="h-4 w-4 text-anime-purple" />
            <span className="text-sm font-medium">Free Anime Streaming Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 animate-fade-in-up">
            Stream Your Favorite
            <span className="block anime-gradient-text">Anime Free</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in-up animation-delay-200">
            Discover thousands of anime series and movies. Watch in HD with customizable subtitles, 
            track your progress, and join a community of anime lovers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-400">
            <Button asChild size="lg" className="anime-button text-lg px-8">
              <Link to="/browse">
                <Play className="mr-2 h-5 w-5 fill-current" />
                Start Watching
              </Link>
            </Button>
            {!user && (
              <Button asChild variant="outline" size="lg" className="text-lg px-8 border-border/50 hover:bg-primary/10">
                <Link to="/auth">Create Account</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/30">
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
