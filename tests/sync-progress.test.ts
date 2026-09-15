import { afterEach, describe, expect, it, vi } from "vitest";
import { computeSyncProgress, EMPTY_SYNC_STATUS, type SyncStatus } from "@/lib/sync/progress";

const status = (overrides: Partial<SyncStatus> = {}): SyncStatus => ({ ...EMPTY_SYNC_STATUS, connectionStatus: "connected", ...overrides });

describe("computeSyncProgress", () => {
  it("reports an indeterminate bar before any message is found", () => {
    const view = computeSyncProgress(status({ phase: "initial" }));
    expect(view.active).toBe(true);
    expect(view.indeterminate).toBe(true);
    expect(view.percent).toBe(0);
    expect(view.tone).toBe("progress");
  });

  it("reports determinate progress from scored versus found messages", () => {
    const view = computeSyncProgress(status({ phase: "initial", synced: 10, analyzed: 5, pending: 5 }));
    expect(view.active).toBe(true);
    expect(view.indeterminate).toBe(false);
    expect(view.percent).toBe(50);
    expect(view.detail).toContain("10 found");
    expect(view.detail).toContain("5 in queue");
  });

  it("treats outstanding jobs as active even after the import phase", () => {
    const view = computeSyncProgress(status({ phase: "idle", synced: 40, analyzed: 40, pending: 3 }));
    expect(view.active).toBe(true);
    expect(view.headline).toMatch(/Checking for new messages/);
  });

  it("reports completion once the queue drains", () => {
    const view = computeSyncProgress(status({ phase: "idle", synced: 40, analyzed: 40 }));
    expect(view.active).toBe(false);
    expect(view.complete).toBe(true);
    expect(view.percent).toBe(100);
    expect(view.headline).toBe("Up to date");
    expect(view.detail).toBe("40 of 40 messages scored");
  });

  it("caps analyzed at synced so a re-analysis cannot exceed 100 percent", () => {
    const view = computeSyncProgress(status({ phase: "initial", synced: 8, analyzed: 12, pending: 1 }));
    expect(view.percent).toBe(100);
  });

  it("surfaces dead jobs instead of claiming the mailbox is up to date", () => {
    const view = computeSyncProgress(status({ phase: "idle", synced: 20, analyzed: 18, failed: 2 }));
    expect(view.tone).toBe("attention");
    expect(view.headline).toBe("Sync paused");
  });

  it("surfaces a recorded sync error", () => {
    const view = computeSyncProgress(status({ phase: "idle", synced: 20, analyzed: 20, hasError: true }));
    expect(view.tone).toBe("attention");
  });

  it("asks for reconnection when Google access expired", () => {
    const view = computeSyncProgress(status({ connectionStatus: "reauthorization_required" }));
    expect(view.active).toBe(false);
    expect(view.complete).toBe(false);
    expect(view.tone).toBe("attention");
    expect(view.headline).toMatch(/expired/i);
  });

  it("states plainly when no mailbox is connected", () => {
    const view = computeSyncProgress({ ...EMPTY_SYNC_STATUS });
    expect(view.headline).toBe("Gmail is not connected");
    expect(view.detail).toMatch(/Connect Gmail/);
  });

  it("is safe on an empty connected mailbox", () => {
    const view = computeSyncProgress(status({ phase: "idle" }));
    expect(view.complete).toBe(true);
    expect(view.detail).toBe("No messages to score yet.");
  });
});

describe("computeSyncProgress purity", () => {
  it("does not mutate its input", () => {
    const input = status({ phase: "initial", synced: 5, analyzed: 9, pending: 1 });
    const snapshot = JSON.stringify(input);
    computeSyncProgress(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});