import ExcelJS from "exceljs";

/** Fondos suaves distintos por posta (ARGB con canal FF) para leer filas sin perderse al cruzar columnas. */
export const POSTA_ROW_FILLS_ARGB = [
  "FFFFF3E0",
  "FFE3F2FD",
  "FFF3E5F5",
  "FFE8F5E9",
  "FFFFFDE7",
  "FFFCE4EC",
  "FFE0F2F1",
  "FFF9FBE7",
  "FFEDE7F6",
  "FFFFEBEE",
  "FFE1F5FE",
  "FFFFF8E1",
] as const;

function excelColumnLetter(columnIndex1Based: number): string {
  let n = columnIndex1Based;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export type StockMensualXlsxFila = {
  /** Color de fondo de toda la fila (misma posta = mismo color). */
  fillArgb: string;
  cells: (string | number)[];
};

export async function buildStockMensualXlsxBuffer(
  encabezados: string[],
  filas: StockMensualXlsxFila[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Medicamentos insumos postas";
  const sheet = workbook.addWorksheet("Stock mensual", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

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

  for (const fila of filas) {
    const row = sheet.addRow(fila.cells);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fila.fillArgb },
      };
      cell.alignment = { vertical: "middle", wrapText: false };
    });
  }

  const anchos = [
    6, 28, 12, 10, 8, 14, 20, 38, 12, 14, 14, 14, 18, 14, 16, 20, 16, 22, 22,
  ];
  for (let c = 1; c <= encabezados.length; c++) {
    sheet.getColumn(c).width = anchos[c - 1] ?? 14;
  }

  const lastCol = excelColumnLetter(encabezados.length);
  sheet.autoFilter = `A1:${lastCol}1`;

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
