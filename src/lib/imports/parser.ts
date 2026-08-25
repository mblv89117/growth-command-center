export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function parseSpreadsheet(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer);
    return parseCsv(text);
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };

    const headers: string[] = [];
    const rows: string[][] = [];
    sheet.eachRow((row, rowNumber) => {
      const values = row.values as (string | number | null | undefined)[];
      const cells = values.slice(1).map((v) => String(v ?? "").trim());
      if (rowNumber === 1) {
        headers.push(...cells);
      } else if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    });
    return { headers, rows };
  }

  throw new Error("Unsupported file type. Use CSV or XLSX.");
}

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function autoMapColumns(
  headers: string[],
  targetFields: string[]
): Array<{ sourceColumn: string; targetField: string }> {
  const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));
  const mapping: Array<{ sourceColumn: string; targetField: string }> = [];

  for (const field of targetFields) {
    const match = normalized.find(
      (h) => h.norm === field || h.norm.includes(field) || field.includes(h.norm)
    );
    if (match) {
      mapping.push({ sourceColumn: match.original, targetField: field });
    }
  }
  return mapping;
}
