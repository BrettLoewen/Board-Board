import type { ContextMenuItem } from "@nuxt/ui";
import { PALETTE, type CardColor } from "@/types/cards";
import { colorLabel, isHexColor } from "@/utils/colors";

// Build the items of a colour submenu: every palette colour, then "Custom…" (which opens the colour picker).
// `swatch` gives the CSS colour to preview each option with. Items use the "swatch" slot (see CardMenu.vue).
export function colorMenuItems(options: {
  current: CardColor;
  swatch: (color: CardColor) => string;
  onPick: (color: CardColor) => void;
  onCustom: () => void;
}): ContextMenuItem[] {
  const { current, swatch, onPick, onCustom } = options;

  return [
    ...PALETTE.map((color) => ({
      label: colorLabel(color),
      type: "checkbox" as const,
      slot: "swatch",
      swatch: swatch(color),
      checked: current === color,
      onSelect: () => onPick(color),
    })),
    {
      label: "Custom…",
      type: "checkbox" as const,
      slot: "swatch",
      // Show the current custom colour, or a rainbow if a palette colour is in use
      swatch: isHexColor(current) ? current : undefined,
      checked: isHexColor(current),
      onSelect: onCustom,
    },
  ];
}
