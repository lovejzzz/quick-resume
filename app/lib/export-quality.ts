export const EXPORT_QUALITY_LEVELS = 12;

export type ExportQuality = {
  jpegQuality: number;
  label: string;
  level: number;
  scale: number;
};

const QUALITY_LABELS = [
  "Smallest",
  "Very small",
  "Compact",
  "Efficient",
  "Standard",
  "Standard+",
  "Balanced",
  "Detailed",
  "High",
  "Very high",
  "Ultra",
  "Maximum",
] as const;

const QUALITY_SCALES = [0.75, 0.9, 1.05, 1.2, 1.4, 1.7, 2, 2.2, 2.4, 2.6, 2.8, 3] as const;
const JPEG_QUALITIES = [0.55, 0.6, 0.65, 0.7, 0.74, 0.78, 0.82, 0.86, 0.89, 0.92, 0.95, 0.98] as const;

export function getExportQuality(level: number): ExportQuality {
  const normalizedLevel = Math.max(1, Math.min(EXPORT_QUALITY_LEVELS, Math.round(level)));
  return {
    jpegQuality: JPEG_QUALITIES[normalizedLevel - 1],
    label: QUALITY_LABELS[normalizedLevel - 1],
    level: normalizedLevel,
    scale: QUALITY_SCALES[normalizedLevel - 1],
  };
}
