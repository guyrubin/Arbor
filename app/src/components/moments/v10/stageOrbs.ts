import type { Orb } from "../../../design/primitives";

/** The stage's two decorative orbs, placed as the boards place them (decor only, aria-hidden). */
export const STAGE_ORBS: Readonly<Record<"desk" | "phone", Orb[]>> = {
  desk: [{ size: 440, left: -230, bottom: -290, opacity: 0.65 }, { size: 380, right: -190, top: -250, opacity: 0.65, b: true }],
  phone: [{ size: 250, left: -150, bottom: -160, opacity: 0.6 }, { size: 220, right: -130, top: -140, opacity: 0.6, b: true }],
};
