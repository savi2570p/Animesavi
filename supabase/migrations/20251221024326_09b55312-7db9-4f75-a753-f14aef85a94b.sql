-- Drop the existing insert policy
DROP POLICY IF EXISTS "Uploaders can create anime" ON public.anime;

-- Create a new policy that allows any authenticated user OR anonymous to insert
CREATE POLICY "Anyone can create anime" 
ON public.anime 
FOR INSERT 
WITH CHECK (true);

-- Update the update policy to allow anyone to update anime they uploaded
DROP POLICY IF EXISTS "Uploaders can update their own anime" ON public.anime;
CREATE POLICY "Users can update anime they uploaded or admins" 
ON public.anime 
FOR UPDATE 
USING ((uploader_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR uploader_id IS NULL);

-- Update the delete policy similarly
DROP POLICY IF EXISTS "Uploaders can delete their own anime" ON public.anime;
CREATE POLICY "Users can delete anime they uploaded or admins" 
ON public.anime 
FOR DELETE 
USING ((uploader_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR uploader_id IS NULL);