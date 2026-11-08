import type { Component } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import type { Json } from "@/types/database.types";
import type { CardDefaults, CardType } from "@/types/cards";
import type { Card, BoardStore } from "@/stores/board";
import NoteCardBody from "@/components/NoteCardBody.vue";
import ShapeCardBody from "@/components/ShapeCardBody.vue";
import DrawCardBody from "@/components/DrawCardBody.vue";
import { drawMenuItems } from "./draw";
import { newNoteContent, noteMenuItems } from "./note";
import { shapeMenuItems } from "./shape";

// Everything the board needs to know about one type of card.
// BaseCard handles everything to do with the board (moving, resizing, selecting, layers, deleting),
// and the body component only draws the card's content. Adding a card type means adding a body and an entry here.
export type CardTypeDefinition = {
  // The component that draws the card's content
  body: Component;
  // The size of a new card, and the smallest it can be resized to (in world units)
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  // Whether clicking the card enters edit mode (for example, to type in a note)
  editable: boolean;
  // Whether the card's body doesn't fill its rectangle (a circle, for example).
  // BaseCard then draws no rectangular shadow around it, and the body draws its own.
  frameless: boolean;
  // Whether only the body's own clickable parts (such as a drawn line) can be clicked until the card is selected.
  // The rest of the card lets clicks through to whatever is behind it. Once selected, the whole card can be
  // grabbed and resized. Used by drawings, whose rectangle is mostly empty and can cover other cards.
  hollow: boolean;
  // The content of a new card, from the user's defaults
  newContent: (defaults: CardDefaults) => Json;
  // The type's own items for the card's right-click menu (BaseCard adds the layer and delete items)
  menuItems: (card: Card, board: BoardStore) => ContextMenuItem[];
};

// The card types that are implemented so far
export const CARD_TYPES: Partial<Record<CardType, CardTypeDefinition>> = {
  note: {
    body: NoteCardBody,
    defaultSize: { width: 200, height: 200 },
    minSize: { width: 80, height: 60 },
    editable: true,
    frameless: false,
    hollow: false,
    newContent: (defaults) => newNoteContent(defaults.note),
    menuItems: noteMenuItems,
  },
  shape: {
    body: ShapeCardBody,
    defaultSize: { width: 200, height: 200 },
    minSize: { width: 40, height: 40 },
    editable: false,
    frameless: true,
    hollow: false,
    newContent: (defaults) => ({ ...defaults.shape }),
    menuItems: shapeMenuItems,
  },
  draw: {
    body: DrawCardBody,
    // Drawings are created from their line (see drawCardFromStroke), so the default size is never used
    defaultSize: { width: 200, height: 200 },
    minSize: { width: 20, height: 20 },
    editable: false,
    frameless: true,
    hollow: true,
    newContent: (defaults) => ({ ...defaults.draw, strokes: [] }),
    menuItems: drawMenuItems,
  },
};
