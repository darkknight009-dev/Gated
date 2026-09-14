import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, service: "gated-web", timestamp: new Date().toISOString(), dependencies: { supabase: isSupabaseConfigured ? "configured" : "not_configured" } }, { headers: { "Cache-Control": "no-store" } });
}
