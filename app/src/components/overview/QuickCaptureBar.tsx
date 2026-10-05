import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { CaptureMode } from "../../context/ArborContext";

/* Quick Capture — the ambient door into logging a moment, above the forms in
   the capture hierarchy. First in Today's DOM so keyboard users reach capture
   first; on phones (< md) the OverviewTab wrapper pins it position:fixed with
   a bottom offset (--mobile-nav-h + safe-area) clearing the MobileNav tab bar
   + the home indicator, so it stays visible at any scroll position (sticky
   cannot engage there: the shell's overflow-x-hidden ancestors are scroll
   containers that grow with content). Inline at the top of the spine on md+.
   Every tile opens the ONE capture sheet (QuickLogModal) in place, in its
   own mode — text, voice (already dictating), photo (picker + preview) — so
   nothing captured here leaves Today (TJB-08, B-TODAY-19). Drafted captures
   still pass the shared ConfirmCaptureReview inside that sheet. Convenience,
   not a nag. */

const GREEN = "var(--arbor-green-ink)";
const RULE = "var(--arbor-rule)";

/** Ambient aux modes — Material Symbols glyphs shared with JournalTab's compose tiles. */
const AUX_MODES: { ms: string; key: Exclude<CaptureMode, "text">; label: string; shortLabel: string }[] = [
  { ms: "mic", key: "voice", label: "today.capture.voice", shortLabel: "elev.wave2Daily.capture.voice" },
  { ms: "photo_camera", key: "photo", label: "today.capture.photo", shortLabel: "elev.wave2Daily.capture.photo" },
];

/** Tile anatomy shared by all four tiles: icon over label in a narrow
 *  CONTAINER (each tile ~89 px at 390), icon beside label once the bar itself
 *  is ≥ 40rem; ≥48 px tall. Critic r1 (P0): the switch reads the bar's own
 *  width (@container), never the viewport — at 1280 the bar sits in a ~490 px
 *  column on #/behaviors, where the lg: viewport layout cut every label to
 *  one letter ("T…", "V…", "P…", "H…"). */
const TILE =
  "min-h-[48px] min-w-0 inline-flex flex-col @2xl:flex-row items-center justify-center gap-1 @2xl:gap-2.5 px-1.5 @2xl:px-3 py-1.5 @2xl:py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset";
const TILE_STYLE = (ink: string): React.CSSProperties =>
  ({ minHeight: 48, borderColor: RULE, color: ink, ["--tw-ring-color" as string]: GREEN }) as React.CSSProperties;
const ICON = "flex h-8 w-8 sm:h-9 sm:w-9 flex-none items-center justify-center rounded-full";
/** A door label is never truncated (critic r1): it wraps to two centred lines. */
const LABEL = "max-w-full line-clamp-2 break-words text-center leading-tight text-[11.5px] @2xl:text-[12px] font-bold";

export default function QuickCaptureBar({
  childName,
  onText,
  onMode,
  onHardMoment,
}: {
  childName: string;
  /** Open the capture sheet in text mode (inline on Today). */
  onText: () => void;
  /** Open the capture sheet in voice or photo mode (inline on Today). */
  onMode: (mode: CaptureMode) => void;
  /** B-TODAY-10: the "Hard moment" tile. Omitted (tile absent) when no pilot
   *  guide is available for this child — e.g. after HARD_MOMENT_PILOT expires. */
  onHardMoment?: () => void;
}) {
  const reduce = useReducedMotion();
  const { t } = useLanguage();
  const tiles = onHardMoment ? 4 : 3;

  return (
    <div className="@container min-w-0">
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.16 }}
      data-capture-tiles={tiles}
      className={`grid ${tiles === 4 ? "grid-cols-4 @3xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]" : "grid-cols-3 @3xl:grid-cols-[1.1fr_1fr_1fr_1fr]"} items-stretch overflow-hidden rounded-[18px]`}
      style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="hidden @3xl:flex flex-col justify-center px-5 py-3">
        <span className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("today.capture.cta")}</span>
      </div>
      <button
        type="button"
        onClick={onText}
        aria-label={t("today.capture.aria", { name: childName })}
        data-capture-tile="text"
        className={`${TILE} @3xl:border-s active:scale-[0.99]`}
        style={TILE_STYLE("var(--arbor-ink)")}
      >
        <span className={ICON} style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}><Icon name="edit_note" size={19} /></span>
        <span className={LABEL}>{t("today.capture.text")}</span>
      </button>
      {AUX_MODES.map(({ ms, key, label, shortLabel }) => (
        <button
          key={key}
          type="button"
          onClick={() => onMode(key)}
          aria-label={t(label)}
          title={t(label)}
          data-capture-tile={key}
          className={`${TILE} border-s active:scale-[0.97]`}
          style={TILE_STYLE(GREEN)}
        >
          <span className={ICON} style={{ background: key === "voice" ? "var(--arbor-lav-soft)" : "var(--arbor-green-soft)", color: key === "voice" ? "var(--arbor-lav-ink)" : GREEN }}><Icon name={ms} size={20} fill={1} /></span>
          <span className={LABEL} style={{ color: "var(--arbor-ink)" }}>{t(shortLabel)}</span>
        </button>
      ))}
      {/* B-TODAY-10: the 4th tile. Neutral ink on paper — never red, coral or
          peach, never "SOS" (a hard moment is not an emergency; the
          SafetyRing stays the human-escalation path). Opens the capture
          sheet on the guide matched to the parent's own recent moments. */}
      {onHardMoment && (
        <button
          type="button"
          onClick={onHardMoment}
          aria-label={t("elev.capture.hard.aria")}
          title={t("elev.capture.hard.aria")}
          data-capture-tile="hard-moment"
          className={`${TILE} border-s active:scale-[0.97]`}
          style={TILE_STYLE("var(--arbor-ink)")}
        >
          <span className={ICON} style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}><Icon name="volunteer_activism" size={19} /></span>
          <span className={LABEL} style={{ color: "var(--arbor-ink)" }}>{t("elev.capture.hard.tile")}</span>
        </button>
      )}
    </motion.div>
    </div>
  );
}
