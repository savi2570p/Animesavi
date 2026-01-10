-- Add parent_id column to comments table for reply functionality
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

-- Add index for faster parent comment lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);