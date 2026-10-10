import type { DomainId } from "./registry";
/** Existing My child glyphs, shared with onboarding. Names/order stay in registry. */
export const DOMAIN_ICONS: Readonly<Record<DomainId, string>> = {
  talking: "chat_bubble", moving: "directions_run", hands: "front_hand", thinking: "psychology",
  playing: "group", feelings: "favorite", body: "spa", family: "diversity_3",
};
