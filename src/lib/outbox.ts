import Dexie, { type Table } from "dexie";
import type { CompleteSaleArgs, SaleWithItems } from "./types";

/**
 * Offline outbox (IndexedDB via Dexie).
 * Sales completed while offline (or when the network drops mid-request) are
 * queued here with an idempotency key and replayed by the SyncManager.
 * The optimistic record keeps the UI (sales list, receipts, dashboard) truthful
 * while we're still offline.
 */
export interface OutboxSale {
  key: string; // = p_idempotency_key
  payload: CompleteSaleArgs;
  status: "pending" | "syncing" | "failed";
  error?: string;
  retries: number;
  createdAt: number;
  optimistic: SaleWithItems;
}

export class SmartDukaDB extends Dexie {
  outbox!: Table<OutboxSale, string>;

  constructor() {
    super("SmartDukaDB");
    this.version(1).stores({
      outbox: "key, status, createdAt",
    });
  }
}

export const outboxDb = new SmartDukaDB();

export async function enqueueSale(entry: OutboxSale) {
  await outboxDb.outbox.put(entry);
}

export async function removeSale(key: string) {
  await outboxDb.outbox.delete(key);
}

export async function pendingSales(): Promise<OutboxSale[]> {
  return outboxDb.outbox.where("status").notEqual("failed").toArray();
}
