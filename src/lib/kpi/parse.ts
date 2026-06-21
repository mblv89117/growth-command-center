/** Parse KPI numeric input from text (supports commas, spaces, optional $ prefix). */
export function parseKpiNumericInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
