import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { AddLocalMovementInput, LocalMovement, LocalMovementStatus } from "./types";

const DB_NAME = "desam_inventory";
const DB_VERSION = 2;
const STORE = "local_movements";
const SNAPSHOT_STORE = "descuento_snapshots";

interface DesamInventoryDb extends DBSchema {
  local_movements: {
    key: string;
    value: LocalMovement;
    indexes: {
      by_posta_fecha: [string, string];
      by_estado: LocalMovementStatus;
      by_posta: string;
    };
  };
  descuento_snapshots: {
    key: string;
    value: Record<string, unknown>;
  };
}

let dbPromise: Promise<IDBPDatabase<DesamInventoryDb>> | null = null;

export function getDesamDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB solo está disponible en el navegador.");
  }
  if (!dbPromise) {
    dbPromise = openDB<DesamInventoryDb>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE, { keyPath: "idLocal" });
          store.createIndex("by_posta_fecha", ["postaId", "fechaConsumo"]);
          store.createIndex("by_estado", "estado");
          store.createIndex("by_posta", "postaId");
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

function getDb() {
  return getDesamDb();
}

export async function addLocalMovement(
  input: AddLocalMovementInput
): Promise<LocalMovement> {
  const record: LocalMovement = {
    ...input,
    estado: input.estado ?? "pending",
    createdAtLocal: new Date().toISOString(),
  };
  const db = await getDb();
  await db.put(STORE, record);
  return record;
}

export async function getLocalMovement(idLocal: string): Promise<LocalMovement | undefined> {
  const db = await getDb();
  return db.get(STORE, idLocal);
}

export async function getLocalMovementsByDate(params: {
  fecha: string;
  postaId: string;
}): Promise<LocalMovement[]> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readonly");
  const index = tx.store.index("by_posta_fecha");
  const range = IDBKeyRange.only([params.postaId, params.fecha]);
  return index.getAll(range);
}

export async function getLocalMovementsByPostaMonth(
  postaId: string,
  anio: number,
  mes: number
): Promise<LocalMovement[]> {
  const prefix = `${anio}-${String(mes).padStart(2, "0")}`;
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE, "by_posta", postaId);
  return all.filter((m) => m.fechaConsumo.startsWith(prefix));
}

export async function getPendingMovements(postaId?: string): Promise<LocalMovement[]> {
  const db = await getDb();
  const pending = await db.getAllFromIndex(STORE, "by_estado", "pending");
  if (!postaId) return pending;
  return pending.filter((m) => m.postaId === postaId);
}

/** Reintenta movimientos en error pasándolos a pendientes. */
export async function resetErrorMovementsToPending(postaId?: string): Promise<number> {
  const err = await getErrorMovements(postaId);
  for (const m of err) {
    await updateLocalMovement(m.idLocal, {
      estado: "pending",
      errorMessage: undefined,
    });
  }
  return err.length;
}

export async function getErrorMovements(postaId?: string): Promise<LocalMovement[]> {
  const db = await getDb();
  const err = await db.getAllFromIndex(STORE, "by_estado", "error");
  if (!postaId) return err;
  return err.filter((m) => m.postaId === postaId);
}

export async function updateLocalMovement(
  idLocal: string,
  patch: Partial<Pick<LocalMovement, "estado" | "errorMessage" | "syncedAt">>
): Promise<void> {
  const db = await getDb();
  const prev = await db.get(STORE, idLocal);
  if (!prev) return;
  await db.put(STORE, { ...prev, ...patch });
}

export async function markMovementAsSynced(idLocal: string): Promise<void> {
  await updateLocalMovement(idLocal, {
    estado: "synced",
    syncedAt: new Date().toISOString(),
    errorMessage: undefined,
  });
}

export async function markMovementAsError(
  idLocal: string,
  errorMessage: string
): Promise<void> {
  await updateLocalMovement(idLocal, { estado: "error", errorMessage });
}

export async function deleteMovement(idLocal: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, idLocal);
}

/** Elimina registros ya sincronizados con más de 30 días de antigüedad. */
export async function pruneSyncedMovements(): Promise<void> {
  const db = await getDb();
  const all = await db.getAll(STORE);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const m of all) {
    if (m.estado !== "synced" || !m.syncedAt) continue;
    if (Date.parse(m.syncedAt) < cutoff) {
      await db.delete(STORE, m.idLocal);
    }
  }
}
