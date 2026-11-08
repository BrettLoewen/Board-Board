import type { ContextMenuItem } from "@nuxt/ui";

// A kind of size that can be picked from a menu (text size, line thickness)
export type SizeOptions = {
  // The sizes offered as menu items
  presets: readonly number[];
  // The range a typed size is kept inside
  range: { min: number; max: number };
  // Shown beside the typed size field, and what screen readers call the field
  label: string;
  name: string;
};

// The fields the "size-field" slot in CardMenu.vue reads from its item
export type SizeFieldItem = SizeOptions & { size: number; onPick: (size: number) => void };

// Whether a value is a number inside a range
export function isSizeInRange(
  value: unknown,
  range: { min: number; max: number },
): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= range.min && value <= range.max
  );
}

// Build the items of a size submenu: a field to type any size (see SizeField.vue, through the
// "size-field" slot in CardMenu.vue), then the preset sizes
export function sizeMenuItems(
  options: SizeOptions & { current: number; onPick: (size: number) => void },
): ContextMenuItem[] {
  const { current, onPick, ...size } = options;
  const field: SizeFieldItem = { ...size, size: current, onPick };

  return [
    { type: "label" as const, slot: "size-field", ...field },
    { type: "separator" as const },
    ...size.presets.map((preset) => ({
      label: `${preset}`,
      type: "checkbox" as const,
      checked: current === preset,
      onSelect: () => onPick(preset),
    })),
  ];
}
