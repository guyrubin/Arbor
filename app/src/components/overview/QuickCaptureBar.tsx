import React, { useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import type { CaptureMode } from "../../context/ArborContext";
import { requestCompanionConversation } from "../../lib/companionConversation";
import { markVoiceDoorNoticeSeen, voiceDoorNoticeSeen } from "../../lib/voiceDoor";

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
   not a nag. B-VOICE-06: the Voice tile first offers a choice — "Note
   something" (that same sheet, dictating) or "Talk it through" (the spoken
   conversation, through the one conversation seam). */

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
/** NEXTLEVEL critic r1 (overview · design · P1): on Today at lg the bar is the
 *  inline-end track of a two-track page — a vertical list (icon beside label,
 *  hairline between rows), read after the record card. Below lg it is the bar. */
const STACK_GRID = "lg:grid-cols-1";
const STACK_TILE = "lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-2";
const STACK_BORDER = "lg:border-s-0 lg:border-t";
const STACK_LABEL = "lg:text-start lg:text-[13px]";
/** B-VOICE-06: one row of the Voice choice — icon beside a label and its sub
 *  line, 44 px floor, the tile's own focus ring. */
const CHOICE =
  "flex min-h-11 w-full min-w-0 items-center gap-3 rounded-[14px] px-3 py-2 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset";

export default function QuickCaptureBar({
  childName,
  onText,
  onMode,
  onHardMoment,
  stack = false,
}: {
  childName: string;
  /** Today at lg: a vertical list in the page's inline-end track. */
  stack?: boolean;
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
  // B-VOICE-06: the Voice tile opens a choice between the two voice doors that
  // already exist — "Note something" is the capture sheet's dictation (onMode,
  // unchanged) and "Talk it through" is the conversation's Talk path (the one
  // conversation seam, asked to start talking). No new voice path.
  const [voiceChoice, setVoiceChoice] = useState(false);
  const [firstUse, setFirstUse] = useState(() => !voiceDoorNoticeSeen());
  const choiceId = useId();
  const voiceTileRef = useRef<HTMLButtonElement>(null);
  const chooseVoice = (door: "note" | "talk") => {
    setVoiceChoice(false);
    if (firstUse) { markVoiceDoorNoticeSeen(); setFirstUse(false); }
    if (door === "note") onMode("voice");
    else requestCompanionConversation({ source: "capture-voice", voice: true });
  };
  const tiles = onHardMoment ? 4 : 3;
  const tile = stack ? `${TILE} ${STACK_TILE}` : TILE;
  const labelClass = stack ? `${LABEL} ${STACK_LABEL}` : LABEL;
  const edge = stack ? `border-s ${STACK_BORDER}` : "border-s";

  return (
    <div className="@container min-w-0">
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.16 }}
      data-capture-tiles={tiles}
      data-capture-stack={stack ? "lg" : undefined}
      className={`grid ${tiles === 4 ? "grid-cols-4 @3xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]" : "grid-cols-3 @3xl:grid-cols-[1.1fr_1fr_1fr_1fr]"} ${stack ? STACK_GRID : ""} items-stretch overflow-hidden rounded-[18px]`}
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
        className={`${tile} @3xl:border-s active:scale-[0.99]`}
        style={TILE_STYLE("var(--arbor-ink)")}
      >
        <span className={ICON} style={{ background: "var(--arbor-tint)", color: "var(--arbor-clay)" }}><Icon name="edit_note" size={19} /></span>
        <span className={labelClass}>{t("today.capture.text")}</span>
      </button>
      {AUX_MODES.map(({ ms, key, label, shortLabel }) => (
        <button
          key={key}
          ref={key === "voice" ? voiceTileRef : undefined}
          type="button"
          onClick={() => (key === "voice" ? setVoiceChoice((open) => !open) : onMode(key))}
          aria-label={t(label)}
          aria-expanded={key === "voice" ? voiceChoice : undefined}
          aria-controls={key === "voice" && voiceChoice ? choiceId : undefined}
          title={t(label)}
          data-capture-tile={key}
          className={`${tile} ${edge} active:scale-[0.97]`}
          style={TILE_STYLE(GREEN)}
        >
          <span className={ICON} style={{ background: key === "voice" ? "var(--arbor-lav-soft)" : "var(--arbor-green-soft)", color: key === "voice" ? "var(--arbor-lav-ink)" : GREEN }}><Icon name={ms} size={20} fill={1} /></span>
          <span className={labelClass} style={{ color: "var(--arbor-ink)" }}>{t(shortLabel)}</span>
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
          className={`${tile} ${edge} active:scale-[0.97]`}
          style={TILE_STYLE("var(--arbor-ink)")}
        >
          <span className={ICON} style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}><Icon name="volunteer_activism" size={19} /></span>
          <span className={labelClass} style={{ color: "var(--arbor-ink)" }}>{t("elev.capture.hard.tile")}</span>
        </button>
      )}
    </motion.div>
    {/* B-VOICE-06: the Voice choice, under the bar (it adds to the bar, never
        replaces a tile). The first time it opens it says once what happens to
        the audio; the residency sentence is the existing Live line (this bar
        reads no /live/availability, so it carries the undated form). Escape
        closes it and returns focus to the Voice tile. */}
    {voiceChoice && (
      <VoiceChoice
        id={choiceId}
        firstUse={firstUse}
        t={t}
        onChoose={chooseVoice}
        onEscape={() => { setVoiceChoice(false); voiceTileRef.current?.focus(); }}
      />
    )}
    </div>
  );
}

const CHOICE_STYLE = { color: "var(--arbor-ink)", ["--tw-ring-color" as string]: GREEN } as React.CSSProperties;

/** B-VOICE-06 — the Voice tile's two doors (exported for the render test). */
export function VoiceChoice({
  id,
  firstUse,
  t,
  onChoose,
  onEscape,
}: {
  id?: string;
  /** The one data-use line shows only until the parent has picked a door once. */
  firstUse: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onChoose: (door: "note" | "talk") => void;
  onEscape: () => void;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-label={t("elev.wave2Daily.capture.voice.choice")}
      data-testid="capture-voice-choice"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onEscape();
      }}
      className="mt-2 rounded-[18px] p-1.5"
      style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
    >
      {firstUse && (
        <p data-testid="capture-voice-data-use" className="px-3 pt-2 pb-1.5 text-[12px] leading-snug" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.wave2Daily.capture.voice.dataUse", { residency: t("elev.coachcontract.uses.liveResidencyUndated") })}
        </p>
      )}
      <div className="grid grid-cols-1 gap-1 @md:grid-cols-2">
        <button type="button" data-voice-choice="note" onClick={() => onChoose("note")} className={CHOICE} style={CHOICE_STYLE}>
          <span className={ICON} style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}><Icon name="mic" size={19} fill={1} /></span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight">{t("elev.wave2Daily.capture.voice.note")}</span>
            <span className="block text-[12px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("elev.wave2Daily.capture.voice.noteSub")}</span>
          </span>
        </button>
        <button type="button" data-voice-choice="talk" onClick={() => onChoose("talk")} className={CHOICE} style={CHOICE_STYLE}>
          <span className={ICON} style={{ background: "var(--arbor-green-soft)", color: GREEN }}><Icon name="graphic_eq" size={19} /></span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight">{t("elev.wave2Daily.capture.voice.talk")}</span>
            <span className="block text-[12px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("elev.wave2Daily.capture.voice.talkSub")}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
