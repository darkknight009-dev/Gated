import "server-only";

import { env } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GmailHistoryResponse, GmailListResponse, GmailMessage } from "./types";

interface CredentialRow {
  email_account_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
}

async function accessToken(emailAccountId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("oauth_credentials").select("email_account_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at").eq("email_account_id", emailAccountId).single();
  if (error || !data) throw new Error("Gmail credentials not found");
  const credential = data as CredentialRow;
  if (credential.token_expires_at && Date.parse(credential.token_expires_at) > Date.now() + 90_000) return decryptSecret(credential.access_token_ciphertext);
  if (!credential.refresh_token_ciphertext || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error("Gmail reauthorization required");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: decryptSecret(credential.refresh_token_ciphertext), grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    await admin.from("email_accounts").update({ connection_status: "reauthorization_required", updated_at: new Date().toISOString() }).eq("id", emailAccountId);
    throw new Error("Gmail token refresh failed");
  }
  const refreshed = await response.json() as { access_token: string; expires_in: number };
  await admin.from("oauth_credentials").update({ access_token_ciphertext: encryptSecret(refreshed.access_token), token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("email_account_id", emailAccountId);
  return refreshed.access_token;
}

export async function gmailRequest<T>(emailAccountId: string, path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken(emailAccountId);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    signal: init?.signal ?? AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    const error = new Error(`Gmail API request failed (${response.status})`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json() as Promise<T>;
}

export const gmail = {
  profile: (accountId: string) => gmailRequest<{ emailAddress: string; messagesTotal: number; historyId: string }>(accountId, "profile"),
  listMessages: (accountId: string, pageToken?: string) => gmailRequest<GmailListResponse>(accountId, `messages?maxResults=100&q=${encodeURIComponent("newer_than:1y")}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`),
  getMessage: (accountId: string, messageId: string) => gmailRequest<GmailMessage>(accountId, `messages/${encodeURIComponent(messageId)}?format=full`),
  history: (accountId: string, historyId: string, pageToken?: string) => gmailRequest<GmailHistoryResponse>(accountId, `history?startHistoryId=${encodeURIComponent(historyId)}&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`),
  watch: (accountId: string, topicName: string) => gmailRequest<{ historyId: string; expiration: string }>(accountId, "watch", { method: "POST", body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }) }),
  send: (accountId: string, raw: string, threadId?: string) => gmailRequest<{ id: string; threadId: string }>(accountId, "messages/send", { method: "POST", body: JSON.stringify({ raw, threadId }) }),
  modify: (accountId: string, messageId: string, addLabelIds: string[], removeLabelIds: string[]) => gmailRequest(accountId, `messages/${encodeURIComponent(messageId)}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds, removeLabelIds }) }),
  trash: (accountId: string, messageId: string) => gmailRequest(accountId, `messages/${encodeURIComponent(messageId)}/trash`, { method: "POST", body: "{}" }),
};
