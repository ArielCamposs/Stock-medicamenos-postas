"use client";

import {
  Archive,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  Lock,
  PackagePlus,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS: {
  segment: string;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  description: string;
}[] = [
  {
    segment: "dashboard",
    label: "Inicio",
    shortLabel: "Inicio",
    Icon: LayoutDashboard,
    description: "Resumen de stock",
  },
  {
    segment: "descuento",
    label: "Descuento diario",
    shortLabel: "Descuento",
    Icon: CalendarCheck,
    description: "Registrar descuento del día",
  },
  {
    segment: "ingresos",
    label: "Ingreso de medicamentos",
    shortLabel: "Ingresos",
    Icon: PackagePlus,
    description: "Registrar nuevos ingresos",
  },
  {
    segment: "avis",
    label: "Conteo AVIS",
    shortLabel: "AVIS",
    Icon: Archive,
    description: "Declarar stock físico",
  },
  {
    segment: "pedidos",
    label: "Pedido mensual",
    shortLabel: "Pedido",
    Icon: ClipboardList,
    description: "Solicitud de reposición",
  },
  {
    segment: "insumos",
    label: "Insumos",
    shortLabel: "Insumos",
    Icon: ShoppingCart,
    description: "Stock y pedido de insumos",
  },
  {
    segment: "cierre",
    label: "Cierre del mes",
    shortLabel: "Cierre",
    Icon: Lock,
    description: "Cerrar el período",
  },
];

function segmentActivo(pathname: string, base: string, segment: string) {
  const href = `${base}/${segment}`;
  return segment === "dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  shortLabel,
  Icon,
  description,
  active,
  variant,
}: {
  href: string;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  description: string;
  active: boolean;
  variant: "horizontal" | "bottom";
}) {
  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-label={label}
        title={description}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-medium leading-none transition-colors",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon
          className={cn("size-5 shrink-0", active ? "text-primary" : "opacity-60")}
          aria-hidden
        />
        <span className="max-w-[3.25rem] truncate">{shortLabel}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      title={description}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150",
        active
          ? "border-2 border-primary/55 bg-primary/15 font-semibold text-primary shadow-sm"
          : "border-2 border-transparent font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", active ? "text-primary" : "opacity-55")}
        aria-hidden
      />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

/** Subnav horizontal — va dentro del header (tablet/escritorio). */
export function PostaSubnav({ postaId }: { postaId: string }) {
  const pathname = usePathname();
  const base = `/postas/${postaId}`;

  return (
    <nav
      className="scroll-subnav scrollbar-thin -mx-1 hidden gap-0.5 overflow-x-auto pb-0.5 pt-1 md:flex"
      aria-label="Secciones de la posta"
    >
      {LINKS.map(({ segment, label, shortLabel, Icon, description }) => {
        const href = `${base}/${segment}`;
        const active = segmentActivo(pathname, base, segment);
        return (
          <NavLink
            key={segment}
            href={href}
            label={label}
            shortLabel={shortLabel}
            Icon={Icon}
            description={description}
            active={active}
            variant="horizontal"
          />
        );
      })}
    </nav>
  );
}

/**
 * Barra inferior móvil — debe renderizarse fuera del header (backdrop-blur rompe position:fixed).
 */
export function PostaBottomNav({ postaId }: { postaId: string }) {
  const pathname = usePathname();
  const base = `/postas/${postaId}`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navegación principal de la posta"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {LINKS.map(({ segment, label, shortLabel, Icon, description }) => {
          const href = `${base}/${segment}`;
          const active = segmentActivo(pathname, base, segment);
          return (
            <NavLink
              key={segment}
              href={href}
              label={label}
              shortLabel={shortLabel}
              Icon={Icon}
              description={description}
              active={active}
              variant="bottom"
            />
          );
        })}
      </div>
    </nav>
  );
}
