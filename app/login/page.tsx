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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
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
