import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { MedicamentoCategoria } from "@/lib/domain/medicamento-categoria";
import { agruparLineasPedidoPorCategoria } from "@/lib/posta/agrupar-lineas-pedido-por-categoria";

export type PedidoPdfLinea = {
  nombre: string;
  codigo_interno: string;
  unidad_medida: string;
  categoria: MedicamentoCategoria;
  stock_recomendado: number;
  disponible: number;
  cantidad_sugerida: number;
  cantidad_final: number;
};

export type PedidoPdfInput = {
  postaNombre: string;
  postaCodigo: string | null;
  anio: number;
  mes: number;
  estado: string;
  tipo?: "GENERAL" | "CONTRA_RECETA";
  enviadoEnLabel: string | null;
  lineas: PedidoPdfLinea[];
};

function esc(s: string, max: number) {
  const t = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}?`;
}

export async function buildPedidoMensualPdfBytes(input: PedidoPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pageW = 595;
  const pageH = 842;
  let page = doc.addPage([pageW, pageH]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 10;
  const sizeTitle = 14;
  let y = pageH - 48;

  const tituloMes = `${String(input.mes).padStart(2, "0")}/${input.anio}`;

  const tituloDoc =
    input.tipo === "CONTRA_RECETA"
      ? "Pedido mensual - contra receta"
      : "Pedido mensual - general";
  page.drawText(tituloDoc, {
    x: 48,
    y,
    size: sizeTitle,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.15),
  });
  y -= 26;

  page.drawText(`Posta: ${esc(input.postaNombre, 70)}`, { x: 48, y, size, font });
  y -= 14;
  if (input.postaCodigo) {
    page.drawText(`Codigo sede: ${input.postaCodigo}`, { x: 48, y, size, font });
    y -= 14;
  }
  page.drawText(`Periodo: ${tituloMes}`, { x: 48, y, size, font });
  y -= 14;
  page.drawText(`Estado: ${input.estado}`, { x: 48, y, size, font });
  y -= 14;
  if (input.enviadoEnLabel) {
    page.drawText(`Enviado: ${input.enviadoEnLabel}`, { x: 48, y, size, font });
    y -= 14;
  }
  y -= 10;

  /** X de inicio por columna (A4 ~595pt, margen 48). Más aire entre Unidad y Stock para códigos largos de unidad. */
  const colX = [48, 222, 292, 352, 412, 472];
  const headers = ["Medicamento", "Unidad", "Stock", "Disp.", "Sug.", "Pedido"];
  const rowH = 13;
  const catHeaderH = 18;
  const bottom = 56;
  const grupos = agruparLineasPedidoPorCategoria(input.lineas);

  const dibujarEncabezadosTabla = () => {
    page.drawText(headers[0], { x: colX[0], y, size: 9, font: fontBold });
    page.drawText(headers[1], { x: colX[1], y, size: 9, font: fontBold });
    page.drawText(headers[2], { x: colX[2], y, size: 9, font: fontBold });
    page.drawText(headers[3], { x: colX[3], y, size: 9, font: fontBold });
    page.drawText(headers[4], { x: colX[4], y, size: 9, font: fontBold });
    page.drawText(headers[5], { x: colX[5], y, size: 9, font: fontBold });
    y -= 14;
    page.drawLine({
      start: { x: 48, y: y + 4 },
      end: { x: pageW - 48, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.78),
    });
    y -= 6;
  };

  const nuevaPaginaConTabla = () => {
    page = doc.addPage([pageW, pageH]);
    y = pageH - 48;
    dibujarEncabezadosTabla();
  };

  const asegurarEspacio = (altura: number) => {
    if (y < bottom + altura) {
      nuevaPaginaConTabla();
    }
  };

  dibujarEncabezadosTabla();

  for (const grupo of grupos) {
    asegurarEspacio(catHeaderH + rowH);
    page.drawRectangle({
      x: 48,
      y: y - 4,
      width: pageW - 96,
      height: 14,
      color: rgb(0.93, 0.94, 0.96),
    });
    page.drawText(esc(grupo.etiqueta, 60), {
      x: 52,
      y: y - 1,
      size: 9,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.35),
    });
    page.drawText(`Subtotal: ${grupo.subtotalUnidades}`, {
      x: colX[5] - 52,
      y: y - 1,
      size: 8,
      font,
      color: rgb(0.35, 0.38, 0.45),
    });
    y -= catHeaderH;

    for (const ln of grupo.lineas) {
      asegurarEspacio(rowH);
      const label = esc(`${ln.nombre} (${ln.codigo_interno})`, 36);
      page.drawText(label, { x: colX[0], y, size: 8, font });
      page.drawText(esc(ln.unidad_medida, 14), { x: colX[1], y, size: 8, font });
      page.drawText(String(ln.stock_recomendado), { x: colX[2], y, size: 8, font });
      page.drawText(String(ln.disponible), { x: colX[3], y, size: 8, font });
      page.drawText(String(ln.cantidad_sugerida), { x: colX[4], y, size: 8, font });
      page.drawText(String(ln.cantidad_final), { x: colX[5], y, size: 8, font: fontBold });
      y -= rowH;
    }
    y -= 4;
  }

  y -= 8;
  if (y < 100) {
    page = doc.addPage([pageW, pageH]);
    y = pageH - 80;
  }
  page.drawText(
    "Cantidades según el registro del mes (disponible) y pedido confirmado por la sede.",
    { x: 48, y, size: 8, font, color: rgb(0.35, 0.35, 0.4) }
  );

  return doc.save();
}
