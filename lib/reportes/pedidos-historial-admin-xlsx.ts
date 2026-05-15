import ExcelJS from "exceljs";

export type PedidoHistorialAdminXlsxFila = {
  postaNombre: string;
  postaCodigo: string | null;
  mesTitulo: string;
  estado: string;
  enviadoEtiqueta: string;
  pendienteBandeja: string;
  bandejaListo: string;
  pedidoId: string;
};

export async function buildPedidosHistorialAdminXlsxBuffer(
  filas: PedidoHistorialAdminXlsxFila[]
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Medicamentos insumos postas";
  const sheet = workbook.addWorksheet("Pedido", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const encabezados = [
    "Posta",
    "Código posta",
    "Mes",
    "Estado",
    "Enviado",
    "Pendiente bandeja",
    "Marcado listo",
    "ID pedido",
  ];

  const headerRow = sheet.addRow(encabezados);
  headerRow.font = { bold: true };
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.alignment = { vertical: "middle", wrapText: false };
  });

  for (const f of filas) {
    sheet.addRow([
      f.postaNombre,
      f.postaCodigo ?? "",
      f.mesTitulo,
      f.estado,
      f.enviadoEtiqueta,
      f.pendienteBandeja,
      f.bandejaListo,
      f.pedidoId,
    ]);
  }

  sheet.autoFilter = "A1:H1";

  const anchos = [28, 14, 18, 14, 20, 16, 14, 38];
  for (let c = 1; c <= encabezados.length; c++) {
    sheet.getColumn(c).width = anchos[c - 1] ?? 14;
  }

  const buf = await workbook.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer;
}
