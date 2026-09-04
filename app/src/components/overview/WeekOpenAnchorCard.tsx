import React, { useEffect } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { markWeekAnchorSeen } from "./weekAnchor";

/* ════════════════════════════════════════════════════════════════════════════
   WeekOpenAnchorCard — ENG-24 as shipped: the weekly ritual's Monday anchor.

   WHY THIS CARD EXISTS SEPARATELY FROM THE RECAP ANCHOR
   ─────────────────────────────────────────────────────
   The sibling card in this folder offers last week's written report, and its
   copy makes that report's EXISTENCE a hard claim. Today cannot verify that
   claim: a report is only generated when the trailing week carried at least one
   logged moment, and a signed-in device keeps no local copy of the collection
   to check. Verifying it means a Firestore subscription on the app's
   most-loaded surface, which was refused. So that card stays unmounted behind
   its own guard, and this one ships instead.

   This card claims NOTHING that needs the network. A week boundary is a
   calendar fact, true on every device for every parent, and the move it offers
   — note one thing from today — is available to all of them. It looks FORWARD,
   so a parent who logged nothing last week is never told a report is waiting,
   never shown a gap, and never counted at. The two cards are not variants of
   one render path: they say different things, and only one of them is honest
   without a signal.

   Rendered in Today's ONE primary-action slot when chooseTodayAction returns
   kind "weekOpen" (Rule A: exactly one primary action above the fold — this
   card REPLACES the day's other offer, it never stacks on top of it, and it
   costs the module budget nothing because the anchor slot is the budget's
   implicit first entry).

   NO NAGGING. The week's single appearance is spent the moment the card
   renders, on the shared marker the recap variant also writes: seen once, gone
   until the week id changes. Dismissing falls straight through to the day's
   normal anchor in the same frame, so nothing is taken away by showing this.

   CLINICAL FIREWALL: nothing about the child is rendered or derived here — no
   counts, no narrative, no verdict, and the child's first name appears only
   where the copy addresses the parent about their own week.
   ════════════════════════════════════════════════════════════════════════════ */
export default function WeekOpenAnchorCard({
  weekId,
  childId,
  childName,
  onCapture,
  onDismiss,
}: {
  /** The recapWeekId this anchor is spending — the SAME week identity the
   *  recap variant uses, so the two can never both fire in one week. */
  weekId: string;
  /** The child whose device-local marker this card spends. */
  childId: string;
  /** The child's first name, or "" — the copy has a generic title without it. */
  childName: string;
  /** Opens the existing QuickLogModal text capture (no new capture path). */
  onCapture: () => void;
  /** Called after the parent chooses, so the slot falls through to the next
   *  choice in the same frame. */
  onDismiss?: () => void;
}) {
  const { t } = useLanguage();

  // Once per week, per device: the appearance itself spends the week, so an
  // anchor the parent scrolled past is never re-offered on the next open of the
  // same week. Writing here rather than on the buttons is the difference
  // between "dismissed" and "seen", and no-nagging asks for the weaker of the
  // two. Deps are the identity of what is being spent, so a child switch mid-
  // session marks the OTHER child's week correctly.
  useEffect(() => {
    markWeekAnchorSeen(childId, weekId);
  }, [childId, weekId]);

  const capture = () => {
    try {
      track("week_open_anchor_capture", { weekId });
    } catch {
      /* analytics is never load-bearing */
    }
    onCapture();
    onDismiss?.();
  };

  return (
    <section
      data-testid="today-week-open"
      aria-labelledby="today-week-open-title"
      className="overflow-hidden rounded-[24px] p-4 sm:p-6"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: "var(--arbor-sky-ink)" }}
      >
        <Icon name="calendar_month" size={16} />
        {t("elev.waveR.weekopen.eyebrow")}
      </span>
      <h2
        id="today-week-open-title"
        className="mt-2 break-words text-xl font-semibold leading-tight sm:text-2xl"
        style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
      >
        {childName
          ? t("elev.waveR.weekopen.title", { name: childName })
          : t("elev.waveR.weekopen.titleGeneric")}
      </h2>
      <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }} dir="auto">
        {t("elev.waveR.weekopen.body")}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={capture}
          data-testid="today-week-open-capture"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]"
          style={{ background: "var(--arbor-clay)" }}
        >
          {t("elev.waveR.weekopen.cta")}
          <Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.()}
          data-testid="today-week-open-later"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition"
          style={{ color: "var(--arbor-muted)" }}
        >
          {t("elev.waveR.weekopen.later")}
        </button>
      </div>
    </section>
  );
}
