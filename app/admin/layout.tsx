import { redirect } from "next/navigation";

import { DesamLogo } from "@/components/brand/desam-logo";
import { AdminSubnav } from "@/components/admin/admin-subnav";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import {
  esAdminGeneral,
  requirePerfilUsuario,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";

function etiquetaRol(rol: string): string {
  const r = rol.toLowerCase();
  const mapa: Record<string, string> = {
    encargado_posta: "Encargada/o de Postas",
    posta_manager: "Encargada/o de Postas",
    admin_general: "Administradora Postas",
    supervision_posta: "Supervisión",
    read_only: "Supervisión",
  };
  return mapa[r] ?? rol.replaceAll("_", " ");
}

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
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <DesamLogo variant="header-sm" />
              </div>
              <p className="text-sm font-bold text-primary tracking-tight">Administración desam</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[11px] uppercase border border-primary/15 shadow-sm">
                  {(profile.email ?? profile.id).slice(0, 2)}
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="font-semibold text-foreground max-w-[14rem] truncate">
                    {profile.email ?? profile.id}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">{etiquetaRol(profile.rol)}</p>
                </div>
                <span className="sm:hidden rounded-full bg-primary/10 border border-primary/15 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold text-primary">
                  {etiquetaRol(profile.rol)}
                </span>
              </div>
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:border-rose-950 dark:text-rose-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 transition-colors"
                >
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </div>
          <AdminSubnav puedeCatalogo={puedeCatalogo} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
