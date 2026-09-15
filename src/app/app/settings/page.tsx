import { PrivacySettings } from "@/components/privacy-settings";
import { requireUserContext } from "@/lib/auth/context";

export const metadata = { title: "Privacy Center" };
export const dynamic = "force-dynamic";

const eventLabels: Record<string, string> = {
  "account.deletion_requested": "Account deletion requested",
  "email_data.deleted": "Synced email data deleted",
  "gmail.disconnected": "Gmail disconnected",
  "gmail.connected": "Gmail connected",
  "attention.feedback": "Attention feedback",
  "sender_prioritized": "Sender prioritized",
};

export default async function SettingsPage() {
  const context = await requireUserContext();
  const [{ data: account }, { data: preferences }, { data: audits }] = await Promise.all([
    context.supabase
      .from("email_accounts")
      .select("id,email_address,connection_status,scopes")
      .eq("account_id", context.accountId)
      .eq("user_id", context.user.id)
      .limit(1)
      .maybeSingle(),
    context.supabase
      .from("user_preferences")
      .select("retention_content_days,retain_analysis_after_content_deletion,analytics_opt_in")
      .eq("account_id", context.accountId)
      .eq("user_id", context.user.id)
      .single(),
    context.supabase
      .from("audit_events")
      .select("id,event_type,created_at")
      .eq("account_id", context.accountId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const formattedAudits = (audits ?? []).map((a) => ({
    id: a.id,
    eventTypeId: eventLabels[a.event_type] ?? a.event_type,
    createdFormatted: new Date(a.created_at).toLocaleString(),
  }));

  return (
    <PrivacySettings
      emailAccount={
        account
          ? {
              id: account.id as string,
              address: account.email_address as string,
              status: account.connection_status as string,
              scopes: account.scopes as string[],
            }
          : null
      }
      preferences={{
        retention: (preferences?.retention_content_days as number | null) ?? null,
        retainAnalysis: Boolean(preferences?.retain_analysis_after_content_deletion ?? true),
        analyticsOptIn: Boolean(preferences?.analytics_opt_in ?? true),
      }}
      audits={formattedAudits}
    />
  );
}

