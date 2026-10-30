import { useEffect, useRef, useState } from "react";

/** The ledger region on About (ChildProfile renders it under the memory card). */
export const LEDGER_ID = "about-memory-ledger";

const scrollToLedger = (): void => {
  try {
    const fact = new URLSearchParams((window.location.hash.split("?")[1] ?? "")).get("fact");
    const row = fact ? document.querySelector(`[data-memory-id="${CSS.escape(fact)}"]`) : null;
    (row ?? document.getElementById(LEDGER_ID))?.scrollIntoView({ block: "start" });
  } catch { /* SSR */ }
};

/**
 * B-CAREPRO-38 — the "Everything Arbor remembers" ledger's open state on About.
 *
 * Arriving on a retired #/memory or #/child-memory link — or through an in-app
 * door that still names "memory" — opens the ledger and brings it into view
 * ONCE per arrival. After that the parent's toggle owns the state: a re-render
 * (an area sheet opening and closing, a fact saving) never reopens it and never
 * scrolls the page back. `?section=coach` arrives at the coach's panel, which
 * scrolls itself (CoachDataContract), so the ledger only opens.
 *
 * `section` must be the query VALUE (a string), never the URLSearchParams
 * object: useHashQuery builds a new one every render, and an effect keyed on it
 * re-fired on every render (critic r1 P1).
 */
export function useLedgerArrival(asked: boolean, section: string | null, scroll: () => void = scrollToLedger): [boolean, () => void] {
  const [open, setOpen] = useState(asked);
  // The arrival already handled ("" = none): one open and one scroll per arrival.
  const handled = useRef<string | null>(null);
  const scrollNow = useRef(scroll);
  scrollNow.current = scroll;
  const arrival = asked ? `memory:${section ?? ""}` : null;
  useEffect(() => {
    if (!arrival) { handled.current = null; return; }
    if (handled.current === arrival) return;
    setOpen(true);
    if (section === "coach") { handled.current = arrival; return; }
    const id = setTimeout(() => { handled.current = arrival; scrollNow.current(); }, 250);
    return () => clearTimeout(id);
  }, [arrival, section]);
  return [open, () => setOpen((o) => !o)];
}
