-- Enable deletion of watch history records
CREATE POLICY "Users can delete their own watch history" 
ON public.watch_history 
FOR DELETE 
USING (auth.uid() = user_id);