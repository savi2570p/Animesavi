-- Add trailer_url column to anime table
ALTER TABLE public.anime ADD COLUMN IF NOT EXISTS trailer_url text;

-- Create anime_reviews table for ratings and reviews
CREATE TABLE public.anime_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anime_id UUID NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(anime_id, user_id)
);

-- Enable RLS
ALTER TABLE public.anime_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anime_reviews
CREATE POLICY "Reviews are viewable by everyone"
  ON public.anime_reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON public.anime_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.anime_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.anime_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_anime_reviews_updated_at
  BEFORE UPDATE ON public.anime_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();