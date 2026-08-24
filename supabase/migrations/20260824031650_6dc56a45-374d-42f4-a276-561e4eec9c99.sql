CREATE POLICY "Users can end their own token access"
ON public.token_usage FOR DELETE TO authenticated
USING (auth.uid() = user_id);
GRANT DELETE ON public.token_usage TO authenticated;