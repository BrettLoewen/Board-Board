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

// The CSS colour for a card's background
export function cardBackground(color: CardColor): string {
  return isHexColor(color) ? color : `var(--card-${color})`;
}

// The CSS colour for text on a card.
// "auto" text picks a readable colour for the card's background. Other palette colours use a stronger shade
// of that colour, so they stay readable on the light (or, in dark mode, dark) note colours.
export function cardText(textColor: CardColor, background: CardColor): string {
  if (isHexColor(textColor)) return textColor;
  if (textColor !== "auto") return `var(--card-text-${textColor})`;
  return isHexColor(background) ? contrastingText(background) : `var(--card-${background}-text)`;
}

// The colour's name for menus ("yellow" → "Yellow", a hex colour → "Custom")
export function colorLabel(color: CardColor): string {
  if (isHexColor(color)) return "Custom";
  return color.charAt(0).toUpperCase() + color.slice(1);
}
