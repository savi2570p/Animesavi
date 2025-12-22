import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, Tv, TrendingUp, Users, Zap } from 'lucide-react';
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
      <section className="py-16 md:py-20">
        <div className="container">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-center mb-10 md:mb-12">
            Why Choose <span className="anime-gradient-text">AnimeStreamHub</span>?
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Tv,
                title: 'HD Quality',
                description: 'Stream in crystal clear HD with adaptive quality based on your connection speed.',
              },
              {
                icon: Zap,
                title: 'Fast & Smooth',
                description: 'Optimized streaming with minimal buffering and instant episode switching.',
              },
              {
                icon: Users,
                title: 'Community',
                description: 'Join discussions, share your thoughts, and connect with fellow anime fans.',
              },
            ].map((feature, index) => (
              <div 
                key={feature.title}
                className={`anime-card p-6 text-center stagger-${index + 1} opacity-0 animate-fade-in`}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-heading font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-8 md:p-12 text-center">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
                backgroundSize: '40px 40px'
              }} />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold text-white mb-4">
                Ready to Start Your Anime Journey?
              </h2>
              <p className="text-white/85 text-base md:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                Sign up now and get access to thousands of anime series and movies for free.
              </p>
              <Button 
                asChild 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 text-base md:text-lg px-8 font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02]"
              >
                <Link to={user ? '/browse' : '/auth'}>
                  <Play className="h-5 w-5 mr-2 fill-current" />
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
