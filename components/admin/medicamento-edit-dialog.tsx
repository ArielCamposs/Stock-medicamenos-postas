"use client";

import {
  MedicamentoRowForm,
  type MedicamentoRow,
} from "@/components/admin/medicamento-row-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MedicamentoEditDialog({
  medicamento,
  open,
  onOpenChange,
}: {
  medicamento: MedicamentoRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!medicamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar medicamento</DialogTitle>
          <DialogDescription>
            {medicamento.nombre} · {medicamento.codigo_interno}. Los cambios aplican al catálogo
            global; el stock por posta se ve en la tabla.
          </DialogDescription>
        </DialogHeader>
        <MedicamentoRowForm
          medicamento={medicamento}
          onSuccess={() => onOpenChange(false)}
          onDeleted={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
