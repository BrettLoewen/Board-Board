import type { ContextMenuItem } from "@nuxt/ui";
import type { Json } from "@/types/database.types";
import type { NoteContent, NoteDefaults } from "@/types/cards";
import type { Card, BoardStore } from "@/stores/board";
import { cardBackground, cardText, isCardColor } from "@/utils/colors";
import { colorMenuItems } from "./colorMenu";
import { fontSizeMenuItems, isFontSize } from "./fontSizeMenu";

// The options a note starts with before the user has picked any
export const NOTE_DEFAULTS: NoteDefaults = { color: "green", textColor: "auto", fontSize: 16 };

// Read an object out of a JSON value, or an empty object if it isn't one
function asObject(value: Json | undefined): { [key: string]: Json | undefined } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// Read a note's options (from its content, or from the user's saved defaults),
// falling back to the built-in defaults for anything missing or invalid
export function parseNoteDefaults(value: Json | undefined): NoteDefaults {
  const saved = asObject(value);
  return {
    color: isCardColor(saved.color) ? saved.color : NOTE_DEFAULTS.color,
    textColor: isCardColor(saved.textColor) ? saved.textColor : NOTE_DEFAULTS.textColor,
    fontSize: isFontSize(saved.fontSize) ? saved.fontSize : NOTE_DEFAULTS.fontSize,
  };
}

// Read a note's content from the database, filling in defaults for anything missing or invalid.
// This keeps old rows (and rows written by older versions of the app) working without migrations.
export function parseNoteContent(content: Json): NoteContent {
  const value = asObject(content);
  return {
    text: typeof value.text === "string" ? value.text : "",
    ...parseNoteDefaults(content),
  };
}

// The content of a new note, using the user's defaults
export function newNoteContent(defaults: NoteDefaults): NoteContent {
  return { text: "", ...defaults };
}

// The note-specific items of a note's right-click menu: its colour, text colour and text size.
// Picking an option also makes it the default for the user's next note.
export function noteMenuItems(card: Card, board: BoardStore): ContextMenuItem[] {
  const content = parseNoteContent(card.content);

  const setOptions = (patch: Partial<NoteDefaults>) => {
    board.updateContent(card.id, patch);
    board.persistCard(card.id);
    board.setNoteDefaults(patch);
  };

  return [
    {
      label: "Colour",
      icon: "i-ph-palette",
      children: colorMenuItems({
        current: content.color,
        swatch: cardBackground,
        onPick: (color) => setOptions({ color }),
        onCustom: () =>
          board.requestCustomColor({
            title: "Note colour",
            color: content.color,
            apply: (color) => setOptions({ color }),
          }),
      }),
    },
    {
      label: "Text colour",
      icon: "i-ph-text-aa",
      children: colorMenuItems({
        current: content.textColor,
        swatch: (color) => cardText(color, content.color),
        onPick: (textColor) => setOptions({ textColor }),
        onCustom: () =>
          board.requestCustomColor({
            title: "Note text colour",
            color: content.textColor,
            apply: (textColor) => setOptions({ textColor }),
          }),
      }),
    },
    {
      label: "Text size",
      icon: "i-ph-text-t",
      children: fontSizeMenuItems({
        current: content.fontSize,
        onPick: (fontSize) => setOptions({ fontSize }),
      }),
    },
  ];
}
