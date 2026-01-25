import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Info, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface FeaturedAnimeItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  genres: string[];
  views: number;
}

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  return `${(views / 1000).toFixed(0)}K`;
};

const FEATURED_ANIME: FeaturedAnimeItem[] = [
  {
    id: 'your-name',
    title: 'Your Name',
    description: 'Two teenagers share a profound, magical connection upon discovering they are swapping bodies. Things manage to become even more complicated when the boy and girl decide to meet in person.',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/en/0/0b/Your_Name_poster.png',
    genres: ['Romance', 'Fantasy', 'Drama'],
    views: 8500000
  },
  {
    id: 'suzume',
    title: 'Suzume',
    description: 'A modern action adventure road story where a 17-year-old girl named Suzume helps a mysterious young man close doors from the other side that are releasing disaster all over Japan.',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/en/a/a9/Suzume_no_Tojimari.jpg',
    genres: ['Adventure', 'Fantasy', 'Animation'],
    views: 6200000
  },
  {
    id: 'your-lie-in-april',
    title: 'Your Lie in April',
    description: 'A piano prodigy who lost his ability to play after suffering a traumatic event in his childhood is forced back into the spotlight by an eccentric girl with a secret of her own.',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/en/0/05/Your_lie_in_April_cover.jpg',
    genres: ['Drama', 'Music', 'Romance'],
    views: 4800000
  },
  {
    id: 'bofuri',
    title: "Bofuri: I Don't Want to Get Hurt",
    description: 'Kaede Honjou is invited by her friend to play a VRMMO game with her. Naming her character Maple, she joins in and puts all her points in vitality to not feel pain, unlocking unique abilities.',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/en/3/3f/Bofuri_light_novel_volume_1_cover.jpg',
    genres: ['Action', 'Comedy', 'Fantasy'],
    views: 3100000
  },
  {
    id: 'jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    description: 'A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself. He enters a shaman school to be able to locate the demon\'s other body parts and thus exorcise himself.',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/en/4/46/Jujutsu_Kaisen_key_visual.png',
    genres: ['Action', 'Fantasy', 'Horror'],
    views: 9200000
  },
  {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    description: 'In a world where hunters - humans who possess magical abilities - must battle deadly monsters to protect the human race, Sung Jinwoo, the weakest of the hunters, emerges as a powerful player.',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Solo_Leveling_Volume_1.png',
    genres: ['Action', 'Adventure', 'Fantasy'],
    views: 7600000
  }
];

export function FeaturedSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  // Auto-slide every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex]);

  const handleNext = () => {
    if (isAnimating) return;
    setDirection('right');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % FEATURED_ANIME.length);
      setIsAnimating(false);
    }, 500);
  };

  const handlePrev = () => {
    if (isAnimating) return;
    setDirection('left');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + FEATURED_ANIME.length) % FEATURED_ANIME.length);
      setIsAnimating(false);
    }, 500);
  };

  const current = FEATURED_ANIME[currentIndex];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background/50 py-6 md:py-8">
      <div className="container relative">
        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary/20 transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-primary/20 transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Slide Content */}
        <div className="relative mx-8 md:mx-12">
          <div
            className={`flex flex-col md:flex-row gap-4 md:gap-6 items-center transition-all duration-500 ${
              isAnimating
                ? direction === 'right'
                  ? 'opacity-0 translate-x-4'
                  : 'opacity-0 -translate-x-4'
                : 'opacity-100 translate-x-0'
            }`}
          >
            {/* Thumbnail */}
            <div className="relative flex-shrink-0 w-40 md:w-52">
              <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-2xl ring-2 ring-primary/20">
                <img
                  src={current.thumbnail}
                  alt={current.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left space-y-3 md:space-y-4">
              <h2 className="text-xl md:text-3xl lg:text-4xl font-bold line-clamp-2">
                {current.title}
              </h2>

              {/* Genres and Views */}
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
                {current.genres.map((genre, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {genre}
                  </Badge>
                ))}
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                  <Eye className="h-3 w-3" />
                  {formatViews(current.views)} views
                </div>
              </div>

              {/* Description */}
              <p className="text-sm md:text-base text-muted-foreground line-clamp-2 md:line-clamp-3 max-w-xl">
                {current.description}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                <Button asChild size="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to={`/browse?search=${encodeURIComponent(current.title)}`}>
                    <Play className="h-4 w-4 mr-2 fill-current" />
                    Watch Now
                  </Link>
                </Button>
                <Button asChild variant="outline" size="default">
                  <Link to={`/browse?search=${encodeURIComponent(current.title)}`}>
                    <Info className="h-4 w-4 mr-2" />
                    More Info
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center gap-2 mt-4">
          {FEATURED_ANIME.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (isAnimating) return;
                setDirection(index > currentIndex ? 'right' : 'left');
                setIsAnimating(true);
                setTimeout(() => {
                  setCurrentIndex(index);
                  setIsAnimating(false);
                }, 300);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-primary w-6'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
