import { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { type SignalKind, type TimelineSignal } from "../../lib/signalTimeline";
import { useTimeline } from "../../hooks/useTimeline";
import type { CaptureMode } from "../../context/ArborContext";
import { PASTEL, IconBadge, Chip, cardCls, domainVisual } from "../ui/kit";
import type { DevelopmentalDomainId } from "../../types";
import type { PlayDomain } from "../../playbank/content";

/**
 * UC-1 Journal (wireframe-reconciled) — a single calm column of logged moments.
 *
 * ADDITIVE + READ-ONLY: StoryTimelineTab/ChildMemory stay fully intact. This view
 * reuses the SAME shared engine (buildTimeline) and reads the ledger READ-only —
 * it never forks memory-approval logic and never writes a new event type.
 *
 * Anatomy (top → bottom), reconciled to the wireframe's "Journal" screen:
 *  1. a COMPOSE card — "Log a moment" with three capture-mode tiles
 *     (Voice / Photo / Text) that open the EXISTING capture flow IN THE CHOSEN
 *     MODE via requestCapture(); the split is an entry affordance, not a new
 *     capture path.
 *  2. a flat single-column FEED (~840px) of moment rows. Each row carries a
 *     colored domain icon tile, an AUTO(Arbor)-vs-MANUAL(You) provenance badge, a
 *     per-entry 7-domain chip, and a right-aligned relative time. Auto entries
 *     mix in kid-side moments (auto-detected milestones, coach-derived facts,
 *     approved memory, play).
 *
 * Removed vs. the old dashboard-y Journal: the stat-trio hero, the spine ribbon,
 * the "story draft" CTA card, and the guiding-prompt strip — all duplicated
 * capabilities that live elsewhere (Story lives behind the timeline tab).
 *
 * CLINICAL FIREWALL: domain chips are DESCRIPTIVE, never evaluative; no 0–100
 * score, verdict tag, intensity-trend coloring, or weakest-domain pointer.
 */

/** Compose modality tiles — Material Symbols glyphs (mic / photo_camera / keyboard). */
const MODE_TILES: { ms: string; key: CaptureMode }[] = [
  { ms: "mic", key: "voice" },
  { ms: "photo_camera", key: "photo" },
  { ms: "keyboard", key: "text" },
];

/** Per-domain Material Symbols glyph for the colored icon tile + descriptive chip.
 *  Mirrors the kit's lucide DOMAIN_VISUALS one-for-one so the journal re-skins
 *  without forking the domain taxonomy. Descriptive only — never a verdict. */
const DOMAIN_MS: Record<DevelopmentalDomainId, string> = {
  attachment_regulation: "favorite",
  language_communication: "translate",
  cognition_executive_function: "psychology",
  social_development: "group",
  independence_adaptive_skills: "eco",
  sensory_motor_patterns: "sign_language",
  ecosystem_stressors: "public",
};

/** PlayDomain (5) → the canonical 7-domain taxonomy for the per-entry chip. */
const PLAY_TO_DOMAIN: Record<PlayDomain, DevelopmentalDomainId> = {
  regulation: "attachment_regulation",
  language: "language_communication",
  motor: "sensory_motor_patterns",
  cognitive: "cognition_executive_function",
  social: "social_development",
};

/** Fallback domain by signal kind for sources that carry no explicit domain. */
const KIND_DOMAIN: Record<SignalKind, DevelopmentalDomainId> = {
  moment: "attachment_regulation",
  milestone: "cognition_executive_function",
  plan: "independence_adaptive_skills",
  memory: "cognition_executive_function",
  coach: "ecosystem_stressors",
  play: "cognition_executive_function",
};

/** Provenance is DERIVED read-only from the entry's actor: a parent-logged moment
 *  is hand-written (MANUAL); everything Arbor derives — auto-detected milestones,
 *  coach-session facts, approved memory, logged play — is AUTO. No new flag is
 *  written to the ledger; this maps the existing signal kind at render time. */
const isAuto = (kind: SignalKind): boolean => kind !== "moment";

/** A locale-aware, human relative-time label for the right-aligned timestamp:
 *  "Today 8:05 AM" / "Yesterday" / weekday. Undated signals fall back to a
 *  plain "Ongoing" label. */
function relativeWhen(at: string | null, locale: string | undefined, ongoing: string): string {
  if (!at) return ongoing;
  const d = new Date(at);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / dayMs);
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `${relDay(0, locale)} ${time}`;
  if (diffDays === 1) return relDay(1, locale);
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(locale, { weekday: "long" });
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

/** "Today" / "Yesterday" via Intl.RelativeTimeFormat so He/En localize natively. */
function relDay(daysAgo: 0 | 1, locale: string | undefined): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    // -0 / -1 day → "today" / "yesterday" in the active locale.
    return rtf.format(-daysAgo, "day");
  } catch {
    return daysAgo === 0 ? "Today" : "Yesterday";
  }
}

function JournalRow({
  signal,
  domain,
  auto,
  when,
  provLabel,
  domainLabel,
}: {
  signal: TimelineSignal;
  domain: DevelopmentalDomainId;
  auto: boolean;
  when: string;
  provLabel: string;
  domainLabel: string;
}) {
  const dv = domainVisual(domain);
  const tone = dv.tone;
  const p = PASTEL[tone];
  return (
    <div className={`${cardCls} p-4 flex gap-3.5`}>
      {/* Colored domain icon tile — tone + glyph follow the entry's domain. */}
      <span
        className="inline-flex items-center justify-center rounded-[13px] flex-shrink-0"
        style={{ width: 42, height: 42, background: p.soft, color: p.ink }}
      >
        <Icon name={DOMAIN_MS[domain]} size={22} fill={1} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Provenance badge — AUTO gets the accent "Arbor" mark, MANUAL a neutral one. */}
          <span
            className="inline-flex items-center gap-1 text-[var(--t-xs)] font-extrabold uppercase tracking-wide rounded-md px-2 py-0.5"
            style={
              auto
                ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }
                : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }
            }
          >
            {auto && <Icon name="auto_awesome" size={12} fill={1} />}
            {provLabel}
          </span>
          <Chip tone={tone} icon={<Icon name={DOMAIN_MS[domain]} size={13} fill={1} />}>{domainLabel}</Chip>
          <span className="text-[11px] font-bold ms-auto" style={{ color: "var(--arbor-muted)" }}>{when}</span>
        </div>
        <p className="text-[13.5px] font-semibold mt-2 leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
          {signal.title}
        </p>
        {signal.detail && (
          <p className="text-[12.5px] mt-1 leading-snug line-clamp-2" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {signal.detail}
          </p>
        )}
      </div>
      {signal.photo && (
        <img
          src={signal.photo}
          alt=""
          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border"
          style={{ borderColor: "var(--arbor-rule)" }}
        />
      )}
    </div>
  );
}

export default function JournalTab() {
  const { setActiveTab, requestCapture, milestones, playLogs } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";

  // The ONE timeline read (hooks/useTimeline) — the same stream the Story
  // density renders. No second read, no new write path.
  const signals = useTimeline();

  /** Open the real capture flow in the requested modality. Previously these
   *  tiles were decoys: all three ran a bare setActiveTab("behaviors"), so
   *  "Voice" and "Photo" promised a mode they never opened. `requestCapture`
   *  hands the mode to the capture surface, which acts on it and clears it. */
  const startCapture = (mode: CaptureMode) => {
    requestCapture(mode);
    setActiveTab("behaviors");
  };

  // Per-signal domain: milestones + play carry an explicit domain; everything
  // else falls back to a sensible per-kind domain (descriptive, never a verdict).
  const domainOf = useMemo(() => {
    const map = new Map<string, DevelopmentalDomainId>();
    for (const m of milestones || []) {
      if (m.checked) map.set(`milestone-${m.id}`, m.domain);
    }
    for (const pl of playLogs || []) {
      map.set(`play-${pl.id}`, PLAY_TO_DOMAIN[pl.domain] ?? "cognition_executive_function");
    }
    return map;
  }, [milestones, playLogs]);

  const ongoingLabel = t("journal.ongoing");
  const autoLabel = t("journal.auto");
  const manualLabel = t("journal.manual");
  const recentSignals = signals.slice(0, 3);
  const storyCopy = uiLang === "he"
    ? recentSignals.length
      ? `ארבור מחבר ${recentSignals.length} רגעים אחרונים לסיפור מתמשך — בלי שתצטרכו לכתוב הכול בעצמכם.`
      : "רגע קטן אחד מספיק כדי להתחיל. ארבור יעזור להפוך אותו לסיפור שנבנה עם הזמן."
    : recentSignals.length
      ? `Arbor is connecting ${recentSignals.length} recent moments into a living story — without asking you to write it all yourself.`
      : "One small moment is enough to begin. Arbor will help shape it into a story that grows over time.";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex w-full min-w-0 max-w-[1080px] flex-col gap-5">
      <section className="relative overflow-hidden rounded-[26px] p-5 sm:p-7" style={{ background: "linear-gradient(135deg, var(--arbor-lav-soft), var(--arbor-paper-elevated) 58%, var(--arbor-green-soft))", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}>
        <div className="relative z-10 grid min-w-0 items-end gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(220px,.75fr)]">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-lav-ink)" }}>
              <Icon name="auto_stories" size={16} fill={1} /> {uiLang === "he" ? "היומן שכותב את עצמו" : "The journal that writes itself"}
            </span>
            <h1 className="mt-3 text-[28px] sm:text-[36px] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              {uiLang === "he" ? "שמרו את הרגע. ארבור יחבר את הסיפור." : "Keep the moment. Arbor connects the story."}
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-[15px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{storyCopy}</p>
          </div>
          <div className="border-t pt-4 md:border-s md:border-t-0 md:ps-5 md:pt-0" style={{ borderColor: "var(--arbor-rule-strong)" }}>
            <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{uiLang === "he" ? "השבוע בסיפור" : "This week in the story"}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-3xl font-black" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-lav-ink)" }}>{signals.length}</span>
              <span className="text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{uiLang === "he" ? "רגעים ותובנות שנשמרו במקום אחד" : "moments and insights kept in one calm place"}</span>
            </div>
          </div>
        </div>
      </section>
      {/* Compose card — "Log a moment" + three modality tiles. All three trigger the
          EXISTING capture flow (BehaviorsTab); the Voice/Photo/Text split is an
          entry affordance, not a new capture path. */}
      <section className="border-y py-5 sm:py-6" style={{ borderColor: "var(--arbor-rule)" }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-lav-ink)" }}>{uiLang === "he" ? "×¨×’×¢ ×—×“×©" : "New moment"}</p>
          <h2 className="mt-1 text-[18px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("journal.compose.title")}
          </h2>
          </div>
          <IconBadge tone="lav" size={34}><Icon name="edit_note" size={19} fill={1} /></IconBadge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {MODE_TILES.map(({ ms, key }) => (
            <button
              key={key}
              type="button"
              onClick={() => startCapture(key)}
              className="flex items-center justify-start sm:justify-center gap-3 rounded-[15px] px-4 py-3.5 min-h-[52px] text-[13px] font-extrabold transition motion-safe:hover:-translate-y-0.5"
              style={{ background: key === "voice" ? "var(--arbor-green-soft)" : "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
            >
              <Icon name={ms} size={21} fill={1} style={{ color: "var(--arbor-green-ink)" }} />
              {t(`journal.mode.${key}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Flat single-column feed */}
      {signals.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <div className="inline-flex"><IconBadge tone="lav" size={48}><Icon name="edit_note" size={26} fill={1} /></IconBadge></div>
          <p
            className="text-[17px] mt-4 max-w-md mx-auto leading-snug"
            style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink-soft)" }}
          >
            {t("journal.empty")}
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2">
          {signals.map((s) => {
            const kind = s.kind;
            const domain = domainOf.get(s.id) ?? KIND_DOMAIN[kind];
            const auto = isAuto(kind);
            return (
              <JournalRow
                key={s.id}
                signal={s}
                domain={domain}
                auto={auto}
                when={relativeWhen(s.at, locale, ongoingLabel)}
                provLabel={auto ? autoLabel : manualLabel}
                domainLabel={t(`journal.domain.${domain}`)}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
