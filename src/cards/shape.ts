import type { ContextMenuItem } from "@nuxt/ui";
import type { Json } from "@/types/database.types";
import type { ShapeContent, ShapeDefaults, ShapeKind } from "@/types/cards";
import type { Card, BoardStore } from "@/stores/board";
import { cardBackground, isCardColor } from "@/utils/colors";
import { colorMenuItems } from "./colorMenu";
import { asObject } from "./content";

// The shapes a shape card can be, in menu order
export const SHAPE_KINDS: { value: ShapeKind; label: string; icon: string }[] = [
  { value: "square", label: "Square", icon: "i-ph-square" },
  { value: "triangle", label: "Triangle", icon: "i-ph-triangle" },
  { value: "circle", label: "Circle", icon: "i-ph-circle" },
];

// The options a shape starts with before the user has picked any
export const SHAPE_DEFAULTS: ShapeDefaults = { shape: "square", color: "green" };

// Whether a value is one of the shapes a card can be
function isShapeKind(value: unknown): value is ShapeKind {
  return SHAPE_KINDS.some((kind) => kind.value === value);
}

// Read a shape's options (from its content, or from the user's saved defaults),
// falling back to the built-in defaults for anything missing or invalid.
// This keeps old rows (and rows written by older versions of the app) working without migrations.
export function parseShapeContent(content: Json | undefined): ShapeContent {
  const value = asObject(content);
  return {
    shape: isShapeKind(value.shape) ? value.shape : SHAPE_DEFAULTS.shape,
    color: isCardColor(value.color) ? value.color : SHAPE_DEFAULTS.color,
  };
}

// Build the items of a "which shape" submenu
export function shapeKindMenuItems(options: {
  current: ShapeKind;
  onPick: (shape: ShapeKind) => void;
}): ContextMenuItem[] {
  return SHAPE_KINDS.map((kind) => ({
    label: kind.label,
    icon: kind.icon,
    type: "checkbox" as const,
    checked: options.current === kind.value,
    onSelect: () => options.onPick(kind.value),
  }));
}

// The shape-specific items of a shape's right-click menu: which shape it is, and its colour.
// Picking an option also makes it the default for the user's next shape.
export function shapeMenuItems(card: Card, board: BoardStore): ContextMenuItem[] {
  const content = parseShapeContent(card.content);

  const setOptions = (patch: Partial<ShapeDefaults>) => {
    board.changeContent(card.id, patch);
    board.setShapeDefaults(patch);
  };

  return [
    {
      label: "Shape",
      icon: "i-ix-shapes",
      children: shapeKindMenuItems({
        current: content.shape,
        onPick: (shape) => setOptions({ shape }),
      }),
    },
    {
      label: "Colour",
      icon: "i-ph-palette",
      children: colorMenuItems({
        current: content.color,
        swatch: cardBackground,
        onPick: (color) => setOptions({ color }),
        onCustom: () =>
          board.requestCustomColor({
            title: "Shape colour",
            color: content.color,
            apply: (color) => setOptions({ color }),
          }),
      }),
    },
  ];
}
