"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type LinkDef = { href: string; label: string; exact?: boolean };

export function AdminSubnav({ puedeCatalogo }: { puedeCatalogo: boolean }) {
  const pathname = usePathname();

  const links: LinkDef[] = [
    { href: "/admin", label: "Supervisión", exact: true },
    { href: "/admin/pedidos", label: "Pedidos" },
    { href: "/admin/pedidos-insumos", label: "Ped. insumos" },
    { href: "/admin/comparativas", label: "Comparativas" },
  ];
  if (puedeCatalogo) {
    links.push(
      { href: "/admin/postas", label: "Postas" },
      { href: "/admin/medicamentos", label: "Medicamentos" },
      { href: "/admin/insumos", label: "Insumos" }
    );
  }

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto pb-0.5 pt-1 scrollbar-thin"
      aria-label="Secciones de administración"
    >
      {links.map(({ href, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
