import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import {
  esAdminGeneral,
  requirePerfilUsuario,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requirePerfilUsuario();

  if (!tieneAccesoGlobalAdmin(profile)) {
    redirect("/");
  }

  const puedeCatalogo = esAdminGeneral(profile);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3 sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium">
            <Link className="text-foreground" href="/admin">
              Supervisión
            </Link>
            <Link
              className="text-muted-foreground hover:text-foreground"
              href="/admin/pedidos"
            >
              Pedidos
            </Link>
            {puedeCatalogo ? (
              <>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  href="/admin/postas"
                >
                  Postas
                </Link>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  href="/admin/medicamentos"
                >
                  Medicamentos
                </Link>
              </>
            ) : null}
          </nav>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="max-w-[16rem] truncate sm:max-w-xs">
              {profile.email ?? profile.id}
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {profile.rol}
              </span>
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
