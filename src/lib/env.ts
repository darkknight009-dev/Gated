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
  NVIDIA_MODELS: z.string().default("openai/gpt-oss-20b,mistralai/mistral-nemotron"),
  NVIDIA_TIMEOUT_MS: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.number().int().positive().default(60_000)),
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
