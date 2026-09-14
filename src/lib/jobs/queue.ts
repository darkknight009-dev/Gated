import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type JobType = "initial_sync" | "incremental_sync" | "ingest_message" | "analyze_email" | "renew_watch" | "retention_cleanup";

export async function enqueueJob(input: {
  accountId: string;
  emailAccountId?: string;
  type: JobType;
  payload?: Record<string, unknown>;
  deduplicationKey?: string;
  requestId?: string;
  availableAt?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("processing_jobs").insert({
    account_id: input.accountId,
    email_account_id: input.emailAccountId,
    type: input.type,
    payload: input.payload ?? {},
    deduplication_key: input.deduplicationKey,
    request_id: input.requestId,
    available_at: input.availableAt,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`Unable to enqueue ${input.type}: ${error.code}`);
  }
  return data?.id as string;
}
