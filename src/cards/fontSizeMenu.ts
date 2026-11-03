import type { ContextMenuItem } from "@nuxt/ui";

// The text sizes offered in the menu (in world units, so text scales with the zoom like everything else)
export const FONT_SIZES = [12, 14, 16, 20, 24, 32, 48, 64] as const;

// The range a typed text size is kept inside
export const FONT_SIZE_RANGE = { min: 6, max: 200 } as const;

// Whether a value is a usable text size
export function isFontSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= FONT_SIZE_RANGE.min &&
    value <= FONT_SIZE_RANGE.max
  );
}

// Build the items of a text size submenu: a field to type any size (see FontSizeField.vue, through the
// "font-size" slot in CardMenu.vue), then the preset sizes
export function fontSizeMenuItems(options: {
  current: number;
  onPick: (fontSize: number) => void;
}): ContextMenuItem[] {
  const { current, onPick } = options;

  return [
    { type: "label" as const, slot: "font-size", fontSize: current, onPick },
    { type: "separator" as const },
    ...FONT_SIZES.map((size) => ({
      label: `${size}`,
      type: "checkbox" as const,
      checked: current === size,
      onSelect: () => onPick(size),
    })),
  ];
}
