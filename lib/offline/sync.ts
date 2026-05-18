import {
  deleteMovement,
  getPendingMovements,
  markMovementAsError,
  markMovementAsSynced,
  pruneSyncedMovements,
} from "@/lib/offline/db";
import type { LocalMovement } from "@/lib/offline/types";

export type SyncPendingResult = {
  ok: boolean;
  synced: number;
  failed: number;
  total: number;
  errors: { idLocal: string; error: string }[];
};

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /fetch|network|failed/i.test(err.message)) {
    return true;
  }
  return false;
}

export async function syncPendingMovements(postaId: string): Promise<SyncPendingResult> {
  const pending = await getPendingMovements(postaId);
  if (pending.length === 0) {
    await pruneSyncedMovements();
    return { ok: true, synced: 0, failed: 0, total: 0, errors: [] };
  }

  try {
    const res = await fetch(`/api/postas/${postaId}/consumo/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        movements: pending.map((m) => ({
          clientSyncId: m.idLocal,
          medicamentoId: m.medicamentoId,
          fecha: m.fechaConsumo,
          cantidadConAvis: m.cantidadConAvis,
          cantidadSinAvis: m.cantidadSinAvis,
          observacion: m.observacion,
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = text || `Error HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j.error) message = j.error;
      } catch {
        /* respuesta no JSON */
      }
      if (res.status === 401 || res.status === 403) {
        for (const m of pending) {
          await markMovementAsError(m.idLocal, message);
        }
        return {
          ok: false,
          synced: 0,
          failed: pending.length,
          total: pending.length,
          errors: pending.map((m) => ({ idLocal: m.idLocal, error: message })),
        };
      }
      throw new Error(message);
    }

    const data = (await res.json()) as {
      results?: { clientSyncId: string; ok: boolean; error?: string }[];
    };

    const errors: { idLocal: string; error: string }[] = [];
    let synced = 0;
    let failed = 0;

    for (const r of data.results ?? []) {
      if (r.ok) {
        await markMovementAsSynced(r.clientSyncId);
        await deleteMovement(r.clientSyncId);
        synced += 1;
      } else {
        await markMovementAsError(r.clientSyncId, r.error ?? "Error al sincronizar.");
        failed += 1;
        errors.push({
          idLocal: r.clientSyncId,
          error: r.error ?? "Error al sincronizar.",
        });
      }
    }

    await pruneSyncedMovements();

    return {
      ok: failed === 0,
      synced,
      failed,
      total: pending.length,
      errors,
    };
  } catch (err) {
    if (isNetworkError(err)) {
      return {
        ok: false,
        synced: 0,
        failed: 0,
        total: pending.length,
        errors: [],
      };
    }
    const message = err instanceof Error ? err.message : "Error desconocido.";
    for (const m of pending) {
      await markMovementAsError(m.idLocal, message);
    }
    return {
      ok: false,
      synced: 0,
      failed: pending.length,
      total: pending.length,
      errors: pending.map((m) => ({ idLocal: m.idLocal, error: message })),
    };
  }
}

export async function trySyncSingleMovement(
  postaId: string,
  movement: LocalMovement
): Promise<{ ok: true } | { ok: false; offline: boolean; error?: string }> {
  if (!navigator.onLine) {
    return { ok: false, offline: true };
  }

  try {
    const res = await fetch(`/api/postas/${postaId}/consumo/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        movements: [
          {
            clientSyncId: movement.idLocal,
            medicamentoId: movement.medicamentoId,
            fecha: movement.fechaConsumo,
            cantidadConAvis: movement.cantidadConAvis,
            cantidadSinAvis: movement.cantidadSinAvis,
            observacion: movement.observacion,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = text || `Error HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j.error) message = j.error;
      } catch {
        /* ignore */
      }
      await markMovementAsError(movement.idLocal, message);
      return { ok: false, offline: false, error: message };
    }

    const data = (await res.json()) as {
      results?: { clientSyncId: string; ok: boolean; error?: string }[];
    };
    const first = data.results?.[0];
    if (first?.ok) {
      await deleteMovement(movement.idLocal);
      return { ok: true };
    }
    const errMsg = first?.error ?? "No se pudo sincronizar.";
    await markMovementAsError(movement.idLocal, errMsg);
    return { ok: false, offline: false, error: errMsg };
  } catch (err) {
    if (isNetworkError(err)) {
      return { ok: false, offline: true };
    }
    const message = err instanceof Error ? err.message : "Error desconocido.";
    await markMovementAsError(movement.idLocal, message);
    return { ok: false, offline: false, error: message };
  }
}
