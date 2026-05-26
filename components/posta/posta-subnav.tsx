"use client";

import {
  Archive,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  Lock,
  PackagePlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS: { segment: string; label: string; Icon: LucideIcon; description: string }[] = [
  { segment: "dashboard", label: "Inicio", Icon: LayoutDashboard, description: "Resumen de stock" },
  { segment: "descuento", label: "Descuento diario", Icon: CalendarCheck, description: "Registrar descuento del día" },
  { segment: "ingresos", label: "Ingreso de medicamentos", Icon: PackagePlus, description: "Registrar nuevos ingresos" },
  { segment: "avis", label: "Conteo AVIS", Icon: Archive, description: "Declarar stock físico" },
  { segment: "pedidos", label: "Pedido mensual", Icon: ClipboardList, description: "Solicitud de reposición" },
  { segment: "cierre", label: "Cierre del mes", Icon: Lock, description: "Cerrar el período" },
];

export function PostaSubnav({ postaId }: { postaId: string }) {
  const pathname = usePathname();
  const base = `/postas/${postaId}`;

  return (
    <nav
      className="-mx-1 flex gap-0.5 overflow-x-auto pb-0.5 pt-1 scrollbar-thin"
      aria-label="Secciones de la posta"
    >
      {LINKS.map(({ segment, label, Icon, description }) => {
        const href = `${base}/${segment}`;
        const active =
          segment === "dashboard"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={segment}
            href={href}
            title={description}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150",
              active
                ? "bg-primary/15 text-primary border-2 border-primary/55 shadow-sm font-semibold"
                : "font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground border-2 border-transparent"
            )}
          >
            <Icon
              className={cn("size-4 shrink-0", active ? "text-primary" : "opacity-55")}
              aria-hidden
            />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
