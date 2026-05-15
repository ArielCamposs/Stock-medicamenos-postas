import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ ym?: string }>;
};

/** Ruta histórica: el registro diario vive ahora en «Descuento». */
export default async function PostaConsumoLegacyRedirect({
  params,
  searchParams,
}: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const ym = typeof qs?.ym === "string" && /^\d{4}-\d{2}$/.test(qs.ym.trim())
    ? `?ym=${encodeURIComponent(qs.ym.trim())}`
    : "";
  redirect(`/postas/${postaId}/descuento${ym}`);
}
