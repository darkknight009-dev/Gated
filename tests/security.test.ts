import { describe, expect, it } from "vitest";
import { contentHash, safeEqual } from "@/lib/security/crypto";
import { normalizeGmailMessage } from "@/lib/gmail/normalize";

const encoded = (value: string) => Buffer.from(value).toString("base64url");

describe("email content security", () => {
  it("removes scripts, tracking pixels, and unsafe links", () => {
    const message = normalizeGmailMessage({ id: "m1", threadId: "t1", payload: { mimeType: "text/html", headers: [{ name: "From", value: "Attacker <bad@example.com>" }, { name: "To", value: "me@example.com" }, { name: "Subject", value: "Hello" }], body: { data: encoded('<p>Safe</p><img src="https://tracker.test/pixel"><script>alert(1)</script><a href="javascript:alert(1)">click</a>') } } }, "me@example.com");
    expect(message.sanitizedHtml).not.toMatch(/script|img|javascript:/i);
    expect(message.bodyText).toContain("Safe");
  });

  it("uses constant-time secret comparison behaviorally", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "different")).toBe(false);
    expect(safeEqual(undefined, "same")).toBe(false);
  });

  it("produces deterministic content hashes", () => {
    expect(contentHash("private message")).toBe(contentHash("private message"));
    expect(contentHash("private message")).not.toBe(contentHash("other"));
  });
});
