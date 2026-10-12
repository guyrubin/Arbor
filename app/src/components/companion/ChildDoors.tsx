import React, { useEffect, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { Icon } from "../ui/Icon";
import "./childDoors.css";

/**
 * v3 F-CHILD-4 (MOB-02) — My child on a phone: the four doors under a pill.
 *
 * On a wide screen the side rail and the page reach these places; on a phone
 * the mock closes each My child pill with a 2 x 2 grid of doors: Your journal
 * (#/journal), What Arbor remembers (#/memory), the Development check
 * (#/screening) and Care, together (#/consult). Each door is an icon, a
 * title and one plain line, nothing more: no count, no badge, no "n facts"
 * (the mock's "12 facts · 2 proposals" is a count, so it is a sentence here).
 * The memory door says, in words, when a proposal waits there. A pill whose
 * own primary move already opens one of these places leaves that door out
 * (`omit`), so no screen carries two doors to the same room.
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
 *  place's own name elsewhere in the app, so a place is named once. */
export const CHILD_DOORS = [
  { tab: "journal", icon: "edit_note", title: "companion.portrait.journal", sub: "companion.doors.journalSub" },
  { tab: "memory", icon: "neurology", title: "companion.portrait.memory", sub: "companion.doors.memorySub" },
  { tab: "screening", icon: "fact_check", title: "companion.doors.check", sub: "companion.doors.checkSub" },
  { tab: "consult", icon: "diversity_1", title: "companion.door.care", sub: "companion.doors.careSub" },
] as const;

export type ChildDoorTab = (typeof CHILD_DOORS)[number]["tab"];

export interface ChildDoorsProps {
  /** A proposal waits on #/memory that no area shows: the memory door says so, in words. */
  memoryWaiting?: boolean;
  /** A door the pill already opens through its own primary move. */
  omit?: ChildDoorTab;
}

export default function ChildDoors({ memoryWaiting = false, omit }: ChildDoorsProps) {
  const { setActiveTab } = useArbor();
  const { t } = useLanguage();
  return (
    <nav className="child-doors" data-testid="child-doors" aria-label={t("companion.doors.aria")}>
      <ul className="child-doors-grid" role="list">
        {CHILD_DOORS.filter((door) => door.tab !== omit).map((door) => {
          const waiting = door.tab === "memory" && memoryWaiting;
          return (
            <li key={door.tab}>
              <button type="button" className="child-door min-h-11" data-testid={`child-door-${door.tab}`} onClick={() => setActiveTab(door.tab)}>
                <Icon name={door.icon} size={20} />
                <span className="child-door-text">
                  <span className="child-door-title">{t(door.title)}</span>
                  {waiting
                    ? <span className="child-door-sub child-door-waiting" data-testid="child-door-waiting">{t("companion.about.memoryWaiting")}</span>
                    : <span className="child-door-sub">{t(door.sub)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
