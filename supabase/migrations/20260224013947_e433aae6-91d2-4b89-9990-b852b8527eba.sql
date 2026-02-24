
-- Add user_id and expires_at to token_usage so access persists across PWA/browser contexts
ALTER TABLE public.token_usage 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS expires_at bigint;

-- Index for quick lookup of active access by user
CREATE INDEX IF NOT EXISTS idx_token_usage_user_active ON public.token_usage (user_id, expires_at) WHERE user_id IS NOT NULL;

-- Allow authenticated users to read their own token usage
CREATE POLICY "Users can view their own token access"
ON public.token_usage
FOR SELECT
USING (auth.uid() = user_id);
