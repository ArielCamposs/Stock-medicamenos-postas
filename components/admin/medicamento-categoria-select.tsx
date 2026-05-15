import {
  MEDICAMENTO_CATEGORIAS,
  etiquetaMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none",
  "transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
);

type Props = {
  id: string;
  name: string;
  defaultValue?: MedicamentoCategoria | string;
  required?: boolean;
  className?: string;
};

export function MedicamentoCategoriaNativeSelect({
  id,
  name,
  defaultValue = "OTROS",
  required = true,
  className,
}: Props) {
  const dv =
    typeof defaultValue === "string" && defaultValue.trim() !== ""
      ? defaultValue
      : "OTROS";

  return (
    <select
      id={id}
      name={name}
      required={required}
      defaultValue={dv}
      className={cn(selectClassName, className)}
    >
      {MEDICAMENTO_CATEGORIAS.map((value) => (
        <option key={value} value={value}>
          {etiquetaMedicamentoCategoria[value]}
        </option>
      ))}
    </select>
  );
}
