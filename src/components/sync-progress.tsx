"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { computeSyncProgress, EMPTY_SYNC_STATUS, type SyncStatus } from "@/lib/sync/progress";

const POLL_INTERVAL_MS = 4_000;
const LIST_REFRESH_THROTTLE_MS = 8_000;

export function SyncProgress({ emailAccountId, connectionStatus, phase }: { emailAccountId: string | null; connectionStatus: string; phase: string | null }) {
  const router = useRouter();
  const tracked = useRef({ analyzed: -1, active: false, refreshedAt: 0 });

  const status = useQuery<SyncStatus>({
    queryKey: ["sync-status", emailAccountId],
    enabled: Boolean(emailAccountId),
    queryFn: async () => {
      const response = await fetch(`/api/sync/status?emailAccountId=${encodeURIComponent(String(emailAccountId))}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Sync status is unavailable.");
      return response.json() as Promise<SyncStatus>;
    },
    // Poll only while work is outstanding; stop entirely once the queue drains.
    refetchInterval: (query) => {
      const data = query.state.data as SyncStatus | undefined;
      if (!data) return POLL_INTERVAL_MS;
      return data.phase === "initial" || data.pending > 0 ? POLL_INTERVAL_MS : false;
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      if (!emailAccountId) return null;
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailAccountId }) });
      if (!response.ok) throw new Error("Sync could not be started. No mailbox data was changed.");
      return response.json();
    },
    onSuccess: () => void status.refetch(),
  });

  const current = status.data;
  const view = computeSyncProgress(current ?? { ...EMPTY_SYNC_STATUS, connectionStatus, phase });

  // Push freshly scored messages into the server-rendered list without losing selection.
  useEffect(() => {
    if (!current) return;
    const now = Date.now();
    const justFinished = tracked.current.active && !view.active;
    const gainedScores = current.analyzed !== tracked.current.analyzed;
    const throttled = now - tracked.current.refreshedAt < LIST_REFRESH_THROTTLE_MS;
    tracked.current = { analyzed: current.analyzed, active: view.active, refreshedAt: tracked.current.refreshedAt };
    if (justFinished || (gainedScores && !throttled)) {
      tracked.current.refreshedAt = now;
      router.refresh();
    }
  }, [current, view.active, router]);

  if (!emailAccountId) return null;

  const Icon = view.tone === "attention" ? AlertTriangle : view.complete ? CheckCircle2 : LoaderCircle;

  return (
    <section className={`sync-progress ${view.tone}`} aria-live="polite" aria-busy={view.active}>
      <div className="sync-progress-row">
        <Icon size={13} className={view.active ? "animate-spin" : ""} aria-hidden="true" />
        <strong>{view.headline}</strong>
        <span className="sync-progress-detail">{view.detail}</span>
        {!view.active && (
          <button className="btn btn-secondary sync-progress-action" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? "Starting…" : <><RefreshCw size={12} /> Sync now</>}
          </button>
        )}
      </div>
      {view.active && (
        <div className="sync-track" role="progressbar" aria-label="Synchronization progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.indeterminate ? undefined : view.percent} aria-valuetext={view.detail}>
          <span className={`sync-fill ${view.indeterminate ? "indeterminate" : ""}`} style={view.indeterminate ? undefined : { width: `${view.percent}%` }} />
        </div>
      )}
      {!view.active && view.complete && !view.indeterminate && <span className="sr-only" role="status">Synchronization complete. {view.detail}</span>}
      {sync.error && <p className="sync-progress-error" role="alert">{sync.error.message}</p>}
      {status.error && <p className="sync-progress-error">Live progress is unavailable. Sync continues in the background.</p>}
    </section>
  );
}