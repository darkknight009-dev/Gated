import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env, isSupabaseAdminConfigured } from "@/lib/env";

export function createSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured) {
    throw new Error("Supabase service role is not configured");
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
