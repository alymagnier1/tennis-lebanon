/**
 * WCAG relative luminance and contrast ratio for the mobile palettes.
 *
 * This exists because nothing in the repo could assert a colour pair. A
 * scheme-independent hero token (`heroOnLight`, #0D1C14) was used as body ink
 * and as the secondary-button label; in dark mode that is 1.05:1 on the card,
 * and it shipped. The failure mode is silent — the app renders, the text is
 * just not there — so only a test catches it.
 *
 * Hex only. The tokens this guards are all hex, and quietly accepting an
 * `rgba()` string would drop the alpha and report a contrast the user never
 * sees, which is worse than refusing to measure it.
 */

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) {
    throw new Error(
      `contrast: expected a 3- or 6-digit hex colour, received "${hex}"`,
    );
  }
  const body = hex.slice(1);
  const full =
    body.length === 3
      ? body
          .split("")
          .map((c) => c + c)
          .join("")
      : body;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG 2.1 relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex);
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2.1 contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** AA floor for body text. */
export const AA_TEXT = 4.5;

/**
 * AA floor for large text (>=18.66px bold or >=24px regular) and for UI
 * component boundaries. Deliberately not used on button labels: the primary
 * label is 16px bold, which is not "large" by WCAG.
 */
export const AA_LARGE = 3;
