import type { Database } from "@/types/database.types";

// The kinds of card a board can hold
export type CardType = Database["public"]["Enums"]["card_type"];

// The named colours cards can use. Each is the same in both colour modes (see PALETTE_COLORS in colors.ts),
// except "auto", a neutral that follows the viewer's colour mode.
export const PALETTE = [
  "auto",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "blue",
  "green",
  "gray",
] as const;
export type PaletteColor = (typeof PALETTE)[number];

// A custom colour picked by the user, as "#rrggbb". It looks the same in light and dark mode.
export type HexColor = `#${string}`;

// Card colours are stored by name, or as a hex code for custom colours
export type CardColor = PaletteColor | HexColor;

// The content of a note card
export type NoteContent = {
  text: string;
  color: CardColor;
  textColor: CardColor;
  // The text size, in world units (so it scales with the zoom)
  fontSize: number;
};

// The colours a user's new note cards start with (stored in user_preferences.card_defaults.note)
export type NoteDefaults = Pick<NoteContent, "color" | "textColor" | "fontSize">;

// The shapes a shape card can be
export type ShapeKind = "square" | "triangle" | "circle";

// The content of a shape card
export type ShapeContent = {
  shape: ShapeKind;
  color: CardColor;
};

// The options a user's new shape cards start with (stored in user_preferences.card_defaults.shape)
export type ShapeDefaults = ShapeContent;

// A point on a drawn line, as [x, y] fractions (0 to 1) of the card's drawing area (the card minus its padding).
// Stored as pairs rather than objects to keep long lines small.
export type StrokePoint = [number, number];

// The content of a draw card. `strokes` holds one line per drawing, in a list so a card could hold several.
export type DrawContent = {
  color: CardColor;
  // The line's width in world units (it scales with the zoom, but not when the card is resized)
  thickness: number;
  strokes: StrokePoint[][];
};

// The options a user's next drawing starts with (stored in user_preferences.card_defaults.draw)
export type DrawDefaults = Pick<DrawContent, "color" | "thickness">;

// Every option for a user's new cards, per card type (stored in user_preferences.card_defaults)
export type CardDefaults = { note: NoteDefaults; shape: ShapeDefaults; draw: DrawDefaults };

// What a left-button drag on the board does: select and move cards, or draw a line
export type BoardTool = "select" | "draw";

// The card layers, from back to front
export const LAYERS = [
  { value: 0, label: "Back" },
  { value: 1, label: "Middle" },
  { value: 2, label: "Front" },
] as const;
