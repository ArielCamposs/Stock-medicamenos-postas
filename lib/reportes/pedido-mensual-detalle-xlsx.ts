import ExcelJS from "exceljs";

import { etiquetaPedidoEstado } from "@/lib/domain/pedido-estado-ui";
import { agruparLineasPedidoPorCategoria } from "@/lib/posta/agrupar-lineas-pedido-por-categoria";
import type { PedidoMensualDetallePayload } from "@/lib/posta/pedido-mensual-detalle";

function estiloEncabezado(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.alignment = { vertical: "middle", wrapText: false };
  });
}

function estiloFilaCategoria(row: ExcelJS.Row, numCols: number) {
  row.font = { bold: true, size: 11 };
  row.height = 20;
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD6E4F0" },
    };
    cell.alignment = { vertical: "middle" };
  }
  row.getCell(1).alignment = { vertical: "middle" };
}

export async function buildPedidoMensualDetalleXlsxBuffer(
  detalle: PedidoMensualDetallePayload
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Medicamentos insumos postas";

  const etiquetaTipo =
    detalle.tipo === "CONTRA_RECETA" ? "Pedido contra receta" : "Pedido general";
  const tituloMes = `${String(detalle.mes).padStart(2, "0")}/${detalle.anio}`;

  const sheet = workbook.addWorksheet("Pedido", {
    views: [{ state: "frozen", ySplit: 9 }],
  });

  const numCols = 5;

  sheet.addRow([etiquetaTipo]);
  sheet.getCell("A1").font = { bold: true, size: 14 };

  const meta: [string, string][] = [
    ["Posta", detalle.postaNombre],
    ["Código posta", detalle.postaCodigo ?? "—"],
    ["Periodo", tituloMes],
    ["Estado", etiquetaPedidoEstado(detalle.estado)],
    ["ID pedido", detalle.pedidoId],
    ["Total unidades", String(detalle.totalUnidades)],
    ["Medicamentos con pedido", String(detalle.nMedicamentos)],
  ];
  for (const [k, v] of meta) {
    sheet.addRow([k, v]);
  }
  sheet.addRow([]);

  const encabezados = [
    "Medicamento",
    "Código interno",
    "Unidad",
    "Cantidad sugerida",
    "Cantidad pedida",
  ];
  const headerRow = sheet.addRow(encabezados);
  estiloEncabezado(headerRow);

  const grupos = agruparLineasPedidoPorCategoria(detalle.lineas);

  for (const grupo of grupos) {
    const catRow = sheet.addRow([
      grupo.etiqueta,
      "",
      "",
      "Subtotal categoría",
      grupo.subtotalUnidades,
    ]);
    estiloFilaCategoria(catRow, numCols);
    sheet.mergeCells(catRow.number, 1, catRow.number, 3);

    for (const l of grupo.lineas) {
      sheet.addRow([
        l.nombre,
        l.codigo_interno,
        l.unidad_medida,
        l.cantidad_sugerida,
        l.cantidad_final,
      ]);
    }
    sheet.addRow([]);
  }

  if (detalle.lineas.length > 0) {
    const totalRow = sheet.addRow(["", "", "Total pedido:", "", detalle.totalUnidades]);
    totalRow.font = { bold: true };
    totalRow.getCell(3).alignment = { horizontal: "right" };
  }

  const anchos = [32, 16, 12, 16, 14];
  for (let c = 1; c <= encabezados.length; c++) {
    sheet.getColumn(c).width = anchos[c - 1] ?? 14;
  }

  const buf = await workbook.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
}
