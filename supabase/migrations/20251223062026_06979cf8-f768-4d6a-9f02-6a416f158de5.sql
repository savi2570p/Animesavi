-- Drop the overly permissive policy that exposes all profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a new policy that allows viewing non-admin profiles only
-- Admins can only be seen by themselves
CREATE POLICY "Users can view non-admin profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can always see their own profile
  auth.uid() = id
  OR
  -- Users can see profiles of non-admin users only
  (
    NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = profiles.id 
      AND user_roles.role = 'admin'
    )
  )
);