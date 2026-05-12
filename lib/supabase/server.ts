// lib/supabase/server.ts
// Server-side Supabase client — uses the service role key.
// NEVER import this in client components — it bypasses RLS.

import "server-only";
import { createClient } from "@supabase/supabase-js";

const url         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(url, serviceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
  },
});
