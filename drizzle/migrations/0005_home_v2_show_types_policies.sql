CREATE POLICY "Home V2 managers can insert show types" ON public.site_settings FOR INSERT TO authenticated
WITH CHECK (key = 'home_v2_show_types' AND lower(auth.jwt()->>'email') IN ('savi2570p@gmail.com','shadowtoonsindia@gmail.com'));
CREATE POLICY "Home V2 managers can update show types" ON public.site_settings FOR UPDATE TO authenticated
USING (key = 'home_v2_show_types' AND lower(auth.jwt()->>'email') IN ('savi2570p@gmail.com','shadowtoonsindia@gmail.com'))
WITH CHECK (key = 'home_v2_show_types' AND lower(auth.jwt()->>'email') IN ('savi2570p@gmail.com','shadowtoonsindia@gmail.com'));