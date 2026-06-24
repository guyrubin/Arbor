/**
 * LANG-15 — Word World Tab (parent-calm register).
 *
 * Parent-only surface. Entry: HeroArcade tile (Word World). This is NOT a child
 * game — it renders in the parent-calm register (SectionCard / cardCls / kit.tsx).
 * No PlayShell, no PlayButton, no confetti, no Sprout mascot on this surface.
 *
 * IA:
 *   (1) Module picker — Serve and Return / Narrated Play / Shared Reading
 *   (2) Today's Moment card — age-matched prompt + context chip + We tried this
 *   (3) This Week panel — parent-logged moment chips (descriptor, no child metric)
 *   (4) Referral rail — CI-25 exact string, always visible, never auto-fired
 *
 * Clinical gate compliance:
 *   - All copy is static, curated (zero model authorship) — screenHookRequired
 *     satisfied by-construction; no AI-authored string reaches this surface.
 *   - No child-language-output metric, no word-count, no accuracy %, no
 *     "on track" / "behind" verdict anywhere in this component.
 *   - Referral rail reuses CI-25 string verbatim; share-sheet text is the
 *     CI-25 approved phrase; never auto-fired.
 *   - Banned strings (language delay, speech delay, apraxia, autism, ASD,
 *     disorder, improves/builds/boosts/trains/strengthens, Hanen, etc.)
 *     are absent — verified by wordWorld.test.ts build-time lint.
 *   - Parent-only: no child-selected world gate. The tile is in HeroArcade
 *     but the component itself never calls PlayShell/PlayKit primitives.
 *   - RTL/HE: inherits html[lang=he] RTL from the document root (all flex
 *     and padding tokens are RTL-safe via logical CSS or Tailwind).
 */
import React, { useMemo, useState } from "react";
import {
  MessageCircle, Mic, BookOpen, RefreshCw, Check, Share2,
  type LucideIcon,
} from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { usePracticeData } from "../../practice/usePracticeData";
import { SectionCard, IconBadge, cardCls } from "../ui/kit";
import { PASTEL } from "../../lib/tokens";
import { track } from "../../lib/analytics";
import type { PracticeEvent } from "../../types";
import {
  LANG_MODULES,
  LANG_PROMPTS,
  ageBandForAge,
  promptsForBand,
  REFERRAL_RAIL_TEXT,
  REFERRAL_SHARE_TEXT,
  LOG_CONFIRMATION,
  WE_TRIED_LABEL,
  THIS_WEEK_LABEL,
  type LangModuleId,
} from "../../practice/wordWorld";

/* ─── Icon map (lucide names → components) ─────────────────────────────── */
const ICON_MAP: Record<string, LucideIcon> = {
  MessageCircle,
  Mic,
  BookOpen,
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const eventId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Short day label for the This Week chips (Mon, Tue, ...). */
function shortDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

/** Return module display name from id. */
function moduleLabel(id: LangModuleId): string {
  return LANG_MODULES.find((m) => m.id === id)?.name ?? id;
}

/* ─── Module Picker ─────────────────────────────────────────────────────── */
interface ModuleCardProps {
  module: (typeof LANG_MODULES)[number];
  selected: boolean;
  onSelect: () => void;
}

function ModuleCard({ module, selected, onSelect }: ModuleCardProps) {
  const Icon = ICON_MAP[module.icon] ?? BookOpen;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className="flex flex-col items-start gap-2 p-4 rounded-[18px] border text-left transition-all"
      style={{
        borderColor: selected ? "var(--arbor-clay)" : "var(--arbor-rule)",
        borderWidth: selected ? 2 : 1,
        background: selected ? "var(--arbor-green-soft)" : "#fff",
        outline: "none",
      }}
    >
      <IconBadge tone="sky" size={44}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </IconBadge>
      <p
        className="font-extrabold text-[15px] leading-snug"
        style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
      >
        {module.name}
      </p>
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {module.mechanism}
      </p>
    </button>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function WordWorldTab() {
  const { childProfile } = useArbor();
  const data = usePracticeData(childProfile.id);

  const ageBand = useMemo(() => ageBandForAge(childProfile.age), [childProfile.age]);

  // Module selection — default to first module (Serve and Return) on first visit.
  const [selectedModuleId, setSelectedModuleId] = useState<LangModuleId>("serve-and-return");

  // Prompt rotation within the selected module + age band.
  const availablePrompts = useMemo(
    () => promptsForBand(selectedModuleId, ageBand),
    [selectedModuleId, ageBand]
  );
  const [promptIndex, setPromptIndex] = useState(0);
  const currentPrompt = availablePrompts[promptIndex % Math.max(availablePrompts.length, 1)];

  // Confirmation flash state.
  const [confirmed, setConfirmed] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);

  // Filter lang-strategy events for "This Week" panel.
  const langEvents = useMemo(
    () =>
      data.events.items.filter(
        (e) =>
          e.kind === "lang-strategy" &&
          e.timestamp &&
          // last 7 days
          new Date(e.timestamp).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      ),
    [data.events.items]
  );

  // Record a parent-logged strategy moment.
  const logStrategyMoment = () => {
    if (confirmed) return;
    const event: PracticeEvent = {
      id: eventId("lang-strategy"),
      kind: "lang-strategy",
      domain: "language",
      // No correct/score — this is a descriptive parent-action log, not an assessment.
      meta: `${selectedModuleId}:${ageBand}`,
      timestamp: new Date().toISOString(),
    };
    void data.events.upsert(event);
    track("practice_event", { kind: "lang-strategy", domain: "language", module: selectedModuleId });
    setConfirmed(true);
    window.setTimeout(() => setConfirmed(false), 2200);
  };

  const handleRefresh = () => {
    if (availablePrompts.length <= 1) return;
    setPromptIndex((i) => (i + 1) % availablePrompts.length);
    setConfirmed(false);
  };

  const handleSkip = () => {
    handleRefresh();
  };

  // Referral rail share — OS share sheet with CI-25 approved text.
  const handleReferralShare = () => {
    if (navigator.share) {
      void navigator.share({ text: REFERRAL_SHARE_TEXT }).catch(() => {/* user dismissed */});
    } else {
      // Fallback: copy to clipboard.
      void navigator.clipboard.writeText(REFERRAL_SHARE_TEXT).then(() => {
        setShareFlash(true);
        window.setTimeout(() => setShareFlash(false), 1800);
      }).catch(() => {/* ignore */});
    }
  };

  // This Week: show up to 5 recent, with see-all expansion.
  const [showAllWeek, setShowAllWeek] = useState(false);
  const weekChips = showAllWeek ? langEvents : langEvents.slice(0, 5);

  return (
    <div className="space-y-5 pb-6">
      {/* ── Module picker ─────────────────────────────────────────────── */}
      <SectionCard title="Word World" icon={<BookOpen className="w-5 h-5" />} tone="mint">
        <p className="text-[12px] mb-4" style={{ color: "var(--arbor-muted)" }}>
          {SOURCE_FRAMING_DISPLAY}
        </p>

        {/* 3-column grid on sm+, horizontal scroll on small phones */}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
        >
          {LANG_MODULES.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              selected={selectedModuleId === mod.id}
              onSelect={() => {
                setSelectedModuleId(mod.id as LangModuleId);
                setPromptIndex(0);
                setConfirmed(false);
              }}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Today's Moment card ───────────────────────────────────────── */}
      {currentPrompt && (
        <div
          className="rounded-[22px] p-5"
          style={{
            background: "var(--arbor-paper-elevated)",
            border: "1px solid var(--arbor-rule)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[11px] font-extrabold uppercase tracking-wide rounded-full px-3 py-1"
              style={{ background: PASTEL.sky.soft, color: PASTEL.sky.ink }}
            >
              {currentPrompt.context}
            </span>
            {availablePrompts.length > 1 && (
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-1 text-[12px] font-bold px-3 py-1 rounded-full"
                style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
                aria-label="Show a different prompt"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Refresh
              </button>
            )}
          </div>

          <p
            className="text-[16px] font-extrabold leading-snug mb-5"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {currentPrompt.text}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Primary: We tried this */}
            <button
              onClick={logStrategyMoment}
              disabled={confirmed}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-extrabold transition-all"
              style={{
                background: confirmed ? "var(--arbor-green-soft)" : "var(--arbor-clay)",
                color: confirmed ? "var(--arbor-green-ink)" : "#fff",
                border: "none",
                cursor: confirmed ? "default" : "pointer",
              }}
              aria-label={confirmed ? LOG_CONFIRMATION : WE_TRIED_LABEL}
            >
              {confirmed && <Check className="w-4 h-4" aria-hidden="true" />}
              {confirmed ? LOG_CONFIRMATION : WE_TRIED_LABEL}
            </button>

            {/* Ghost: Skip */}
            <button
              onClick={handleSkip}
              className="inline-flex items-center text-[13px] font-bold px-4 py-2.5 rounded-full"
              style={{ background: "transparent", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ── This Week panel ───────────────────────────────────────────── */}
      <SectionCard title={THIS_WEEK_LABEL} tone="mint">
        {langEvents.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>
            No moments logged yet this week. Tap <em>We tried this</em> after a strategy moment.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              {weekChips.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full"
                  style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  {shortDay(e.timestamp)} &mdash; {moduleLabel(e.meta?.split(":")[0] as LangModuleId)}
                </span>
              ))}
            </div>
            {langEvents.length > 5 && (
              <button
                onClick={() => setShowAllWeek((v) => !v)}
                className="text-[12px] font-bold"
                style={{ color: "var(--arbor-clay)" }}
              >
                {showAllWeek ? "Show less" : `See all (${langEvents.length})`}
              </button>
            )}
          </>
        )}
      </SectionCard>

      {/* ── Referral rail — always visible, never auto-fired ─────────── */}
      <div
        className={`${cardCls} px-5 py-4 flex items-center justify-between gap-3 flex-wrap`}
      >
        <p className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>
          {REFERRAL_RAIL_TEXT}
        </p>
        <button
          onClick={handleReferralShare}
          className="inline-flex items-center gap-1.5 text-[12px] font-extrabold flex-shrink-0"
          style={{ color: "var(--arbor-clay)" }}
          aria-label="Share note with pediatrician or SLP"
        >
          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
          {shareFlash ? "Copied" : "Share note"}
        </button>
      </div>
    </div>
  );
}

/* Internal display constant — not exported (use SOURCE_FRAMING from wordWorld.ts for tests). */
const SOURCE_FRAMING_DISPLAY =
  "developmentally informed, grounded in CDC/AAP/ASHA/WHO";
