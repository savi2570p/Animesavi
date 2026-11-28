import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Home, Search, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

const NotFound = () => {
  return (
    <main className="min-h-[100svh] bg-background text-foreground flex flex-col">
      <Helmet><title>Page not found | AnimeSavi+</title><meta name="robots" content="noindex" /></Helmet>
      <header className="container py-6 border-b border-border">
        <Link to="/" className="inline-flex items-center gap-3 font-heading font-bold text-lg" aria-label="AnimeSavi+ home"><img src={logo} alt="" className="h-10 w-10 rounded-full" /><span>AnimeSavi<span className="text-primary">+</span></span></Link>
      </header>
      <div className="container flex-1 flex flex-col items-center justify-center text-center py-12 max-w-2xl">
        <div className="flex items-center justify-center gap-4 text-primary font-heading font-extrabold text-8xl sm:text-9xl" aria-hidden="true"><span>4</span><Film className="h-20 w-20 sm:h-28 sm:w-28 stroke-[1.5]" /><span>4</span></div>
        <p className="mt-5 text-xs font-semibold text-primary">404 / Page not found</p>
        <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">This scene is missing.</h1>
        <p className="mt-4 max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed">The page may have moved, or the link isn't right. Your next episode is still waiting.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild><Link to="/"><Home />Back to home</Link></Button>
          <Button asChild variant="outline"><Link to="/browse"><Search />Browse anime</Link></Button>
        </div>
        <Link to="/notices" className="mt-8 text-sm text-muted-foreground hover:text-primary underline underline-offset-4">Latest notices</Link>
      </div>
      <p className="pb-6 text-center text-xs text-muted-foreground">AnimeSavi+ · The story continues</p>
    </main>
  );
};

export default NotFound;
