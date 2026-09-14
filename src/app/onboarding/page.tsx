import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Set your threshold" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured) redirect("/sign-in?error=configuration");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in");
  const { data: profile } = await supabase.from("users").select("onboarding_completed_at").eq("id", auth.user.id).single();
  if (profile?.onboarding_completed_at) redirect("/app");
  return <OnboardingFlow />;
}
