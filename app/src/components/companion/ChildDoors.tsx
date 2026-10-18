import { useEffect, useState } from "react";

/**
 * My child on a phone — the layout switch its readings share.
 *
 * v4 (consolidation blueprint): the four phone doors that used to close each
 * My child reading (Your journal, What Arbor remembers, the Development check
 * and Care, together) are gone: each now has a visible home above —
 * the journal door at the foot of Moments, the What Arbor remembers card on
 * About, the 5-minute check row under the areas on Milestones, and Care in
 * the More sheet and the side rail. Every route stays a deep link. What stays
 * here is the hook the three readings use to switch to the phone stack.
 */
const PHONE_QUERY = "(max-width: 767.98px)";

const readPhone = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;

/**
 * True below 768 px: My child's readings switch to the phone stack (the mock's
 * Phone frame). Built on useState + useEffect, read on the first render, so a
 * phone paints the phone stack at once, and a host without matchMedia (the
 * server, a test) reads the wide layout.
 */
export function useChildPhoneLayout(): boolean {
  const [phone, setPhone] = useState(readPhone);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(PHONE_QUERY);
    const sync = () => setPhone(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return phone;
}
