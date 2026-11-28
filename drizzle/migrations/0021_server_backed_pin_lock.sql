CREATE TABLE public.pin_lock_credentials (
  user_id uuid PRIMARY KEY,
  pin_salt text NOT NULL,
  pin_hash text NOT NULL,
  pin_length smallint NOT NULL CHECK (pin_length IN (4, 6)),
  iterations integer NOT NULL CHECK (iterations >= 100000),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.pin_lock_credentials TO service_role;
ALTER TABLE public.pin_lock_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pin_lock_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.pin_lock_sessions TO service_role;
ALTER TABLE public.pin_lock_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX pin_lock_sessions_user_idx ON public.pin_lock_sessions (user_id);
CREATE INDEX pin_lock_sessions_expires_idx ON public.pin_lock_sessions (expires_at);