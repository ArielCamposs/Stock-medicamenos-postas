import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth/login-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  getSessionContext,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

function siguienteRutaSegura(raw: string | undefined) {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

type PageProps = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const qs = await searchParams;
  const redirectTo = siguienteRutaSegura(qs?.next);

  const ctx = await getSessionContext();

  if (ctx.user && ctx.profile) {
    const p = ctx.profile;
    const perfilBloqueado =
      (p.rol === "POSTA_MANAGER" && !p.posta_id) ||
      (p.rol === "ADMIN_GENERAL" && p.posta_id !== null);

    if (!perfilBloqueado) {
      if (redirectTo !== "/") {
        redirect(redirectTo);
      }
      if (tieneAccesoGlobalAdmin(p)) {
        redirect("/admin");
      }
      if (p.rol === "POSTA_MANAGER" && p.posta_id) {
        redirect(`/postas/${p.posta_id}/dashboard`);
      }
      redirect("/");
    }
  }

  let errorCodigoForm = qs?.error;
  if (ctx.user && ctx.profile) {
    const p = ctx.profile;
    if (p.rol === "POSTA_MANAGER" && !p.posta_id) {
      errorCodigoForm = "sin_posta";
    }
    if (p.rol === "ADMIN_GENERAL" && p.posta_id !== null) {
      errorCodigoForm = "perfil_inconsistente";
    }
  }

  const necesitaCerrarSesion =
    errorCodigoForm === "sin_perfil" ||
    errorCodigoForm === "sin_posta" ||
    errorCodigoForm === "perfil_inconsistente" ||
    errorCodigoForm === "perfil_inactivo";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <svg
            viewBox="0 0 24 24"
            className="size-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Postas DESAM
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inventario de medicamentos e insumos por posta rural
          </p>
        </div>
      </div>
      <LoginForm redirectTo={redirectTo} errorCodigo={errorCodigoForm} />

      {necesitaCerrarSesion ? (
        <form action={signOutAction} className="w-full max-w-md">
          <Button type="submit" variant="outline" className="w-full">
            Cerrar sesión e intentar con otra cuenta
          </Button>
        </form>
      ) : null}

      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "text-muted-foreground"
        )}
      >
      </Link>
    </div>
  );
}
