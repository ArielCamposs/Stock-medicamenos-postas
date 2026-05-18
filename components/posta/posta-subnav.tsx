"use client";

import {
  ClipboardList,
  LayoutDashboard,
  Lock,
  PackagePlus,
  Pill,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS: { segment: string; label: string; Icon: LucideIcon }[] = [
  { segment: "dashboard", label: "Inicio", Icon: LayoutDashboard },
  { segment: "descuento", label: "Descuento", Icon: Pill },
  { segment: "ingresos", label: "Ingresos", Icon: PackagePlus },
  { segment: "avis", label: "Stock AVIS", Icon: Warehouse },
  { segment: "pedidos", label: "Pedidos", Icon: ClipboardList },
  { segment: "cierre", label: "Cierre", Icon: Lock },
];

export function PostaSubnav({ postaId }: { postaId: string }) {
  const pathname = usePathname();
  const base = `/postas/${postaId}`;

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto pb-0.5 pt-1 scrollbar-thin"
      aria-label="Secciones de la posta"
    >
      {LINKS.map(({ segment, label, Icon }) => {
        const href = `${base}/${segment}`;
        const active =
          segment === "dashboard"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={segment}
            href={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
