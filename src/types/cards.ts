import type { Database } from "@/types/database.types";

// The kinds of card a board can hold
export type CardType = Database["public"]["Enums"]["card_type"];

// The named colours cards can use. Each has a light-mode and a dark-mode shade (see main.css),
// so a card's colour follows the viewer's colour mode. "auto" is a neutral that follows the colour mode too.
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

// Every option for a user's new cards, per card type (stored in user_preferences.card_defaults)
export type CardDefaults = { note: NoteDefaults };

// The card layers, from back to front
export const LAYERS = [
  { value: 0, label: "Back" },
  { value: 1, label: "Middle" },
  { value: 2, label: "Front" },
] as const;
