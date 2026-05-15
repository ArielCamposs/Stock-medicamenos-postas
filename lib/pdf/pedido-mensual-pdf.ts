import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PedidoPdfLinea = {
  nombre: string;
  codigo_interno: string;
  unidad_medida: string;
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

  page.drawText("Pedido mensual - medicamentos", {
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
  page.drawText(headers[0], { x: colX[0], y, size: 9, font: fontBold });
  page.drawText(headers[1], { x: colX[1], y, size: 9, font: fontBold });
  page.drawText(headers[2], { x: colX[2], y, size: 9, font: fontBold });
  page.drawText(headers[3], { x: colX[3], y, size: 9, font: fontBold });
  page.drawText(headers[4], { x: colX[4], y, size: 9, font: fontBold });
  page.drawText(headers[5], { x: colX[5], y, size: 9, font: fontBold });
  y -= 14;
  page.drawLine({ start: { x: 48, y: y + 4 }, end: { x: pageW - 48, y: y + 4 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.78) });
  y -= 6;

  const rowH = 13;
  const bottom = 56;

  for (const ln of input.lineas) {
    if (y < bottom) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - 48;
    }
    const label = esc(`${ln.nombre} (${ln.codigo_interno})`, 36);
    page.drawText(label, { x: colX[0], y, size: 8, font });
    page.drawText(esc(ln.unidad_medida, 14), { x: colX[1], y, size: 8, font });
    page.drawText(String(ln.stock_recomendado), { x: colX[2], y, size: 8, font });
    page.drawText(String(ln.disponible), { x: colX[3], y, size: 8, font });
    page.drawText(String(ln.cantidad_sugerida), { x: colX[4], y, size: 8, font });
    page.drawText(String(ln.cantidad_final), { x: colX[5], y, size: 8, font: fontBold });
    y -= rowH;
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
