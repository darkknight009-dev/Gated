import "server-only";

import sanitizeHtml from "sanitize-html";
import { contentHash } from "@/lib/security/crypto";
import type { GmailHeader, GmailMessage, GmailPart } from "./types";

const decodeBase64Url = (value?: string) => value ? Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "";
const header = (headers: GmailHeader[] | undefined, name: string) => headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";

function collectParts(part: GmailPart | undefined, result: { text: string[]; html: string[]; attachments: boolean }) {
  if (!part) return;
  if (part.filename || part.body?.attachmentId) result.attachments = true;
  if (!part.filename && part.mimeType === "text/plain" && part.body?.data) result.text.push(decodeBase64Url(part.body.data));
  if (!part.filename && part.mimeType === "text/html" && part.body?.data) result.html.push(decodeBase64Url(part.body.data));
  part.parts?.forEach((child) => collectParts(child, result));
}

function address(value: string) {
  const angle = value.match(/^(.*?)\s*<([^>]+)>/);
  const email = (angle?.[2] ?? value).trim().toLowerCase();
  const name = angle?.[1]?.trim().replace(/^"|"$/g, "") || null;
  return { email, name };
}

function addresses(value: string) {
  return value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((item) => address(item).email).filter((email) => email.includes("@"));
}

function safeHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "blockquote", "ul", "ol", "li", "a", "h1", "h2", "h3", "table", "tbody", "tr", "td"],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["https", "http", "mailto"],
    disallowedTagsMode: "discard",
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }) },
    exclusiveFilter: (frame) => frame.tag === "img" || frame.tag === "script" || frame.tag === "style",
  });
}

export function normalizeGmailMessage(message: GmailMessage, mailboxAddress: string) {
  const headers = message.payload?.headers;
  const parts = { text: [] as string[], html: [] as string[], attachments: false };
  collectParts(message.payload, parts);
  if (!parts.text.length && message.payload?.mimeType === "text/plain") parts.text.push(decodeBase64Url(message.payload.body?.data));
  if (!parts.html.length && message.payload?.mimeType === "text/html") parts.html.push(decodeBase64Url(message.payload.body?.data));
  const sanitizedHtml = safeHtml(parts.html.join("\n"));
  const plainFromHtml = sanitizeHtml(sanitizedHtml, { allowedTags: [], allowedAttributes: {} });
  const bodyText = parts.text.join("\n").trim() || plainFromHtml.trim();
  const from = address(header(headers, "From"));
  const to = addresses(header(headers, "To"));
  const cc = addresses(header(headers, "Cc"));
  const subject = header(headers, "Subject").slice(0, 998);
  const sentAtValue = header(headers, "Date");
  const sentAt = Number.isNaN(Date.parse(sentAtValue)) ? new Date(Number(message.internalDate ?? Date.now())) : new Date(sentAtValue);
  const direction = from.email === mailboxAddress.toLowerCase() ? "outbound" : "inbound";

  return {
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    providerHistoryId: message.historyId ?? null,
    rfcMessageId: header(headers, "Message-ID") || null,
    direction,
    fromEmail: from.email || "unknown@invalid.local",
    fromName: from.name,
    toEmails: to,
    ccEmails: cc,
    subject,
    snippet: (message.snippet ?? bodyText.slice(0, 240)).slice(0, 500),
    bodyText: bodyText.slice(0, 100_000),
    sanitizedHtml: sanitizedHtml.slice(0, 150_000),
    labelIds: message.labelIds ?? [],
    isRead: !(message.labelIds ?? []).includes("UNREAD"),
    hasAttachments: parts.attachments,
    sizeBytes: message.sizeEstimate ?? null,
    sentAt: sentAt.toISOString(),
    contentHash: contentHash(`${subject}\n${bodyText}`),
  };
}
