import type { Component } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import type { Json } from "@/types/database.types";
import type { CardDefaults, CardType } from "@/types/cards";
import type { Card, BoardStore } from "@/stores/board";
import NoteCardBody from "@/components/NoteCardBody.vue";
import { newNoteContent, noteMenuItems } from "./note";

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
    newContent: (defaults) => newNoteContent(defaults.note),
    menuItems: noteMenuItems,
  },
};
