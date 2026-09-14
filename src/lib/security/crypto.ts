import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

function encryptionKey() {
  if (!env.OAUTH_ENCRYPTION_KEY) throw new Error("OAUTH_ENCRYPTION_KEY is required for credential storage");
  const key = Buffer.from(env.OAUTH_ENCRYPTION_KEY, "base64url");
  if (key.length !== 32) throw new Error("OAUTH_ENCRYPTION_KEY must be a 32-byte base64url value");
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(encoded: string): string {
  const [version, ivValue, tagValue, dataValue] = encoded.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !dataValue) throw new Error("Unsupported credential ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataValue, "base64url")), decipher.final()]).toString("utf8");
}

export function stableHash(value: string): string {
  const key = env.OAUTH_ENCRYPTION_KEY ?? "local-unconfigured-key";
  return createHmac("sha256", key).update(value).digest("hex");
}

export function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
