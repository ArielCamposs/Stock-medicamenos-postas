import type { SupabaseClient } from "@supabase/supabase-js";

import {
  snapshotLedgerMesPosta,
  type MedLedgerMin,
} from "@/lib/posta/snapshot-ledger-mes-posta";

export type PostaStockAlertaFila = {
  postaId: string;
  postaNombre: string;
  postaCodigo: string | null;
  /** Cantidad de medicamentos con disponible ≤ crítico. */
  nCritico: number;
  /** Disponible por encima del crítico pero aún en zona de alerta. */
  nCerca: number;
  /** Peor `disponible − crítico` entre los medicamentos en alerta (más negativo = peor). */
  minMargen: number;
};

export type NivelAlertaStock = "critico" | "cerca";

/**
 * Con crítico > 0: crítico = bajo o igual al umbral; cerca = hasta un colchón sobre el crítico.
 * Con crítico = 0: crítico = sin saldo; cerca = bajo respecto al recomendado (heurística).
 * Misma heurística que el panel de supervisión; reutilizable en vistas de posta.
 */
export function nivelAlertaStock(
  disponible: number,
  stockCrit: number,
  stockRec: number
): NivelAlertaStock | null {
  if (stockCrit > 0) {
    if (disponible <= stockCrit) return "critico";
    const colchon = Math.max(2, Math.min(25, Math.ceil(stockRec * 0.12)));
    if (disponible <= stockCrit + colchon) return "cerca";
    return null;
  }
  if (disponible <= 0) return "critico";
  const topeBajo = Math.max(2, Math.ceil(stockRec * 0.15));
  if (disponible <= topeBajo) return "cerca";
  return null;
}

/** Tríada para tablas: alerta (rojo), regular (amarillo: fuera de alerta pero bajo referencial), ok (verde: ≥ referencial). */
export type NivelStockListadoVisual = "alerta" | "regular" | "ok";

export function nivelStockListadoVisual(
  disponible: number,
  stockCrit: number,
  stockRec: number
): NivelStockListadoVisual {
  const alerta = nivelAlertaStock(disponible, stockCrit, stockRec);
  if (alerta === "critico" || alerta === "cerca") {
    return "alerta";
  }
  if (disponible >= stockRec) {
    return "ok";
  }
  return "regular";
}

/**
 * Postas con al menos un medicamento activo en alerta de stock (mes calendario dado).
 * Orden: peor margen primero, luego más críticos, luego más «cerca».
 */
export async function postasConAlertaDeStock(
  supabase: SupabaseClient,
  postas: { id: string; nombre: string; codigo: string | null }[],
  meds: MedLedgerMin[],
  anio: number,
  mes: number
): Promise<PostaStockAlertaFila[]> {
  if (meds.length === 0 || postas.length === 0) return [];

  const snapshots = await Promise.all(
    postas.map(async (p) => {
      const snap = await snapshotLedgerMesPosta(supabase, p.id, anio, mes, meds);
      return { p, snap };
    })
  );

  const filas: PostaStockAlertaFila[] = [];

  for (const { p, snap } of snapshots) {
    let nCritico = 0;
    let nCerca = 0;
    let minMargen: number | null = null;

    for (const m of meds) {
      const s = snap.get(m.id);
      if (!s) continue;
      const nivel = nivelAlertaStock(s.disponible, s.stock_critico, s.stock_recomendado);
      if (!nivel) continue;
      const margen = s.disponible - s.stock_critico;
      minMargen = minMargen === null ? margen : Math.min(minMargen, margen);
      if (nivel === "critico") nCritico += 1;
      else nCerca += 1;
    }

    if (nCritico + nCerca === 0) continue;

    filas.push({
      postaId: p.id,
      postaNombre: p.nombre,
      postaCodigo: p.codigo,
      nCritico,
      nCerca,
      minMargen: minMargen ?? 0,
    });
  }

  filas.sort((a, b) => {
    if (a.minMargen !== b.minMargen) return a.minMargen - b.minMargen;
    if (a.nCritico !== b.nCritico) return b.nCritico - a.nCritico;
    return b.nCerca - a.nCerca;
  });

  return filas;
}
