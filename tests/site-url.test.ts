import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalOrigin, requestOrigin, siteOrigin } from "@/lib/site";

const requestWith = (headers: Record<string, string>) => new Request("https://internal.invalid/api/auth/google", { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLocalOrigin", () => {
  it("recognizes loopback origins", () => {
    expect(isLocalOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrigin("https://127.0.0.1:8080")).toBe(true);
    expect(isLocalOrigin("https://gated-swart.vercel.app")).toBe(false);
  });
});

describe("requestOrigin", () => {
  it("honours an explicit production APP_URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://gated-swart.vercel.app");
    expect(requestOrigin(requestWith({ host: "gated-swart.vercel.app" }))).toBe("https://gated-swart.vercel.app");
  });

  it("keeps a localhost APP_URL outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(requestOrigin(requestWith({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });

  it("derives the deployment host when production APP_URL still points at localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const origin = requestOrigin(requestWith({ "x-forwarded-host": "gated-swart.vercel.app", "x-forwarded-proto": "https" }));
    expect(origin).toBe("https://gated-swart.vercel.app");
    expect(origin).not.toContain("localhost");
  });

  it("never returns a localhost callback in production when APP_URL is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    expect(requestOrigin(requestWith({ "x-forwarded-host": "gated-swart.vercel.app, internal", "x-forwarded-proto": "https,http" }))).toBe("https://gated-swart.vercel.app");
  });

  it("treats a loopback forwarded host as http", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "");
    expect(requestOrigin(requestWith({ host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});

describe("siteOrigin", () => {
  it("falls back to the Vercel deployment host for metadata", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_URL", "gated-swart.vercel.app");
    expect(siteOrigin()).toBe("https://gated-swart.vercel.app");
  });

  it("prefers APP_URL when it is usable", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://gated.app/");
    expect(siteOrigin()).toBe("https://gated.app");
  });
});
