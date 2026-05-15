import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { PostaSubnav } from "@/components/posta/posta-subnav";
import { Button } from "@/components/ui/button";
import {
  esAdminGeneral,
  esSoloSupervisionPosta,
  puedeVerPosta,
  requirePerfilUsuario,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ postaId: string }>;
};

export default async function PostaLayout({ children, params }: Props) {
  const { postaId } = await params;
  const { profile } = await requirePerfilUsuario();

  if (!puedeVerPosta(profile, postaId)) {
    redirect("/");
  }

  let tituloPosta = `Posta ${postaId.slice(0, 8)}…`;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("postas")
    .select("nombre")
    .eq("id", postaId)
    .maybeSingle();

  if (data && typeof data === "object" && "nombre" in data && data.nombre) {
    tituloPosta = String(data.nombre);
  }

  const supervision = esSoloSupervisionPosta(profile);
  const adminEnPosta = esAdminGeneral(profile);
  const enlaceAdmin = tieneAccesoGlobalAdmin(profile);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 sm:justify-between">
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium">
              <Link className="text-foreground" href={`/postas/${postaId}/dashboard`}>
                {tituloPosta}
              </Link>
              {enlaceAdmin ? (
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  href="/admin"
                >
                  Panel supervisión
                </Link>
              ) : null}
            </nav>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="max-w-[16rem] truncate sm:max-w-xs">
                {profile.email ?? profile.id}
                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {profile.rol.replaceAll("_", " ")}
                </span>
              </span>
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </div>
          <PostaSubnav postaId={postaId} />
        </div>
      </header>

      {supervision ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10">
          <div className="mx-auto max-w-7xl px-4 py-2 text-xs text-amber-950 dark:text-amber-100">
            <strong className="font-medium">Solo lectura.</strong> El encargado registra
            en cada sección de su posta.{" "}
            <Link className="underline underline-offset-2" href="/admin">
              Ir al panel de supervisión
            </Link>
            .
          </div>
        </div>
      ) : adminEnPosta ? (
        <div className="border-b border-sky-500/25 bg-sky-500/10">
          <div className="mx-auto max-w-7xl px-4 py-2 text-xs text-sky-950 dark:text-sky-100">
            <strong className="font-medium">Administración general.</strong> Puede cargar
            ingresos de medicamentos y declarar stock AVIS en esta posta. Los descuentos
            diarios solo los registra el encargado.
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
