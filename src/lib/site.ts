import "server-only";

import { env } from "@/lib/env";

const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function firstValue(value: string | null | undefined): string | null {
  const candidate = value?.split(",")[0]?.trim();
  return candidate ? candidate : null;
}

export function isLocalOrigin(value: string): boolean {
  return LOCAL_ORIGIN_PATTERN.test(value.trim());
}

function configuredOrigin(): string {
  return (process.env.APP_URL ?? env.APP_URL).trim().replace(/\/+$/, "");
}

/**
 * Explicit configuration wins, except in production when APP_URL still points at
 * localhost. A browser can never reach that origin, so it is treated as unset and
 * the real deployment host is derived instead.
 */
function trustedConfiguredOrigin(): string | null {
  const configured = configuredOrigin();
  if (process.env.NODE_ENV === "production" && isLocalOrigin(configured)) return null;
  return configured;
}

/** Origin for server code with no incoming request (metadata, worker, static redirects). */
export function siteOrigin(): string {
  const trusted = trustedConfiguredOrigin();
  if (trusted) return trusted;
  const vercelHost = firstValue(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL);
  if (vercelHost) return `https://${vercelHost}`;
  return configuredOrigin();
}

/** Origin for a route handler, derived from the host the browser actually used. */
export function requestOrigin(request: Request): string {
  const trusted = trustedConfiguredOrigin();
  if (trusted) return trusted;
  const host = firstValue(request.headers.get("x-forwarded-host")) ?? firstValue(request.headers.get("host"));
  if (host) {
    const scheme = firstValue(request.headers.get("x-forwarded-proto")) ?? (isLocalOrigin(`http://${host}`) ? "http" : "https");
    return `${scheme}://${host}`;
  }
  return siteOrigin();
}
