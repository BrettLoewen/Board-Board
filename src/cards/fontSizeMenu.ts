import type { ContextMenuItem } from "@nuxt/ui";
import { isSizeInRange, sizeMenuItems, type SizeOptions } from "./sizeMenu";

// The text sizes offered in the menu (in world units, so text scales with the zoom like everything else),
// and the range a typed text size is kept inside
export const FONT_SIZE: SizeOptions = {
  presets: [12, 14, 16, 20, 24, 32, 48, 64],
  range: { min: 6, max: 200 },
  label: "Size",
  name: "Text size",
};

// Whether a value is a usable text size
export function isFontSize(value: unknown): value is number {
  return isSizeInRange(value, FONT_SIZE.range);
}

// Build the items of a text size submenu: a field to type any size, then the preset sizes
export function fontSizeMenuItems(options: {
  current: number;
  onPick: (fontSize: number) => void;
}): ContextMenuItem[] {
  return sizeMenuItems({ ...FONT_SIZE, ...options });
}
