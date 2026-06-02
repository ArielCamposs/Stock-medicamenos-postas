import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { LoginForm } from "@/components/auth/login-form";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="flex min-h-dvh w-full flex-1 flex-col overflow-x-hidden lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* Panel izquierdo ~60%: imagen DESAM */}
      <aside
        className="relative hidden shrink-0 lg:fixed lg:inset-y-0 lg:left-0 lg:z-0 lg:block lg:h-dvh lg:w-[60%]"
        aria-hidden
      >
        <Image
          src="/DESAM.jpeg"
          alt=""
          fill
          priority
          sizes="60vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black/25 to-transparent" />
      </aside>

      {/* Móvil: franja superior con la imagen DESAM */}
      <div className="relative aspect-[16/9] max-h-44 w-full shrink-0 sm:max-h-48 lg:hidden">
        <Image
          src="/DESAM.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>

      {/* Panel derecho ~40%, invade un poco el izquierdo en desktop */}
      <main
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-background",
          "px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:gap-8 sm:px-6 sm:py-10",
          "lg:ml-[calc(60%-3.5rem)] lg:min-h-dvh lg:w-[calc(40%+3.5rem)] lg:max-w-xl lg:justify-center lg:gap-8 lg:overflow-visible",
          "lg:rounded-l-3xl lg:border lg:border-border/60 lg:px-10 lg:py-14 lg:shadow-2xl"
        )}
      >
        <div className="mx-auto flex w-full min-w-0 max-w-md flex-col items-center gap-2 text-center lg:items-stretch lg:text-left">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Postas DESAM
          </h1>
          <p className="text-sm text-muted-foreground">
            Inventario de medicamentos e insumos por posta rural
          </p>
        </div>

        <LoginForm redirectTo={redirectTo} errorCodigo={errorCodigoForm} />

        {necesitaCerrarSesion ? (
          <SignOutButton
            label="Cerrar sesión e intentar con otra cuenta"
            description="Cerrarás la sesión actual para poder ingresar con otra cuenta."
            fullWidth
            wrapperClassName="mx-auto w-full min-w-0 max-w-md"
          />
        ) : null}

        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mx-auto text-muted-foreground lg:mx-0"
          )}
        />
      </main>
    </div>
  );
}
