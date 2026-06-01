import ExcelJS from "exceljs";

export type IngresoLoteXlsxLinea = {
  medNombre: string;
  medCodigo: string;
  unidadMedida: string;
  cantidad: number;
  anulado: boolean;
};

export type IngresoLoteXlsxPayload = {
  postaNombre: string;
  postaCodigo: string | null;
  loteId: string;
  fechaIngreso: string;
  registradoEn: string;
  observacion: string | null;
  lineas: IngresoLoteXlsxLinea[];
};

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

export async function buildIngresoLoteXlsxBuffer(
  payload: IngresoLoteXlsxPayload
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Medicamentos insumos postas";
  const sheet = workbook.addWorksheet("Ingreso", {
    views: [{ state: "frozen", ySplit: 8 }],
  });

  sheet.addRow(["Ingreso de stock"]);
  sheet.getCell("A1").font = { bold: true, size: 14 };

  const meta: [string, string][] = [
    ["Posta", payload.postaNombre],
    ["Código posta", payload.postaCodigo ?? "—"],
    ["Fecha ingreso", payload.fechaIngreso],
    ["Registrado", payload.registradoEn],
    ["Observación", payload.observacion ?? "—"],
    ["ID ingreso", payload.loteId],
  ];

  for (const [k, v] of meta) {
    const row = sheet.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  }

  sheet.addRow([]);

  const encabezados = ["Medicamento", "Código", "Unidad", "Cantidad", "Estado"];
  const headerRow = sheet.addRow(encabezados);
  estiloEncabezado(headerRow);

  const activas = payload.lineas.filter((l) => !l.anulado);
  const totalUnidades = activas.reduce((acc, l) => acc + l.cantidad, 0);

  for (const l of payload.lineas) {
    sheet.addRow([
      l.medNombre,
      l.medCodigo,
      l.unidadMedida,
      l.cantidad,
      l.anulado ? "Anulado" : "Activo",
    ]);
  }

  sheet.addRow([]);
  const totRow = sheet.addRow([
    "Total (líneas activas)",
    "",
    "",
    totalUnidades,
    `${activas.length} medicamento(s)`,
  ]);
  totRow.font = { bold: true };

  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 12;

  const buf = await workbook.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
}
