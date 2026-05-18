import type { ConsumoMensualMedPayload } from "@/components/posta/consumo-mensual-panel";
import type { UltimoConsumoRow } from "@/components/posta/ultimos-consumos-tabla";

import { getDesamDb } from "./db";

const STORE = "descuento_snapshots";

export type DescuentoSnapshot = {
  key: string;
  postaId: string;
  anio: number;
  mes: number;
  basePath: string;
  puedeRegistrar: boolean;
  soloLecturaDescuentoVariante?: "admin" | "resto";
  medicamentos: ConsumoMensualMedPayload[];
  ultimosRows: UltimoConsumoRow[];
  savedAt: string;
};

function snapshotKey(postaId: string, anio: number, mes: number) {
  return `${postaId}:${anio}-${String(mes).padStart(2, "0")}`;
}

export async function saveDescuentoSnapshot(input: {
  postaId: string;
  anio: number;
  mes: number;
  basePath: string;
  puedeRegistrar: boolean;
  soloLecturaDescuentoVariante?: "admin" | "resto";
  medicamentos: ConsumoMensualMedPayload[];
  ultimosRows: UltimoConsumoRow[];
}): Promise<void> {
  const db = await getDesamDb();
  const key = snapshotKey(input.postaId, input.anio, input.mes);
  const record: DescuentoSnapshot = {
    key,
    ...input,
    savedAt: new Date().toISOString(),
  };
  await db.put(STORE, record as unknown as Record<string, unknown>);
  try {
    localStorage.setItem(
      "desam_last_descuento_url",
      `${input.basePath}?ym=${input.anio}-${String(input.mes).padStart(2, "0")}`
    );
  } catch {
    /* quota / modo privado */
  }
}

export async function loadDescuentoSnapshot(
  postaId: string,
  anio: number,
  mes: number
): Promise<DescuentoSnapshot | undefined> {
  const db = await getDesamDb();
  const row = await db.get(STORE, snapshotKey(postaId, anio, mes));
  return row as DescuentoSnapshot | undefined;
}

export function getLastDescuentoUrl(): string | null {
  try {
    return localStorage.getItem("desam_last_descuento_url");
  } catch {
    return null;
  }
}
