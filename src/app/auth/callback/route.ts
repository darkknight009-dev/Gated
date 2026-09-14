import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/security/crypto";
import { enqueueJob } from "@/lib/jobs/queue";
import { logger, requestId } from "@/lib/observability/logger";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const id = requestId(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=missing_code", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session || !data.user) throw new Error("OAuth code exchange failed");
    const accessToken = data.session.provider_token;
    const refreshToken = data.session.provider_refresh_token;
    if (!accessToken || !refreshToken) throw new Error("Google did not return offline Gmail access; re-consent is required");

    const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!profileResponse.ok) throw new Error("Unable to verify Gmail access");
    const gmailProfile = await profileResponse.json() as { emailAddress: string; historyId: string };
    const admin = createSupabaseAdminClient();
    const { data: membership, error: membershipError } = await admin.from("account_members").select("account_id").eq("user_id", data.user.id).limit(1).single();
    if (membershipError || !membership) throw new Error("Account was not provisioned");
    const providerId = data.user.identities?.find((identity) => identity.provider === "google")?.identity_id ?? gmailProfile.emailAddress;
    const scopeList = ["gmail.modify", "gmail.send"];
    const { data: emailAccount, error: emailAccountError } = await admin.from("email_accounts").upsert({
      account_id: membership.account_id,
      user_id: data.user.id,
      provider: "gmail",
      provider_account_id: providerId,
      email_address: gmailProfile.emailAddress,
      scopes: scopeList,
      connection_status: "connected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id,provider,provider_account_id" }).select("id").single();
    if (emailAccountError || !emailAccount) throw new Error("Unable to persist Gmail account");
    const { error: credentialError } = await admin.from("oauth_credentials").upsert({
      email_account_id: emailAccount.id,
      access_token_ciphertext: encryptSecret(accessToken),
      refresh_token_ciphertext: encryptSecret(refreshToken),
      token_expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
      key_version: 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "email_account_id" });
    if (credentialError) throw new Error("Unable to persist encrypted Gmail credentials");
    await admin.from("sync_states").upsert({ account_id: membership.account_id, email_account_id: emailAccount.id, history_id: gmailProfile.historyId, phase: "initial", updated_at: new Date().toISOString() }, { onConflict: "email_account_id" });
    await admin.from("audit_events").insert({ account_id: membership.account_id, actor_user_id: data.user.id, event_type: "gmail.connected", target_type: "email_account", target_id: emailAccount.id, request_id: id, metadata: { scopes: scopeList } });
    await admin.from("product_events").insert({ account_id: membership.account_id, user_id: data.user.id, name: "gmail_connected", properties: {} });
    await enqueueJob({ accountId: membership.account_id, emailAccountId: emailAccount.id, type: "initial_sync", deduplicationKey: `initial:${emailAccount.id}:first`, requestId: id });
    logger.info("gmail_connected", { requestId: id, userId: data.user.id, emailAccountId: emailAccount.id });
    return NextResponse.redirect(new URL("/onboarding", env.APP_URL));
  } catch (error) {
    logger.error("oauth_callback_failed", { requestId: id, errorCode: error instanceof Error ? error.message : "unknown" });
    return NextResponse.redirect(new URL("/sign-in?error=oauth_callback", request.url));
  }
}
