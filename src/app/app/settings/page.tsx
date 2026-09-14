import { PrivacySettings } from "@/components/privacy-settings";
import { requireUserContext } from "@/lib/auth/context";

export const metadata = { title: "Privacy Center" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requireUserContext();
  const [{ data: account }, { data: preferences }, { data: audits }] = await Promise.all([
    context.supabase.from("email_accounts").select("id,email_address,connection_status,scopes").eq("account_id", context.accountId).eq("user_id", context.user.id).limit(1).maybeSingle(),
    context.supabase.from("user_preferences").select("retention_content_days,retain_analysis_after_content_deletion,analytics_opt_in").eq("account_id", context.accountId).eq("user_id", context.user.id).single(),
    context.supabase.from("audit_events").select("id,event_type,created_at").eq("account_id", context.accountId).order("created_at", { ascending: false }).limit(8),
  ]);
  return <PrivacySettings emailAccount={account ? { id: account.id as string, address: account.email_address as string, status: account.connection_status as string, scopes: account.scopes as string[] } : null} preferences={{ retention: preferences?.retention_content_days as number | null ?? null, retainAnalysis: Boolean(preferences?.retain_analysis_after_content_deletion ?? true), analyticsOptIn: Boolean(preferences?.analytics_opt_in ?? true) }} audits={(audits ?? []) as Array<{ id: string; event_type: string; created_at: string }>} />;
}
