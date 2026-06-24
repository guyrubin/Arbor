/**
 * CompetenceLadderCard — CI-07
 *
 * Parent-visible surface for the Competence Ladder. Shown in DevelopmentTab
 * below DevScoreCard. Renders the scaffold's current rung, and — critically —
 * shows a visible "We've stepped back" banner with a one-tap "Bring guidance
 * back" control whenever a scaffold has retired.
 *
 * A silent or irreversible fade is FORBIDDEN. Every retirement is announced
 * here and is reversible in one tap (bringGuidanceBack).
 *
 * Framing: warm, high-agency parent language. Never "you don't need us."
 * The mechanic is about the parent's growing competence, not an exit.
 *
 * Styling: design-token–only (var(--arbor-*)). No new index.css rules.
 */

import React, { useCallback } from "react";
import { Layers, ChevronRight, RotateCcw } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import {
  bringGuidanceBack,
  recordSignal,
  createScaffoldState,
  isRetired,
  type ScaffoldState,
  type CapabilitySignal,
} from "../../growth/competenceLadder";

// ---------------------------------------------------------------------------
// Design tokens (never mutate index.css — locked hotspot)
// ---------------------------------------------------------------------------
const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const FAINT = "var(--arbor-faint)";
const RULE = "var(--arbor-rule)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const PAPER_ELEVATED = "var(--arbor-paper-elevated)";
const PAPER_SUNK = "var(--arbor-paper-sunk)";
const CLAY = "var(--arbor-clay)";
const PEACH_SOFT = "var(--arbor-peach-soft, #fff5f0)";

// ---------------------------------------------------------------------------
// Scaffold definitions visible in this card
// The card shows a named list of active scaffolds.
// Only the state (rung) is persisted; the label comes from i18n.
// ---------------------------------------------------------------------------
const DEMO_SCAFFOLD_IDS = ["bedtime-resistance", "mealtime-standoffs", "transition-refusal"];

// ---------------------------------------------------------------------------
// Rung label helper
// ---------------------------------------------------------------------------
function RungPip({ rung }: { rung: ScaffoldState["rung"] }) {
  const colors: Record<ScaffoldState["rung"], string> = {
    "full-guidance": CLAY,
    "light-touch": GREEN,
    "retired": "var(--arbor-faint)",
  };
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[rung],
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------
interface CompetenceLadderCardProps {
  /** Which child's scaffold states to show and persist. */
  childId: string;
}

interface PersistedScaffold extends ScaffoldState {
  /** Required by useChildCollection: the document id == scaffold id. */
  id: string;
}

export default function CompetenceLadderCard({ childId }: CompetenceLadderCardProps) {
  const { t } = useLanguage();
  const { } = useArbor(); // context available for future coach integration

  // ---------------------------------------------------------------------------
  // Persistence via the established child-collection pattern
  // Collection name "competenceLadder" is registered in CHILD_SUBCOLLECTIONS
  // (lib/childData.ts) for GDPR export/erase completeness.
  // ---------------------------------------------------------------------------
  const { items: scaffolds, loaded, upsert } = useChildCollection<PersistedScaffold>(
    childId,
    "competenceLadder"
  );

  // Derive or initialise a scaffold state by id.
  const getScaffold = useCallback(
    (scaffoldId: string): PersistedScaffold => {
      return (
        scaffolds.find((s) => s.id === scaffoldId) ??
        (createScaffoldState(scaffoldId) as PersistedScaffold)
      );
    },
    [scaffolds]
  );

  // ---------------------------------------------------------------------------
  // Signal handler: called when the parent taps "I've got this one" on a scaffold.
  // Only CapabilitySignal may be passed here — engagement-event types don't exist.
  // ---------------------------------------------------------------------------
  const handleCapabilitySignal = useCallback(
    async (scaffoldId: string, signal: CapabilitySignal) => {
      const current = getScaffold(scaffoldId);
      const updated = recordSignal(current, signal);
      await upsert(updated);
    },
    [getScaffold, upsert]
  );

  // ---------------------------------------------------------------------------
  // Reversibility: "Bring guidance back" handler — first-class, one tap.
  // ---------------------------------------------------------------------------
  const handleBringBack = useCallback(
    async (scaffoldId: string) => {
      const current = getScaffold(scaffoldId);
      const restored = bringGuidanceBack(current) as PersistedScaffold;
      await upsert(restored);
    },
    [getScaffold, upsert]
  );

  if (!loaded) return null;

  const anyRetired = DEMO_SCAFFOLD_IDS.some((id) => isRetired(getScaffold(id)));

  return (
    <section
      className="rounded-[22px] overflow-hidden"
      style={{
        background: PAPER_ELEVATED,
        border: `1px solid ${RULE}`,
        boxShadow: "var(--shadow-sm)",
      }}
      aria-label={t("ladder.sectionLabel")}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-2">
        <Layers className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} aria-hidden="true" />
        <span className="text-[13px] font-bold" style={{ color: GREEN }}>
          {t("ladder.eyebrow")}
        </span>
      </div>

      {/* Subtitle — parent-mediated framing */}
      <p className="px-6 pb-4 text-[13.5px] leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
        {t("ladder.subtitle")}
      </p>

      {/* Retired banner — visible + reversible */}
      {anyRetired && (
        <div
          className="mx-4 mb-4 rounded-2xl px-4 py-3 flex flex-wrap items-start gap-3"
          role="status"
          aria-live="polite"
          style={{ background: PEACH_SOFT, border: `1px solid rgba(255,180,150,0.35)` }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold" style={{ color: "var(--arbor-peach-ink, #c2440a)" }}>
              {t("ladder.steppedBackTitle")}
            </p>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: MUTED }}>
              {t("ladder.steppedBackBody")}
            </p>
          </div>
        </div>
      )}

      {/* Scaffold rows */}
      <div className="px-4 pb-4 space-y-2">
        {DEMO_SCAFFOLD_IDS.map((scaffoldId) => {
          const scaffold = getScaffold(scaffoldId);
          const retired = isRetired(scaffold);

          return (
            <div
              key={scaffoldId}
              className="rounded-2xl px-4 py-3"
              style={{ background: retired ? PAPER_SUNK : GREEN_SOFT, border: `1px solid ${RULE}` }}
            >
              <div className="flex items-start gap-2.5">
                <RungPip rung={scaffold.rung} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate" style={{ color: retired ? FAINT : INK }}>
                    {t(`ladder.scaffold.${scaffoldId}`)}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                    {t(`ladder.rung.${scaffold.rung}`)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {retired ? (
                    /* "Bring guidance back" — required, one-tap, first-class */
                    <button
                      onClick={() => handleBringBack(scaffoldId)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-bold rounded-xl px-3 py-1.5 transition active:scale-[0.97]"
                      style={{
                        background: PAPER_ELEVATED,
                        color: GREEN,
                        border: `1px solid ${RULE}`,
                      }}
                      aria-label={t("ladder.bringBackAria", { scaffold: t(`ladder.scaffold.${scaffoldId}`) })}
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      {t("ladder.bringBack")}
                    </button>
                  ) : (
                    /* "I've got this one" — self-reported capability signal */
                    <button
                      onClick={() =>
                        handleCapabilitySignal(scaffoldId, {
                          kind: "self-reported",
                          scaffoldId,
                          recordedAt: Date.now(),
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-[12px] font-bold rounded-xl px-3 py-1.5 transition active:scale-[0.97]"
                      style={{
                        background: PAPER_ELEVATED,
                        color: GREEN,
                        border: `1px solid ${RULE}`,
                      }}
                      aria-label={t("ladder.gotThisAria", { scaffold: t(`ladder.scaffold.${scaffoldId}`) })}
                    >
                      {t("ladder.gotThis")}
                      <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Signal count — honest progress indicator, not a gamified streak */}
              {!retired && scaffold.signalHistory.length > 0 && (
                <p className="mt-2 text-[11px]" style={{ color: FAINT }}>
                  {t("ladder.signalCount", { n: scaffold.signalHistory.length })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Non-diagnostic footnote — same register as DevScoreCard */}
      <p className="px-6 pb-5 text-[11.5px]" style={{ color: FAINT }}>
        {t("ladder.note")}
      </p>
    </section>
  );
}
