import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ProductShell } from "@/components/product-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) redirect("/sign-in?error=configuration");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in");
  const [{ data: profile }, { data: emailAccount }] = await Promise.all([
    supabase.from("users").select("display_name, email").eq("id", auth.user.id).single(),
    supabase.from("email_accounts").select("id, email_address, connection_status, sync_states(phase)").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const sync = Array.isArray(emailAccount?.sync_states) ? emailAccount.sync_states[0] : emailAccount?.sync_states;
  return <ProductShell user={{ name: (profile?.display_name as string | null) ?? auth.user.email?.split("@")[0] ?? "User", email: auth.user.email ?? "" }} emailAccount={emailAccount ? { id: emailAccount.id as string, address: emailAccount.email_address as string, status: emailAccount.connection_status as string, phase: (sync?.phase as string | null) ?? null } : null}>{children}</ProductShell>;
}
