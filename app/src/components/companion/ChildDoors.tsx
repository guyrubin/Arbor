import React, { useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
// B-CAREPRO-06: the waiting queue is read through the same plain-words scrub
// About and #/memory read, so the door counts the proposals they list.
import { scrubMemoryProposals } from "../../server/parentWordsScrub";
import { waitingOffPage, type AspectState } from "../../lib/aboutAspects";
import { Icon } from "../ui/Icon";
import "./childDoors.css";

/**
 * v3 F-CHILD-4 (MOB-02) — My child on a phone: the four doors under a pill.
 *
 * On a wide screen the side rail and the page reach these places; on a phone
 * the mock closes each My child pill with a 2 x 2 grid of doors: Your journal
 * (#/journal), What Arbor remembers (#/memory), the Development check
 * (#/screening) and Care, together (#/consult). Each door is an icon and the
 * place's name, as the mock's phone grid draws it (its data carries a
 * sub-line, the grid does not render one). No count, no badge, no "n facts".
 *
 * One door, one answer: the memory door reads the waiting queue itself, so it
 * speaks the same way under every pill. It adds one sentence, in words, when
 * a proposal waits that the page the parent is on does not show. About shows
 * the proposals it places in its areas (`shownAreas`); Milestones and Moments
 * show none, so there any waiting proposal is behind the door. That sentence
 * is F-CHILD-3's waiting line, which this door carries on a phone.
 * A pill whose own primary move or own door already opens one of these places
 * leaves that door out (`omit`), so no screen carries two doors to one room.
 *
 * The doors are navigation, not content: they stamp no data-module and no
 * primary move, so a pill's module budget and its one primary move hold.
 * Every door is a 44 px target; the layout is logical only, so Hebrew
 * mirrors the grid with no extra rule; an odd last door spans the row.
 */
const PHONE_QUERY = "(max-width: 767.98px)";

const readPhone = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;

/**
 * True below 768 px: My child's pills switch to the phone stack (the mock's
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

/** The mock's four doors, in its order (Phone frame, childDoors). Each title is the
 *  place's own name elsewhere in the app, so a place is named once: Care is
 *  "Care, together", as the mock names it in the rail, the door and Back. */
export const CHILD_DOORS = [
  { tab: "journal", icon: "edit_note", title: "companion.portrait.journal" },
  { tab: "memory", icon: "neurology", title: "companion.portrait.memory" },
  { tab: "screening", icon: "fact_check", title: "companion.doors.check" },
  { tab: "consult", icon: "diversity_1", title: "companion.door.care" },
] as const;

export type ChildDoorTab = (typeof CHILD_DOORS)[number]["tab"];

const NO_AREAS: readonly AspectState[] = [];

export interface ChildDoorsProps {
  /** The areas this page shows, each with the proposal it places (About's
   *  eight). A proposal shown there is not "waiting" behind the memory door. */
  shownAreas?: readonly AspectState[];
  /** A door the pill already opens through its own primary move or door. */
  omit?: ChildDoorTab;
}

export default function ChildDoors({ shownAreas = NO_AREAS, omit }: ChildDoorsProps) {
  const { setActiveTab, pendingMemoryItems } = useArbor();
  const { t } = useLanguage();
  const memoryWaiting = useMemo(
    () => waitingOffPage(shownAreas, scrubMemoryProposals(pendingMemoryItems)),
    [shownAreas, pendingMemoryItems],
  );
  return (
    <nav className="child-doors" data-testid="child-doors" aria-label={t("companion.doors.aria")}>
      <ul className="child-doors-grid" role="list">
        {CHILD_DOORS.filter((door) => door.tab !== omit).map((door) => (
          <li key={door.tab}>
            <button type="button" className="child-door min-h-11" data-testid={`child-door-${door.tab}`} onClick={() => setActiveTab(door.tab)}>
              <Icon name={door.icon} size={20} />
              <span className="child-door-text">
                <span className="child-door-title">{t(door.title)}</span>
                {door.tab === "memory" && memoryWaiting && (
                  <span className="child-door-waiting" data-testid="child-door-waiting">{t("companion.about.memoryWaiting")}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
