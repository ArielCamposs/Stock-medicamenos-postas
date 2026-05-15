import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Historial de pedidos en supervisión (`/admin/pedidos`).
 * La página de posta solo lo muestra si `tieneAccesoGlobalAdmin` (no aplica a encargados solo posta).
 */
export function PedidoVolverMenuButton({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="/admin/pedidos"
      prefetch={false}
      className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8")}
    >
      {children}
    </Link>
  );
}
