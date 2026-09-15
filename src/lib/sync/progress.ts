export interface SyncStatus {
  phase: string | null;
  connectionStatus: string;
  synced: number;
  analyzed: number;
  pending: number;
  failed: number;
  lastSyncedAt: string | null;
  watchExpiresAt: string | null;
  hasError: boolean;
}

export interface SyncProgressView {
  active: boolean;
  complete: boolean;
  indeterminate: boolean;
  percent: number;
  headline: string;
  detail: string;
  tone: "progress" | "done" | "attention";
}

export const EMPTY_SYNC_STATUS: SyncStatus = {
  phase: null,
  connectionStatus: "disconnected",
  synced: 0,
  analyzed: 0,
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  watchExpiresAt: null,
  hasError: false,
};

/**
 * Turns raw queue/mailbox counters into a single user-facing state. Kept pure so the
 * progress contract is testable without a request, database, or browser.
 */
export function computeSyncProgress(status: SyncStatus): SyncProgressView {
  if (status.connectionStatus !== "connected") {
    const needsReauth = status.connectionStatus === "reauthorization_required";
    return {
      active: false,
      complete: false,
      indeterminate: false,
      percent: 0,
      headline: needsReauth ? "Google access expired" : "Gmail is not connected",
      detail: needsReauth ? "Stored email is safe. Reconnect to resume syncing." : "No mailbox access. Connect Gmail to begin.",
      tone: "attention",
    };
  }

  const synced = Math.max(0, status.synced);
  // Scores can outnumber live emails when a message is re-analyzed, so cap the numerator.
  const analyzed = Math.min(Math.max(0, status.analyzed), synced);
  const pending = Math.max(0, status.pending);
  const active = status.phase === "initial" || pending > 0;

  if (active) {
    return {
      active: true,
      complete: false,
      indeterminate: synced === 0,
      percent: synced === 0 ? 0 : Math.round((analyzed / synced) * 100),
      headline: status.phase === "initial" ? "Importing your recent inbox" : "Checking for new messages",
      detail: synced === 0 ? "Looking for messages to read…" : `${synced} found · ${analyzed} scored · ${pending} in queue`,
      tone: "progress",
    };
  }

  if (status.hasError || status.failed > 0) {
    return {
      active: false,
      complete: true,
      indeterminate: false,
      percent: 100,
      headline: "Sync paused",
      detail: `${analyzed} of ${synced} scored. Gated will retry automatically.`,
      tone: "attention",
    };
  }

  return {
    active: false,
    complete: true,
    indeterminate: false,
    percent: 100,
    headline: "Up to date",
    detail: synced === 0 ? "No messages to score yet." : `${analyzed} of ${synced} messages scored`,
    tone: "done",
  };
}
