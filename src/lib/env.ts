import "server-only";

import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  OAUTH_ENCRYPTION_KEY: z.string().min(43).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_PUBSUB_TOPIC: z.string().optional(),
  GOOGLE_PUBSUB_VERIFICATION_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_MODELS: z.string().default("nvidia/llama-3.3-nemotron-super-49b-v1.5,openai/gpt-oss-20b,deepseek-ai/deepseek-v4-flash,z-ai/glm-5.2"),
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid server configuration: ${parsed.error.message}`);
}

export const env = parsed.data;

export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const isSupabaseAdminConfigured = Boolean(
  isSupabaseConfigured && env.SUPABASE_SERVICE_ROLE_KEY,
);
