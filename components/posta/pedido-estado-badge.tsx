import { Badge } from "@/components/ui/badge";
import {
  pedidoEstadoUiConfig,
  type PedidoEstadoUi,
} from "@/lib/domain/pedido-estado-ui";
import { cn } from "@/lib/utils";

type Props = {
  estado: PedidoEstadoUi | string;
  className?: string;
};

export function PedidoEstadoBadge({ estado, className }: Props) {
  const cfg = pedidoEstadoUiConfig[estado as PedidoEstadoUi];
  if (!cfg) {
    return (
      <Badge variant="outline" className={className}>
        {String(estado).replaceAll("_", " ")}
      </Badge>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium uppercase tracking-wide",
        cfg.className,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
