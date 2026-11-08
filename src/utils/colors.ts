import { PALETTE, type CardColor, type HexColor, type PaletteColor } from "@/types/cards";

// Whether a value is a "#rrggbb" hex colour
export function isHexColor(value: unknown): value is HexColor {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

// Whether a value is a valid card colour (a palette name or a hex colour)
export function isCardColor(value: unknown): value is CardColor {
  return PALETTE.includes(value as PaletteColor) || isHexColor(value);
}

// Turn a typed hex code into "#rrggbb" form ("abc" → "#aabbcc", "#ABCDEF" → "#abcdef"), or null if it isn't one
export function normalizeHex(value: string): HexColor | null {
  let hex = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.replace(/./g, (c) => c + c);
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

// Pick black or white text, whichever is easier to read on the given hex colour
function contrastingText(hex: HexColor): string {
  // Relative luminance (WCAG), from the sRGB channels
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);

  // Compare the contrast ratio against black and against white
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}

// The palette's colours. One set for both colour modes: each is strong enough to read as a thin line on both the
// light and the dark board, and the same name means the same colour for a note, a shape, a line or text.
// "auto" is the one colour that follows the viewer's colour mode (see main.css).
export const PALETTE_COLORS: Record<Exclude<PaletteColor, "auto">, HexColor> = {
  yellow: "#facc15",
  orange: "#f97316",
  red: "#b91c1c",
  pink: "#ec4899",
  purple: "#7e22ce",
  blue: "#1d4ed8",
  green: "#15803d",
  gray: "#6b7280",
};

// A colour as a hex code, or null for "auto" (which has no fixed colour)
function toHex(color: CardColor): HexColor | null {
  if (isHexColor(color)) return color;
  return color === "auto" ? null : PALETTE_COLORS[color];
}

// The CSS colour for a card's background
export function cardBackground(color: CardColor): string {
  return toHex(color) ?? "var(--card-auto)";
}

// The CSS colour for text on a card. "auto" text is black or white, whichever reads better on the card's colour
// (or the colour mode's text colour on an "auto" card). Any other text colour is used as it is.
export function cardText(textColor: CardColor, background: CardColor): string {
  if (textColor !== "auto") return toHex(textColor) ?? "var(--card-auto-text)";
  const backgroundHex = toHex(background);
  return backgroundHex ? contrastingText(backgroundHex) : "var(--card-auto-text)";
}

// The CSS colour for a drawn line: the colour itself, or the colour mode's text colour for "auto"
export function strokeColor(color: CardColor): string {
  return toHex(color) ?? "var(--card-auto-text)";
}

// The colour's name for menus ("yellow" → "Yellow", a hex colour → "Custom")
export function colorLabel(color: CardColor): string {
  if (isHexColor(color)) return "Custom";
  return color.charAt(0).toUpperCase() + color.slice(1);
}
