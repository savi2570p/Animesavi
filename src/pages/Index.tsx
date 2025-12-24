import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, Tv, TrendingUp, Users, Zap, Star, Clock, Award, Sparkles } from 'lucide-react';
import { FeaturedAnime } from '@/components/home/FeaturedAnime';
import { ContinueWatching } from '@/components/home/ContinueWatching';
import { RecommendedAnime } from '@/components/home/RecommendedAnime';

export default function Index() {
  const { user } = useAuth();

  const features = [
    {
      icon: Tv,
      title: 'HD Quality',
      description: 'Stream in crystal clear HD with adaptive quality based on your connection speed.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Zap,
      title: 'Fast & Smooth',
      description: 'Optimized streaming with minimal buffering and instant episode switching.',
      gradient: 'from-yellow-500 to-orange-500',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Join discussions, share your thoughts, and connect with fellow anime fans.',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  const stats = [
    { icon: Play, value: '10,000+', label: 'Episodes' },
    { icon: Star, value: '1,500+', label: 'Anime Series' },
    { icon: Clock, value: '24/7', label: 'Availability' },
    { icon: Award, value: '100%', label: 'Free' },
  ];

  return (
    <div className="min-h-screen">
      {/* Featured Anime Hero */}
      <FeaturedAnime />

      {/* Stats Bar */}
      <section className="py-8 border-y border-border/30 bg-card/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div 
                key={stat.label}
                className={`flex items-center gap-4 justify-center stagger-${index + 1} animate-fade-in`}
              >
                <div className="p-3 rounded-xl bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-heading font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Continue Watching */}
      <ContinueWatching />

      {/* Recommended Anime */}
      <RecommendedAnime />

      {/* Features Section */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="container relative">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mb-4">
              Why Choose <span className="anime-gradient-text">Anime.Savi.me</span>?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Experience anime like never before with our premium streaming platform
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className={`group relative p-8 rounded-2xl bg-card/50 border border-border/30 backdrop-blur-sm 
                           transition-all duration-500 hover:border-primary/30 hover:-translate-y-2
                           stagger-${index + 1} animate-fade-in`}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{ boxShadow: '0 0 60px hsl(25, 95%, 53%, 0.15)' }} />
                
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} 
                                flex items-center justify-center mb-6 shadow-lg
                                group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                
                <h3 className="text-xl font-heading font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent p-10 md:p-16 text-center">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
                  backgroundSize: '60px 60px'
                }} />
              </div>
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse animation-delay-500" />
            </div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-6 backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                Start Watching Today
              </div>
              
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-white mb-6 text-shadow-lg">
                Ready to Start Your<br />Anime Journey?
              </h2>
              <p className="text-white/90 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
                Sign up now and get access to thousands of anime series and movies for free. No credit card required.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                  asChild 
                  size="lg" 
                  className="bg-white text-primary hover:bg-white/90 text-lg px-10 py-6 font-semibold shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl rounded-xl"
                >
                  <Link to={user ? '/browse' : '/auth'}>
                    <Play className="h-5 w-5 mr-2 fill-current" />
                    {user ? 'Browse Anime' : 'Get Started Free'}
                  </Link>
                </Button>
                
                <Button 
                  asChild 
                  variant="outline" 
                  size="lg" 
                  className="border-2 border-white/40 text-white bg-white/10 hover:bg-white/20 text-lg px-10 py-6 font-semibold backdrop-blur-sm transition-all duration-300 hover:scale-105 rounded-xl"
                >
                  <Link to="/browse">
                    Explore Library
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
