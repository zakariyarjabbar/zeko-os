-- Migration 010: email pre-verification
-- Stores a temporary Supabase auth user + verification state for the inline
-- email-verify step on the signup form. Created when user clicks "Send Code",
-- updated to verified=true after OTP is confirmed, deleted once registration
-- completes. Expired records and their auth users are cleaned up lazily on the
-- next "Send Code" attempt for the same email.

CREATE TABLE IF NOT EXISTS public.email_pre_verifications (
  email      text        PRIMARY KEY,             -- lowercase, unique per in-flight signup
  user_id    uuid        NOT NULL,                -- temp Supabase auth user (random password)
  verified   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL                 -- 10 min after send, reset to +30 min after verify
);

-- Fast lookup when cleaning up by user_id.
CREATE INDEX email_pre_verifications_user_id_idx
  ON public.email_pre_verifications (user_id);

-- Service-role only — no direct client access.
ALTER TABLE public.email_pre_verifications ENABLE ROW LEVEL SECURITY;
