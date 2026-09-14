import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

export async function GET(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/sign-in?error=configuration", request.url));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.APP_URL}/auth/callback`,
      scopes: scopes.join(" "),
      queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/sign-in?error=oauth_start", request.url));
  return NextResponse.redirect(data.url);
}
