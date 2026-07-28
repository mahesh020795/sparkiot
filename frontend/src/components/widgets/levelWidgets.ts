export type LevelStatus = "no_data" | "safe" | "warning" | "danger";

export function numericWidgetValue(value: unknown): number | null {
  const raw = typeof value === "object" && value !== null && "raw" in value ? (value as { raw: unknown }).raw : value;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

export function levelPercent(value: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  if (max <= min) return 0;
  const percent = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function levelStatus(value: number | null, warningThreshold?: number, dangerThreshold?: number): LevelStatus {
  if (value === null) return "no_data";
  if (typeof dangerThreshold === "number" && value >= dangerThreshold) return "danger";
  if (typeof warningThreshold === "number" && value >= warningThreshold) return "warning";
  return "safe";
}

export function levelStatusLabel(status: LevelStatus): string {
  if (status === "danger") return "Danger";
  if (status === "warning") return "Warning";
  if (status === "safe") return "Normal";
  return "No data";
}
