import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/security/crypto";
import { enqueueJob } from "@/lib/jobs/queue";
import { logger, requestId } from "@/lib/observability/logger";
import { requestOrigin } from "@/lib/site";

async function ensureAccountMembership(admin: SupabaseClient, user: User) {
  const { data: membership } = await admin
    .from("account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) return membership;

  const email = user.email ?? `${user.id}@local.gated`;
  const displayName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : email.split("@")[0];
  const avatarUrl = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  const { error: userError } = await admin.from("users").upsert({
    id: user.id,
    email,
    display_name: displayName,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (userError) throw new Error("Unable to provision user profile");

  const { data: existingAccount } = await admin
    .from("accounts")
    .select("id")
    .eq("created_by", user.id)
    .limit(1)
    .maybeSingle();

  let accountId = existingAccount?.id as string | undefined;
  if (!accountId) {
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .insert({ name: `${displayName}'s account`, slug: user.id, created_by: user.id })
      .select("id")
      .single();
    if (accountError || !account) throw new Error("Unable to provision account");
    accountId = account.id;
  }

  const { error: memberError } = await admin
    .from("account_members")
    .upsert({ account_id: accountId, user_id: user.id, role: "owner" }, { onConflict: "account_id,user_id" });
  if (memberError) throw new Error("Unable to provision account membership");

  await admin
    .from("user_preferences")
    .upsert({ account_id: accountId, user_id: user.id }, { onConflict: "account_id,user_id" });
  await admin
    .from("subscriptions")
    .upsert({ account_id: accountId }, { onConflict: "account_id" });

  return { account_id: accountId };
}

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
    const membership = await ensureAccountMembership(admin, data.user);
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
    return NextResponse.redirect(new URL("/onboarding", requestOrigin(request)));
  } catch (error) {
    logger.error("oauth_callback_failed", { requestId: id, errorCode: error instanceof Error ? error.message : "unknown" });
    return NextResponse.redirect(new URL("/sign-in?error=oauth_callback", requestOrigin(request)));
  }
}
