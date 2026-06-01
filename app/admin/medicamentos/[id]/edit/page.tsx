import { redirect } from "next/navigation";

import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";

type PageProps = { params: Promise<{ id: string }> };

/** Enlace legado: abre el listado con el modal de edición. */
export default async function AdminMedicamentoEditPage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requirePerfilUsuario();

  if (!esAdminGeneral(profile)) {
    redirect("/admin/medicamentos");
  }

  redirect(`/admin/medicamentos?editar=${encodeURIComponent(id)}`);
}
