import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { outboxDb, type OutboxSale } from "./outbox";

type Listener = (state: { flushing: boolean }) => void;

/**
 * SyncManager replays the offline outbox against the server.
 * - Flushes when the device comes back online, every 20s, and on demand.
 * - Safe replays: every sale carries an idempotency key the server dedupes on.
 * - Network errors keep the item queued; real errors mark it failed (visible).
 */
class SyncManager {
  private flushing = false;
  private listeners = new Set<Listener>();
  private queryClient: QueryClient | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(queryClient: QueryClient) {
    this.queryClient = queryClient;
    if (typeof window === "undefined" || this.timer) return;

    window.addEventListener("online", this.kick);
    window.addEventListener("offline", this.notify);
    this.timer = setInterval(() => void this.flush(), 20_000);
    void this.flush();
  }

  stop() {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.kick);
      window.removeEventListener("offline", this.notify);
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  isFlushing() {
    return this.flushing;
  }

  private kick = () => void this.flush();
  private notify = () => this.listeners.forEach((fn) => fn({ flushing: this.flushing }));

  static isNetworkError(err: unknown): boolean {
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    const msg = err instanceof Error ? err.message : String(err ?? "");
    const m = msg.toLowerCase();
    return (
      m.includes("fetch") ||
      m.includes("network") ||
      m.includes("timeout") ||
      m.includes("aborted") ||
      m.includes("connection") ||
      m.includes("gateway")
    );
  }

  async flush(): Promise<number> {
    if (this.flushing) return 0;
    if (typeof navigator !== "undefined" && !navigator.onLine) return 0;

    this.flushing = true;
    this.notify();
    let synced = 0;

    try {
      const items = await outboxDb.outbox.where("status").anyOf("pending", "failed").toArray();
      for (const item of items) {
        try {
          await outboxDb.outbox.update(item.key, { status: "syncing" });
          const { error } = await supabase.rpc("complete_sale", item.payload);
          if (error) throw error;

          await outboxDb.outbox.delete(item.key);
          synced++;
        } catch (err) {
          if (SyncManager.isNetworkError(err)) {
            await outboxDb.outbox.update(item.key, { status: "pending", error: undefined });
            break; // still offline — stop and retry later
          }
          await outboxDb.outbox.update(item.key, {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      this.flushing = false;
      this.notify();
      if (synced > 0 && this.queryClient) {
        void this.queryClient.invalidateQueries({ queryKey: ["sales"] });
        void this.queryClient.invalidateQueries({ queryKey: ["products"] });
        void this.queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
    }

    return synced;
  }
}

export const syncManager = new SyncManager();

/** Merge outbox sales (optimistic) into a server sales list, newest first. */
export function mergeOutbox<T extends { id: string }>(server: T[], queued: OutboxSale[]): T[] {
  const ids = new Set(server.map((s) => s.id));
  const extras = queued
    .filter((q) => q.status !== "failed" || true) // failed still shown with a badge
    .map((q) => q.optimistic as unknown as T)
    .filter((s) => !ids.has(s.id));
  return [...extras, ...server];
}
