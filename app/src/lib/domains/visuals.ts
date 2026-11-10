import type { DomainId } from "./registry";

export type DomainTint = "sapphire" | "sky" | "yellow" | "lav" | "pink" | "green" | "peach" | "deep";

/** One semantic palette across development areas, shelves and compact glyphs. */
export const DOMAIN_TINT: Readonly<Record<DomainId, DomainTint>> = {
  talking: "sapphire", moving: "green", hands: "yellow", thinking: "sky",
  playing: "pink", feelings: "lav", body: "deep", family: "peach",
};
