import type { Json } from "@/types/database.types";

// Read an object out of a JSON value, or an empty object if it isn't one
export function asObject(value: Json | undefined): { [key: string]: Json | undefined } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
