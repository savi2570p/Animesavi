-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer', 'uploader');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create uploader_applications table
CREATE TABLE public.uploader_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    sample_work TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create anime table
CREATE TABLE public.anime (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    banner_image TEXT,
    genres TEXT[] DEFAULT '{}',
    release_year INTEGER,
    status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
    type TEXT DEFAULT 'series' CHECK (type IN ('series', 'movie')),
    uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create seasons table
CREATE TABLE public.seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anime_id UUID REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
    season_number INTEGER NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create episodes table
CREATE TABLE public.episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail TEXT,
    video_url TEXT,
    external_url TEXT,
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_favorites table
CREATE TABLE public.user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    anime_id UUID REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, anime_id)
);

-- Create watch_history table
CREATE TABLE public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE NOT NULL,
    anime_id UUID REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, episode_id)
);

-- Create comments table
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_genre_preferences table for recommendations
CREATE TABLE public.user_genre_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    genre TEXT NOT NULL,
    watch_count INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, genre)
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploader_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_genre_preferences ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update genre preferences
CREATE OR REPLACE FUNCTION public.update_genre_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  anime_genres TEXT[];
  genre TEXT;
BEGIN
  SELECT genres INTO anime_genres FROM public.anime WHERE id = NEW.anime_id;
  
  IF anime_genres IS NOT NULL THEN
    FOREACH genre IN ARRAY anime_genres
    LOOP
      INSERT INTO public.user_genre_preferences (user_id, genre, watch_count)
      VALUES (NEW.user_id, genre, 1)
      ON CONFLICT (user_id, genre)
      DO UPDATE SET watch_count = user_genre_preferences.watch_count + 1, updated_at = now();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update genre preferences on watch
CREATE TRIGGER on_watch_history_insert
  AFTER INSERT ON public.watch_history
  FOR EACH ROW EXECUTE FUNCTION public.update_genre_preferences();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_anime_updated_at BEFORE UPDATE ON public.anime FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.uploader_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Uploader applications policies
CREATE POLICY "Users can view their own applications" ON public.uploader_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own applications" ON public.uploader_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all applications" ON public.uploader_applications FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update applications" ON public.uploader_applications FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Anime policies
CREATE POLICY "Anime is viewable by everyone" ON public.anime FOR SELECT USING (true);
CREATE POLICY "Uploaders can create anime" ON public.anime FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'uploader') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Uploaders can update their own anime" ON public.anime FOR UPDATE USING (uploader_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Uploaders can delete their own anime" ON public.anime FOR DELETE USING (uploader_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Seasons policies
CREATE POLICY "Seasons are viewable by everyone" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "Uploaders can manage seasons" ON public.seasons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.anime WHERE id = anime_id AND (uploader_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- Episodes policies
CREATE POLICY "Episodes are viewable by everyone" ON public.episodes FOR SELECT USING (true);
CREATE POLICY "Uploaders can manage episodes" ON public.episodes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.seasons s
    JOIN public.anime a ON a.id = s.anime_id
    WHERE s.id = season_id AND (a.uploader_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- User favorites policies
CREATE POLICY "Users can view their own favorites" ON public.user_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own favorites" ON public.user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favorites" ON public.user_favorites FOR DELETE USING (auth.uid() = user_id);

-- Watch history policies
CREATE POLICY "Users can view their own watch history" ON public.watch_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own watch history" ON public.watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watch history" ON public.watch_history FOR UPDATE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- User genre preferences policies
CREATE POLICY "Users can view their own preferences" ON public.user_genre_preferences FOR SELECT USING (auth.uid() = user_id);

-- Create storage bucket for anime media
INSERT INTO storage.buckets (id, name, public) VALUES ('anime-media', 'anime-media', true);

-- Storage policies
CREATE POLICY "Anyone can view anime media" ON storage.objects FOR SELECT USING (bucket_id = 'anime-media');
CREATE POLICY "Uploaders can upload anime media" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'anime-media' AND (public.has_role(auth.uid(), 'uploader') OR public.has_role(auth.uid(), 'admin'))
);
CREATE POLICY "Uploaders can update their media" ON storage.objects FOR UPDATE USING (
  bucket_id = 'anime-media' AND (public.has_role(auth.uid(), 'uploader') OR public.has_role(auth.uid(), 'admin'))
);
CREATE POLICY "Uploaders can delete their media" ON storage.objects FOR DELETE USING (
  bucket_id = 'anime-media' AND (public.has_role(auth.uid(), 'uploader') OR public.has_role(auth.uid(), 'admin'))
);