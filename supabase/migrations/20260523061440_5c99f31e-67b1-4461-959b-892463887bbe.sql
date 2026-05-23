-- 1. Tighten storage.objects INSERT policy for 'movies' bucket: require uploader/admin role
DROP POLICY IF EXISTS "Authenticated users can upload movies" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload movies" ON storage.objects;
DROP POLICY IF EXISTS "Anyone authenticated can upload movies" ON storage.objects;
DROP POLICY IF EXISTS "movies_insert_authenticated" ON storage.objects;

CREATE POLICY "Uploaders and admins can upload to movies bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'movies'
  AND (
    public.has_role(auth.uid(), 'uploader'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Uploaders and admins can update movies bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'movies'
  AND (
    public.has_role(auth.uid(), 'uploader'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Uploaders and admins can delete from movies bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'movies'
  AND (
    public.has_role(auth.uid(), 'uploader'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 2. Lock down shadow_flix_content writes to uploader/admin role only
DROP POLICY IF EXISTS "Users can insert their own shadow flix content" ON public.shadow_flix_content;
DROP POLICY IF EXISTS "Users can update their own shadow flix content" ON public.shadow_flix_content;
DROP POLICY IF EXISTS "Users can delete their own shadow flix content" ON public.shadow_flix_content;

CREATE POLICY "Uploaders and admins can insert shadow flix content"
ON public.shadow_flix_content
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND (
    public.has_role(auth.uid(), 'uploader'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Uploaders and admins can update shadow flix content"
ON public.shadow_flix_content
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = uploaded_by
   AND (
     public.has_role(auth.uid(), 'uploader'::public.app_role)
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
   ))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (auth.uid() = uploaded_by
   AND (
     public.has_role(auth.uid(), 'uploader'::public.app_role)
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
   ))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Uploaders and admins can delete shadow flix content"
ON public.shadow_flix_content
FOR DELETE
TO authenticated
USING (
  (auth.uid() = uploaded_by
   AND (
     public.has_role(auth.uid(), 'uploader'::public.app_role)
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
   ))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
