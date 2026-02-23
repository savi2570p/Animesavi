
INSERT INTO public.unlock_tokens (token, duration_hours, is_active)
VALUES ('__system_toggle__', 0, true)
ON CONFLICT (token) DO NOTHING;
