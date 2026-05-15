import type { SupabaseClient } from "@supabase/supabase-js";

export type StockAuditInput = {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function registrarAuditLog(
  supabase: SupabaseClient,
  input: StockAuditInput
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[audit_logs] no se pudo registrar auditoría:", error.message);
  }
}
