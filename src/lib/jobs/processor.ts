import "server-only";

import { extractDeterministicSignals, calculateAttentionDecision, shouldUseAI } from "@/domain/attention";
import { getAIProvider, INCOMING_PROMPT_VERSION, AIProviderError, type AIResult } from "@/lib/ai";
import { gmail } from "@/lib/gmail/client";
import { normalizeGmailMessage } from "@/lib/gmail/normalize";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { enqueueJob, type JobType } from "./queue";
import type { AISignals } from "@/domain/attention";

export interface ProcessingJob {
  id: string;
  account_id: string;
  email_account_id: string | null;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  request_id: string | null;
}

const stringValue = (value: unknown) => typeof value === "string" ? value : undefined;

async function initialSync(job: ProcessingJob) {
  if (!job.email_account_id) throw new Error("initial_sync missing email account");
  const admin = createSupabaseAdminClient();
  const pageToken = stringValue(job.payload.pageToken);
  const [profile, page] = await Promise.all([
    gmail.profile(job.email_account_id),
    gmail.listMessages(job.email_account_id, pageToken),
  ]);

  const jobs = (page.messages ?? []).map((message) => ({
    account_id: job.account_id,
    email_account_id: job.email_account_id,
    type: "ingest_message",
    payload: { messageId: message.id },
    deduplication_key: `ingest:${job.email_account_id}:${message.id}`,
    request_id: job.request_id,
  }));
  if (jobs.length) {
    const { error } = await admin.from("processing_jobs").insert(jobs);
    if (error && error.code !== "23505") throw new Error(`Unable to queue messages: ${error.code}`);
  }
  if (page.nextPageToken) {
    await enqueueJob({ accountId: job.account_id, emailAccountId: job.email_account_id, type: "initial_sync", payload: { pageToken: page.nextPageToken }, deduplicationKey: `initial:${job.email_account_id}:${page.nextPageToken}`, requestId: job.request_id ?? undefined });
  } else {
    await admin.from("sync_states").upsert({ account_id: job.account_id, email_account_id: job.email_account_id, history_id: profile.historyId, phase: "idle", next_page_token: null, last_successful_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "email_account_id" });
    await admin.from("email_accounts").update({ last_synced_at: new Date().toISOString(), connection_status: "connected", updated_at: new Date().toISOString() }).eq("id", job.email_account_id);
    await admin.from("product_events").insert({ account_id: job.account_id, name: "sync_completed", properties: { mode: "initial" } });
    if (env.GOOGLE_PUBSUB_TOPIC) await enqueueJob({ accountId: job.account_id, emailAccountId: job.email_account_id, type: "renew_watch", deduplicationKey: `watch:${job.email_account_id}:${new Date().toISOString().slice(0, 10)}` });
  }
}

async function incrementalSync(job: ProcessingJob) {
  if (!job.email_account_id) throw new Error("incremental_sync missing email account");
  const admin = createSupabaseAdminClient();
  const { data: state } = await admin.from("sync_states").select("history_id").eq("email_account_id", job.email_account_id).single();
  if (!state?.history_id) {
    await enqueueJob({ accountId: job.account_id, emailAccountId: job.email_account_id, type: "initial_sync", deduplicationKey: `initial:${job.email_account_id}:recovery` });
    return;
  }
  let token: string | undefined;
  let latestHistoryId = state.history_id as string;
  do {
    let page;
    try {
      page = await gmail.history(job.email_account_id, state.history_id as string, token);
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        await enqueueJob({ accountId: job.account_id, emailAccountId: job.email_account_id, type: "initial_sync", deduplicationKey: `initial:${job.email_account_id}:stale-history` });
        await admin.from("sync_states").update({ phase: "initial", last_error_code: "STALE_HISTORY", updated_at: new Date().toISOString() }).eq("email_account_id", job.email_account_id);
        return;
      }
      throw error;
    }
    const ingestIds = new Set<string>();
    const deletedIds = new Set<string>();
    for (const history of page.history ?? []) {
      history.messagesAdded?.forEach(({ message }) => ingestIds.add(message.id));
      history.labelsAdded?.forEach(({ message }) => ingestIds.add(message.id));
      history.labelsRemoved?.forEach(({ message }) => ingestIds.add(message.id));
      history.messagesDeleted?.forEach(({ message }) => deletedIds.add(message.id));
    }
    if (ingestIds.size) {
      const { error } = await admin.from("processing_jobs").insert([...ingestIds].map((messageId) => ({ account_id: job.account_id, email_account_id: job.email_account_id, type: "ingest_message", payload: { messageId }, deduplication_key: `ingest:${job.email_account_id}:${messageId}` })));
      if (error && error.code !== "23505") throw error;
    }
    if (deletedIds.size) await admin.from("emails").update({ is_deleted: true, updated_at: new Date().toISOString() }).eq("email_account_id", job.email_account_id).in("provider_message_id", [...deletedIds]);
    latestHistoryId = page.historyId ?? latestHistoryId;
    token = page.nextPageToken;
  } while (token);
  await admin.from("sync_states").update({ history_id: latestHistoryId, phase: "idle", last_successful_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("email_account_id", job.email_account_id);
}

async function ingestMessage(job: ProcessingJob) {
  if (!job.email_account_id) throw new Error("ingest_message missing email account");
  const messageId = stringValue(job.payload.messageId);
  if (!messageId) throw new Error("ingest_message missing messageId");
  const admin = createSupabaseAdminClient();
  const { data: emailAccount, error: accountError } = await admin.from("email_accounts").select("email_address").eq("id", job.email_account_id).single();
  if (accountError || !emailAccount) throw new Error("Email account not found");
  const raw = await gmail.getMessage(job.email_account_id, messageId);
  const message = normalizeGmailMessage(raw, emailAccount.email_address as string);

  const { data: thread, error: threadError } = await admin.from("email_threads").upsert({ account_id: job.account_id, email_account_id: job.email_account_id, provider_thread_id: message.providerThreadId, subject: message.subject, last_message_at: message.sentAt, updated_at: new Date().toISOString() }, { onConflict: "email_account_id,provider_thread_id" }).select("id, message_count, user_has_replied").single();
  if (threadError || !thread) throw new Error("Thread upsert failed");

  let senderId: string | null = null;
  if (message.direction === "inbound") {
    const domain = message.fromEmail.split("@")[1] ?? "invalid.local";
    const { data: existing } = await admin.from("senders").select("id, message_count").eq("account_id", job.account_id).eq("email", message.fromEmail).maybeSingle();
    if (existing) {
      senderId = existing.id as string;
      await admin.from("senders").update({ display_name: message.fromName, domain, last_seen_at: message.sentAt, message_count: Number(existing.message_count) + 1, updated_at: new Date().toISOString() }).eq("id", senderId);
    } else {
      const { data: sender, error } = await admin.from("senders").insert({ account_id: job.account_id, email: message.fromEmail, domain, display_name: message.fromName, first_seen_at: message.sentAt, last_seen_at: message.sentAt }).select("id").single();
      if (error && error.code !== "23505") throw error;
      senderId = (sender?.id as string | undefined) ?? null;
      if (!senderId) {
        const { data: raced } = await admin.from("senders").select("id").eq("account_id", job.account_id).eq("email", message.fromEmail).single();
        senderId = raced?.id as string;
      }
    }
  }

  const emailRecord = { account_id: job.account_id, email_account_id: job.email_account_id, thread_id: thread.id, sender_id: senderId, provider_message_id: message.providerMessageId, provider_history_id: message.providerHistoryId, rfc_message_id: message.rfcMessageId, direction: message.direction, from_email: message.fromEmail, from_name: message.fromName, to_emails: message.toEmails, cc_emails: message.ccEmails, subject: message.subject, snippet: message.snippet, body_text: message.bodyText, sanitized_html: message.sanitizedHtml, label_ids: message.labelIds, is_read: message.isRead, is_deleted: false, has_attachments: message.hasAttachments, content_hash: message.contentHash, size_bytes: message.sizeBytes, sent_at: message.sentAt, received_at: message.direction === "inbound" ? message.sentAt : null, updated_at: new Date().toISOString() };
  const { data: email, error: emailError } = await admin.from("emails").upsert(emailRecord, { onConflict: "email_account_id,provider_message_id" }).select("id, content_hash").single();
  if (emailError || !email) throw new Error("Email upsert failed");
  await admin.from("email_threads").update({ message_count: Math.max(Number(thread.message_count), 0) + 1, user_has_replied: Boolean(thread.user_has_replied) || message.direction === "outbound", is_active_conversation: Boolean(thread.user_has_replied) || message.direction === "outbound", updated_at: new Date().toISOString() }).eq("id", thread.id);

  const { data: cached } = await admin.from("email_analyses").select("id").eq("email_id", email.id).eq("content_hash", message.contentHash).limit(1).maybeSingle();
  if (!cached) await enqueueJob({ accountId: job.account_id, emailAccountId: job.email_account_id, type: "analyze_email", payload: { emailId: email.id }, deduplicationKey: `analyze:${email.id}:${message.contentHash}`, requestId: job.request_id ?? undefined });
}

async function analyzeEmail(job: ProcessingJob) {
  const emailId = stringValue(job.payload.emailId);
  if (!emailId) throw new Error("analyze_email missing emailId");
  const admin = createSupabaseAdminClient();
  const { data: email, error } = await admin.from("emails").select("id, account_id, subject, body_text, from_email, label_ids, content_hash, sender_id, thread_id").eq("id", emailId).eq("account_id", job.account_id).single();
  if (error || !email) throw new Error("Email not found for analysis");
  const [{ data: relationship }, { data: thread }, { data: preferences }] = await Promise.all([
    email.sender_id ? admin.from("sender_relationships").select("relationship_type, historical_importance, response_rate").eq("sender_id", email.sender_id).maybeSingle() : Promise.resolve({ data: null }),
    email.thread_id ? admin.from("email_threads").select("message_count, user_has_replied, is_active_conversation").eq("id", email.thread_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("user_preferences").select("high_priority_topics, low_priority_topics, custom_context").eq("account_id", job.account_id).limit(1).maybeSingle(),
  ]);
  const deterministic = extractDeterministicSignals({
    subject: (email.subject as string | null) ?? "",
    body: (email.body_text as string | null) ?? "",
    fromEmail: email.from_email as string,
    labelIds: (email.label_ids as string[]) ?? [],
    highPriorityTopics: (preferences?.high_priority_topics as string[]) ?? [],
    lowPriorityTopics: (preferences?.low_priority_topics as string[]) ?? [],
    relationshipType: (relationship?.relationship_type as string) ?? "unknown",
    historicalImportance: Number(relationship?.historical_importance ?? 0.3),
    responseRate: Number(relationship?.response_rate ?? 0),
    threadMessageCount: Number(thread?.message_count ?? 1),
    userHasReplied: Boolean(thread?.user_has_replied),
    activeConversation: Boolean(thread?.is_active_conversation),
    repeatedSimilarMessages: 0,
  });

  let ai: AIResult<AISignals> | null = null;
  if (shouldUseAI(deterministic)) {
    try {
      ai = await getAIProvider().classifyEmail({ subject: (email.subject as string | null) ?? "", body: (email.body_text as string | null) ?? "", sender: email.from_email as string, recipientProfile: (preferences?.custom_context as string | null) ?? "", relationshipContext: JSON.stringify(relationship ?? {}), threadContext: JSON.stringify(thread ?? {}) });
    } catch (aiError) {
      if (!(aiError instanceof AIProviderError) || aiError.code !== "unconfigured") logger.warn("ai_classification_failed", { jobId: job.id, emailId, provider: aiError instanceof AIProviderError ? aiError.provider : "unknown", retryable: aiError instanceof AIProviderError ? aiError.retryable : false });
    }
  }
  const decision = calculateAttentionDecision(deterministic, ai?.data);
  const analysisRecord = { account_id: job.account_id, email_id: emailId, content_hash: email.content_hash, status: ai ? "completed" : "deterministic_only", intent: decision.intent, category: decision.category, relevance: decision.signals.relevance, specificity: decision.signals.specificity, context: decision.signals.context, intent_clarity: decision.signals.intent_clarity, relationship: decision.signals.relationship, humanity_signals: decision.signals.humanity_signals, quality: decision.signals.quality, urgency: decision.signals.urgency, genericness: decision.signals.genericness, repetition: decision.signals.repetition, ai_assistance_probability: ai?.data.ai_assistance_probability ?? null, injection_signals: deterministic.injectionSignals, evidence: decision.evidence, concern: decision.concern, provider: ai?.usage.provider ?? null, model_name: ai?.usage.model ?? null, model_version: ai?.usage.modelVersion ?? null, prompt_version: ai?.usage.promptVersion ?? INCOMING_PROMPT_VERSION, input_tokens: ai?.usage.inputTokens ?? null, output_tokens: ai?.usage.outputTokens ?? null, estimated_cost_usd: ai?.usage.estimatedCostUsd ?? null, latency_ms: ai?.usage.latencyMs ?? null };
  const { data: analysis, error: analysisError } = await admin.from("email_analyses").upsert(analysisRecord, { onConflict: "email_id,content_hash,prompt_version" }).select("id").single();
  if (analysisError || !analysis) throw new Error("Analysis persistence failed");
  const { error: scoreError } = await admin.from("attention_scores").upsert({ account_id: job.account_id, email_id: emailId, analysis_id: analysis.id, score: decision.score, confidence: decision.confidence, category: decision.category, scoring_version: decision.scoringVersion, model_version: ai?.usage.modelVersion ?? null, reasoning_signals: decision.signals, override_reason: decision.overrideReason }, { onConflict: "email_id,scoring_version,analysis_id" });
  if (scoreError) throw new Error("Score persistence failed");
  await admin.from("usage_records").upsert({ account_id: job.account_id, metric: ai ? "ai_analyses" : "deterministic_analyses", quantity: 1, period_start: new Date().toISOString().slice(0, 10) }, { onConflict: "account_id,metric,period_start" });
}

async function renewWatch(job: ProcessingJob) {
  if (!job.email_account_id || !env.GOOGLE_PUBSUB_TOPIC) return;
  const result = await gmail.watch(job.email_account_id, env.GOOGLE_PUBSUB_TOPIC);
  const admin = createSupabaseAdminClient();
  await admin.from("sync_states").update({ history_id: result.historyId, watch_expires_at: new Date(Number(result.expiration)).toISOString(), updated_at: new Date().toISOString() }).eq("email_account_id", job.email_account_id);
}

async function retentionCleanup(job: ProcessingJob) {
  const admin = createSupabaseAdminClient();
  const { data: preference } = await admin.from("user_preferences").select("retention_content_days, retain_analysis_after_content_deletion").eq("account_id", job.account_id).limit(1).maybeSingle();
  if (!preference?.retention_content_days) return;
  const cutoff = new Date(Date.now() - Number(preference.retention_content_days) * 86_400_000).toISOString();
  await admin.from("emails").update({ body_text: null, sanitized_html: null, updated_at: new Date().toISOString() }).eq("account_id", job.account_id).lt("sent_at", cutoff);
  if (!preference.retain_analysis_after_content_deletion) {
    const { data: oldEmails } = await admin.from("emails").select("id").eq("account_id", job.account_id).lt("sent_at", cutoff).limit(1000);
    if (oldEmails?.length) await admin.from("email_analyses").delete().in("email_id", oldEmails.map((item) => item.id));
  }
}

export async function processJob(job: ProcessingJob) {
  if (job.type === "initial_sync") return initialSync(job);
  if (job.type === "incremental_sync") return incrementalSync(job);
  if (job.type === "ingest_message") return ingestMessage(job);
  if (job.type === "analyze_email") return analyzeEmail(job);
  if (job.type === "renew_watch") return renewWatch(job);
  if (job.type === "retention_cleanup") return retentionCleanup(job);
  throw new Error(`Unsupported job type: ${job.type satisfies never}`);
}

export async function completeJob(job: ProcessingJob, error?: unknown) {
  const admin = createSupabaseAdminClient();
  if (!error) {
    await admin.from("processing_jobs").update({ status: "succeeded", completed_at: new Date().toISOString(), locked_at: null, locked_by: null }).eq("id", job.id);
    return;
  }
  const retry = job.attempts < job.max_attempts;
  const delaySeconds = Math.min(3600, 2 ** job.attempts * 15 + Math.floor(Math.random() * 10));
  await admin.from("processing_jobs").update({ status: retry ? "queued" : "dead", available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(), locked_at: null, locked_by: null, last_error_code: error instanceof AIProviderError ? error.code : "PROCESSING_ERROR", last_error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown processing error", completed_at: retry ? null : new Date().toISOString() }).eq("id", job.id);
}
