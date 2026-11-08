// Each user's colour on a board (their presence chip, cursor, and the border on cards they hold).
// Picked from the user's id, so every client works out the same colour without storing or sharing it.
// The colours are strong enough to read on both the light and the dark board. Two users can share a colour.
export const USER_COLORS = [
  "#e11d48", // rose
  "#ea580c", // orange
  "#ca8a04", // yellow
  "#65a30d", // lime
  "#059669", // emerald
  "#0891b2", // cyan
  "#2563eb", // blue
  "#4f46e5", // indigo
  "#7c3aed", // violet
  "#c026d3", // fuchsia
  "#db2777", // pink
  "#0d9488", // teal
] as const;

// The colour for a user (FNV-1a hash of their id, into the list above)
export function userColor(userId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return USER_COLORS[(hash >>> 0) % USER_COLORS.length]!;
}

// Up to two letters to show for a user ("John Doe" → "JD", "abc" → "AB")
export function initials(username: string): string {
  const words = username.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}
