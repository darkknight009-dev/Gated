import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { completeJob, processJob, type ProcessingJob } from "@/lib/jobs/processor";
import { logger, requestId } from "@/lib/observability/logger";

export async function POST(request: Request) {
  if (!safeEqual(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), env.CRON_SECRET)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = requestId(request);
  const worker = `web:${id}`;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_processing_jobs", { p_worker: worker, p_limit: 10 });
  if (error) return Response.json({ error: "queue_unavailable" }, { status: 503 });
  const jobs = (data ?? []) as ProcessingJob[];
  let succeeded = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await processJob(job);
      await completeJob(job);
      succeeded += 1;
    } catch (jobError) {
      await completeJob(job, jobError);
      logger.error("job_failed", { requestId: id, jobId: job.id, jobType: job.type, attempt: job.attempts, errorCode: jobError instanceof Error ? jobError.message : "unknown" });
      failed += 1;
    }
  }
  return Response.json({ claimed: jobs.length, succeeded, failed });
}
