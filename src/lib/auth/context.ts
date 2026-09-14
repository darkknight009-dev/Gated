import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthenticationError extends Error {}

export async function requireUserContext() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new AuthenticationError("Authentication required");

  const { data: membership, error: membershipError } = await supabase
    .from("account_members")
    .select("account_id, role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .single();
  if (membershipError || !membership) throw new AuthenticationError("Account membership required");

  return { supabase, user: userData.user, accountId: membership.account_id as string, role: membership.role as string };
}
