/** WCAG 2.1 relative luminance and contrast ratio, for the accent picker. */

function expandHex(hex: string): string | null {
  const value = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return value
      .split("")
      .map((character) => character + character)
      .join("");
  }
  if (/^[0-9a-f]{6}$/i.test(value)) return value;
  return null;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const expanded = expandHex(hex);
  if (!expanded) return null;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const channel = (value: number) => {
    const sRGB = value / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** Contrast ratio against white paper, where resume accents are always used. */
export function contrastOnWhite(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const luminance = relativeLuminance(rgb);
  return Math.round(((1.05) / (luminance + 0.05)) * 100) / 100;
}

export type ContrastVerdict = {
  ratio: number;
  level: "pass" | "large-only" | "fail";
  message: string;
};

export function judgeAccent(hex: string): ContrastVerdict | null {
  const ratio = contrastOnWhite(hex);
  if (ratio === null) return null;
  if (ratio >= 4.5) {
    return { ratio, level: "pass", message: `Contrast ${ratio}:1 — readable at any size.` };
  }
  if (ratio >= 3) {
    return {
      ratio,
      level: "large-only",
      message: `Contrast ${ratio}:1 — fine for headings, too light for body text.`,
    };
  }
  return {
    ratio,
    level: "fail",
    message: `Contrast ${ratio}:1 — too light to read reliably on white, and it may vanish when printed.`,
  };
}
