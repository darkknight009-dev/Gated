import { ComposeForm } from "@/components/compose-form";
import { requireUserContext } from "@/lib/auth/context";

export const metadata = { title: "Compose" };
export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const context = await requireUserContext();
  const { data: account } = await context.supabase.from("email_accounts").select("id").eq("account_id", context.accountId).eq("user_id", context.user.id).eq("connection_status", "connected").limit(1).maybeSingle();
  return <ComposeForm connected={Boolean(account)} />;
}
