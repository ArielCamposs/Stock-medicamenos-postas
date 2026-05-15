import { redirect } from "next/navigation";

import {
  getSessionContext,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";

export default async function Home() {
  const ctx = await getSessionContext();

  if (!ctx.user) {
    redirect("/login");
  }

  if (!ctx.profile) {
    if ("perfilInactivo" in ctx && ctx.perfilInactivo) {
      redirect("/login?error=perfil_inactivo");
    }
    redirect("/login?error=sin_perfil");
  }

  const { rol, posta_id: postaId } = ctx.profile;

  if (tieneAccesoGlobalAdmin(ctx.profile)) {
    redirect("/admin");
  }

  if (rol === "POSTA_MANAGER") {
    if (!postaId) {
      redirect("/login?error=sin_posta");
    }

    redirect(`/postas/${postaId}/dashboard`);
  }

  redirect("/login");
}
