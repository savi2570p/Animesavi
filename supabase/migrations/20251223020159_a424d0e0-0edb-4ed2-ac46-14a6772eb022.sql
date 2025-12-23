-- Drop the insecure "Anyone can create anime" policy
DROP POLICY IF EXISTS "Anyone can create anime" ON public.anime;

-- Create a new policy that restricts anime creation to authenticated uploaders or admins
CREATE POLICY "Authenticated uploaders can create anime" 
ON public.anime 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = uploader_id 
  AND (
    has_role(auth.uid(), 'uploader') 
    OR has_role(auth.uid(), 'admin')
  )
);