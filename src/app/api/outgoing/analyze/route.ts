import { outgoingInputSchema, analyzeOutgoingDeterministically, outgoingAnalysisSchema } from "@/domain/attention";
import { getAIProvider, AIProviderError, OUTGOING_PROMPT_VERSION } from "@/lib/ai";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const context = await requireUserContext();
    await enforceRateLimit(context.user.id, "outgoing_analysis", 20, 60);
    const input = outgoingInputSchema.parse(await request.json());
    const deterministic = analyzeOutgoingDeterministically(input);
    let providerResult = null;
    try { providerResult = await getAIProvider().analyzeOutgoing(input); }
    catch (error) { if (!(error instanceof AIProviderError) || error.code !== "unconfigured") throw error; }
    const candidate = providerResult?.data;
    const result = outgoingAnalysisSchema.parse(candidate ? {
      ...candidate,
      communication_score: Math.round(deterministic.communication_score * 0.45 + candidate.communication_score * 0.55),
      evidence: [...candidate.evidence, ...deterministic.evidence].filter((value, index, values) => values.indexOf(value) === index).slice(0, 6),
    } : deterministic);
    const { data: emailAccount } = await context.supabase.from("email_accounts").select("id").eq("user_id", context.user.id).eq("connection_status", "connected").limit(1).maybeSingle();
    const admin = createSupabaseAdminClient();
    const { data: draft, error: draftError } = await admin.from("outgoing_drafts").insert({ account_id: context.accountId, user_id: context.user.id, email_account_id: emailAccount?.id ?? null, to_emails: input.to, subject: input.subject, body_text: input.body, purpose: input.purpose, recipient_context: input.recipientContext, status: "analyzed" }).select("id").single();
    if (draftError || !draft) throw new Error("Draft persistence failed");
    await admin.from("outgoing_analyses").insert({ account_id: context.accountId, draft_id: draft.id, communication_score: result.communication_score, specificity: result.specificity, context: result.context, intent_clarity: result.intent_clarity, relevance: result.relevance, genericness: result.genericness, ask_quality: result.ask_quality, evidence: result.evidence, suggested_body: result.suggested_body, provider: providerResult?.usage.provider ?? null, model_name: providerResult?.usage.model ?? null, model_version: providerResult?.usage.modelVersion ?? null, prompt_version: providerResult?.usage.promptVersion ?? OUTGOING_PROMPT_VERSION });
    await admin.from("product_events").insert([{ account_id: context.accountId, user_id: context.user.id, name: "outgoing_analysis_started", properties: {} }, { account_id: context.accountId, user_id: context.user.id, name: "outgoing_analysis_completed", properties: { score_band: Math.floor(result.communication_score / 10) * 10 } }]);
    return Response.json({ draftId: draft.id, analysis: result, mode: providerResult ? "ai_enriched" : "deterministic" });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
    if (error instanceof AIProviderError) return Response.json({ error: "analysis_temporarily_unavailable" }, { status: error.retryable ? 503 : 422 });
    if (error instanceof Error && error.name === "ZodError") return Response.json({ error: "invalid_request" }, { status: 400 });
    return Response.json({ error: "analysis_unavailable" }, { status: 503 });
  }
}
