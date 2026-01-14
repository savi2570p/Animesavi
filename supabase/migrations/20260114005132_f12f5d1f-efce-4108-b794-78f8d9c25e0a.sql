-- Create watch_parties table for real-time sync
CREATE TABLE public.watch_parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(6) NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  anime_id UUID NOT NULL REFERENCES public.anime(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  anime_title TEXT NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 1,
  episode_number INTEGER NOT NULL,
  playback_time REAL NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create watch_party_members table
CREATE TABLE public.watch_party_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(party_id, user_id)
);

-- Create watch_party_messages table for chat
CREATE TABLE public.watch_party_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_party_messages ENABLE ROW LEVEL SECURITY;

-- Policies for watch_parties
CREATE POLICY "Anyone can view active parties"
ON public.watch_parties FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can create parties"
ON public.watch_parties FOR INSERT
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their parties"
ON public.watch_parties FOR UPDATE
USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their parties"
ON public.watch_parties FOR DELETE
USING (auth.uid() = host_id);

-- Policies for watch_party_members
CREATE POLICY "Anyone can view party members"
ON public.watch_party_members FOR SELECT
USING (true);

CREATE POLICY "Users can join parties"
ON public.watch_party_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave parties"
ON public.watch_party_members FOR DELETE
USING (auth.uid() = user_id);

-- Policies for watch_party_messages
CREATE POLICY "Anyone can view party messages"
ON public.watch_party_messages FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can send messages"
ON public.watch_party_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_messages;

-- Create update trigger for updated_at
CREATE TRIGGER update_watch_parties_updated_at
BEFORE UPDATE ON public.watch_parties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();