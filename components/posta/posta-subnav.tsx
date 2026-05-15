"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS: { segment: string; label: string }[] = [
  { segment: "dashboard", label: "Stock" },
  { segment: "descuento", label: "Descuento" },
  { segment: "ingresos", label: "Ingresos" },
  { segment: "avis", label: "Stock AVIS" },
  { segment: "pedidos", label: "Pedidos" },
  { segment: "cierre", label: "Cierre" },
];

export function PostaSubnav({ postaId }: { postaId: string }) {
  const pathname = usePathname();
  const base = `/postas/${postaId}`;

  return (
    <nav
      className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border/60 pt-3 text-sm font-medium"
      aria-label="Secciones de la posta"
    >
      {LINKS.map(({ segment, label }) => {
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
              "rounded-md px-1 py-0.5 transition-colors",
              active
                ? "text-foreground underline decoration-foreground/30 underline-offset-4"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
