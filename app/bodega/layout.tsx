import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { DesamLogo } from "@/components/brand/desam-logo";
import { etiquetaRolUsuario } from "@/lib/auth/etiqueta-rol";
import {
  esBodegaFarmacia,
  perfilBodegaConsistente,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export default async function BodegaLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePerfilUsuario();

  if (!esBodegaFarmacia(profile) || !perfilBodegaConsistente(profile)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <DesamLogo variant="header-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary tracking-tight">Bodega farmacia</p>
              <p className="text-[10px] text-muted-foreground">Despacho a postas</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline max-w-[12rem] truncate">
              {profile.email ?? profile.nombre ?? profile.id}
            </span>
            <span
              className={cn(
                "rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5",
                "text-[10px] font-semibold uppercase tracking-wide text-primary"
              )}
            >
              {etiquetaRolUsuario(profile.rol)}
            </span>
            <SignOutButton
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-950 dark:text-rose-400"
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
