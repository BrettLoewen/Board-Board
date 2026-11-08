import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { REALTIME } from "@/constants";
import type { Card } from "@/stores/board";
import type { CardColor } from "@/types/cards";
import type { Point } from "@/utils/camera";
import type { BoardPresence } from "./locks";

// A card's position, size and stacking, as broadcast while it is moved or resized
export type GeometryMessage = Pick<
  Card,
  "id" | "x" | "y" | "width" | "height" | "layer" | "z_order" | "rev"
>;

// A card's content, as broadcast while it is edited
export type ContentMessage = Pick<Card, "id" | "content" | "rev">;

// New points (in world units) of a line someone is drawing. The stroke id becomes the id of the line's card.
export type StrokePreviewMessage = {
  strokeId: string;
  color: CardColor;
  thickness: number;
  points: Point[];
};

// What the board does with each kind of message on its channel
export type BoardChannelHandlers = {
  // From other clients, before the change is written
  onGeometry: (message: GeometryMessage) => void;
  onContent: (message: ContentMessage) => void;
  onCreate: (card: Card) => void;
  onDelete: (id: string) => void;
  // A line someone is drawing grew, was finished (its card follows) or was cancelled
  onStrokePreview: (message: StrokePreviewMessage) => void;
  onStrokeEnd: (strokeId: string) => void;
  onStrokeCancel: (strokeId: string) => void;
  // From the database, after a change is committed
  onCommitted: (card: Card) => void;
  onCommittedDelete: (id: string) => void;
  onBoardDeleted: () => void;
  onAccessRevoked: (userId: string) => void;
  // Presence changed (someone joined, left, grabbed or released a card)
  onPresence: (presences: BoardPresence[]) => void;
  // The channel connected (first time, or again after a dropped connection) or lost its connection
  onConnected: () => void;
  onDisconnected: () => void;
};

export type BoardChannel = {
  send: (event: string, payload: object) => void;
  track: (presence: BoardPresence) => void;
  close: () => Promise<void>;
};

// Open a board's private channel. Only users who can view the board can join it (see the board_realtime migration).
// Every handler is registered before subscribing, so no message is missed.
export async function openBoardChannel(
  boardId: string,
  clientId: string,
  handlers: BoardChannelHandlers,
): Promise<BoardChannel> {
  // Private channels check the user's access token, so make sure the socket has the current one
  await supabase.realtime.setAuth();

  const channel: RealtimeChannel = supabase.channel(`${REALTIME.TOPICS.BOARD}${boardId}`, {
    config: {
      private: true,
      // The sender has already applied its own changes, so it doesn't need them back
      broadcast: { self: false },
      presence: { key: clientId },
    },
  });

  const { EVENTS } = REALTIME;
  const on = (event: string, handle: (payload: Record<string, unknown>) => void) =>
    channel.on("broadcast", { event }, (message) => handle(message.payload ?? {}));

  on(EVENTS.CARD_GEOMETRY, (payload) => handlers.onGeometry(payload as GeometryMessage));
  on(EVENTS.CARD_CONTENT, (payload) => handlers.onContent(payload as ContentMessage));
  on(EVENTS.CARD_CREATE, (payload) => handlers.onCreate(payload as Card));
  on(EVENTS.CARD_DELETE, (payload) => handlers.onDelete(payload.id as string));
  on(EVENTS.STROKE_PREVIEW, (payload) => handlers.onStrokePreview(payload as StrokePreviewMessage));
  on(EVENTS.STROKE_END, (payload) => handlers.onStrokeEnd(payload.strokeId as string));
  on(EVENTS.STROKE_CANCEL, (payload) => handlers.onStrokeCancel(payload.strokeId as string));
  // Database events carry the committed row as `record` (or just the `id` for deletes)
  on(EVENTS.DB_INSERT, (payload) => handlers.onCommitted(payload.record as Card));
  on(EVENTS.DB_UPDATE, (payload) => handlers.onCommitted(payload.record as Card));
  on(EVENTS.DB_DELETE, (payload) => handlers.onCommittedDelete(payload.id as string));
  on(EVENTS.BOARD_DELETED, () => handlers.onBoardDeleted());
  on(EVENTS.ACCESS_REVOKED, (payload) => handlers.onAccessRevoked(payload.userId as string));

  // Presence state is keyed by clientId, and each client tracks one presence
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<BoardPresence>();
    handlers.onPresence(Object.values(state).flatMap((presences) => presences.slice(0, 1)));
  });

  // supabase-js rejoins by itself after a dropped connection, and reports SUBSCRIBED again when it does
  channel.subscribe((status, error) => {
    if (status === "SUBSCRIBED") handlers.onConnected();
    else {
      if (error) console.error(error);
      handlers.onDisconnected();
    }
  });

  return {
    send: (event, payload) => {
      channel.send({ type: "broadcast", event, payload });
    },
    track: (presence) => {
      channel.track(presence);
    },
    close: async () => {
      await channel.untrack();
      await supabase.removeChannel(channel);
    },
  };
}
