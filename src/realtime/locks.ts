import { REALTIME } from "@/constants";

// What a client is doing with the card it holds
export type HoldMode = "move" | "resize" | "edit";

// The card a client holds. Only the holder may change a card; everyone else sees it as locked.
// `at` is the holder's clock when it grabbed the card.
export type Hold = { cardId: string; mode: HoldMode; at: number };

// What each client on a board shares through presence. It only changes on join, leave, grab and release.
// The presence key is the clientId (one per browser tab), so one user with two tabs is two clients.
export type BoardPresence = {
  clientId: string;
  userId: string;
  username: string;
  joinedAt: number;
  hold: Hold | null;
};

// Works out which client holds each card from everyone's presence.
// Every client runs the same rules on the same presence, so they all agree without talking to each other:
// - A card held by one client is held by that client.
// - Two clients can grab the same card before either sees the other's grab. If the second hold shows up within
//   CONTEST_WINDOW of the first, the earlier grab wins (by `at`, then by clientId to break ties).
// - A hold that shows up later never displaces a hold that was already seen. This stops a client that missed
//   the existing hold (for example, one that just reconnected, or whose clock is behind) from taking a card
//   out from under its holder.
export function createLockResolver() {
  // The winning hold for each held card, and when this client first saw that card held
  const locks = new Map<string, { clientId: string; at: number; firstSeen: number }>();

  // Recompute the locks from the latest presence. Returns cardId → the clientId holding it.
  function update(presences: BoardPresence[], now = Date.now()): Map<string, string> {
    // Every hold on each card, earliest grab first
    const holdsByCard = new Map<string, { clientId: string; at: number }[]>();
    for (const presence of presences) {
      if (!presence.hold) continue;
      const holds = holdsByCard.get(presence.hold.cardId) ?? [];
      holds.push({ clientId: presence.clientId, at: presence.hold.at });
      holdsByCard.set(presence.hold.cardId, holds);
    }

    for (const [cardId, holds] of holdsByCard) {
      holds.sort((a, b) => a.at - b.at || a.clientId.localeCompare(b.clientId));
      const earliest = holds[0]!;
      const current = locks.get(cardId);

      // A newly held card, or its holder let go and someone else holds it now
      if (!current || !holds.some((hold) => hold.clientId === current.clientId)) {
        locks.set(cardId, { ...earliest, firstSeen: now });
        continue;
      }

      // A competing hold only wins if it arrived during the contest window and grabbed first
      const grabbedFirst =
        earliest.at < current.at ||
        (earliest.at === current.at && earliest.clientId < current.clientId);
      if (
        earliest.clientId !== current.clientId &&
        grabbedFirst &&
        now - current.firstSeen < REALTIME.CONTEST_WINDOW
      ) {
        locks.set(cardId, { ...earliest, firstSeen: current.firstSeen });
      }
    }

    // Forget cards nobody holds any more
    for (const cardId of locks.keys()) {
      if (!holdsByCard.has(cardId)) locks.delete(cardId);
    }

    return new Map(Array.from(locks, ([cardId, lock]) => [cardId, lock.clientId]));
  }

  return { update };
}
