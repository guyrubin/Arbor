/**
 * CI-28 — GoalBuilderModal
 *
 * A bottom-sheet modal (mobile) / centered modal (desktop) that lets the parent
 * select 1–3 curated developmental focus goals. Two internal states:
 *   - Selection state (no activeGoals): tile grid picker
 *   - Status state (activeGoals exist): list of active goals with observation count
 *     and remove action
 *
 * Clinical-gate compliance (verdict: build-ready-narrowed):
 * - Labels: 100% static curated strings from GOAL_TILES (no model output).
 * - No score, %, progress bar, completion ring, streak, or trend line (gate §B).
 * - Observation count = flat integer only.
 * - Concern pre-fill highlights a tile, never pre-selects it (gate §D).
 * - Banned strings: none present (checked by goalBuilder.ts lint at module load).
 * - "developmentally informed, grounded in CDC/AAP/ASHA/WHO" — framing authority.
 * - Non-diagnostic: no condition names, no effect-verb claims, no assessment verdicts.
 * - Gate §E (COPPA): activeGoals write path tagged — requires arbor-safety review.
 */

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  X,
  Check,
  Trash2,
  Plus,
  ListChecks,
  DoorOpen,
  Users,
  Utensils,
  Moon,
  Heart,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import {
  GOAL_TILES,
  MAX_ACTIVE_GOALS,
  prefillGoalIdsForConcern,
  type ActiveGoal,
  type GoalTile,
} from "../../practice/goalBuilder";
import type { BehaviorLog } from "../../types";
import { domainForBehaviorType } from "../../playbank/select";

// ── Icon map (tile icon names → Lucide components) ───────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  ListChecks: <ListChecks className="w-5 h-5" />,
  DoorOpen: <DoorOpen className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Utensils: <Utensils className="w-5 h-5" />,
  Moon: <Moon className="w-5 h-5" />,
  Heart: <Heart className="w-5 h-5" />,
  MessageCircle: <MessageCircle className="w-5 h-5" />,
  RefreshCw: <RefreshCw className="w-5 h-5" />,
};

// ── Token shorthands ─────────────────────────────────────────────────────────

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";
const RULE_STRONG = "var(--arbor-rule-strong)";
const PAPER = "var(--arbor-paper-elevated)";
const PAPER_DEEP = "var(--arbor-paper-deep)";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Count how many BehaviorLogs have a PlayDomain that matches the goal's domainId.
 * Gate §B: returns a flat integer only — never a percentage, score, or trend.
 */
function countLinkedObservations(goal: ActiveGoal, logs: BehaviorLog[]): number {
  return logs.filter((l) => {
    const d = domainForBehaviorType(l.behaviorType);
    return d === goal.domainId;
  }).length;
}

/**
 * ISO timestamp of the most recent linked observation, or null.
 * Used for the "Last linked: X days ago" display (gate §B: timestamp only, no score).
 */
function lastLinkedObservation(goal: ActiveGoal, logs: BehaviorLog[]): string | null {
  const matched = logs
    .filter((l) => domainForBehaviorType(l.behaviorType) === goal.domainId)
    .map((l) => l.timestamp)
    .sort()
    .reverse();
  return matched[0] ?? null;
}

function daysAgoLabel(isoTs: string | null): string {
  if (!isoTs) return "";
  const diffMs = Date.now() - new Date(isoTs).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export interface GoalBuilderModalProps {
  open: boolean;
  onClose: () => void;
  childName: string;
  activeGoals: ActiveGoal[];
  /** Onboarding concern id used for pre-fill highlighting (gate §D). */
  concernId?: string;
  onSave: (goals: ActiveGoal[]) => void;
  /** BehaviorLogs used for observation count (flat count, gate §B). */
  behaviorLogs?: BehaviorLog[];
}

export default function GoalBuilderModal({
  open,
  onClose,
  childName,
  activeGoals,
  concernId,
  onSave,
  behaviorLogs = [],
}: GoalBuilderModalProps) {
  const firstName = (childName || "your child").split(" ")[0];
  const hasGoals = activeGoals.length > 0;

  // ── Selection state (tile grid) ──────────────────────────────────────────
  const [selected, setSelected] = useState<string[]>([]);
  // Pre-fill: tiles to highlight (not pre-select) from the onboarding concern.
  const prefillIds = useMemo(
    () => (concernId ? prefillGoalIdsForConcern(concernId) : []),
    [concernId]
  );

  // ── Remove confirmation state (Goal Status view) ─────────────────────────
  const [removePending, setRemovePending] = useState<string | null>(null);

  const toggleTile = (tile: GoalTile) => {
    setSelected((prev) => {
      if (prev.includes(tile.id)) return prev.filter((id) => id !== tile.id);
      if (prev.length >= MAX_ACTIVE_GOALS) return prev; // cap; tile is muted/disabled
      return [...prev, tile.id];
    });
  };

  const handleSave = () => {
    if (selected.length === 0) return;
    const newGoals: ActiveGoal[] = selected.map((id) => {
      const tile = GOAL_TILES.find((t) => t.id === id)!;
      return {
        goalId: tile.id,
        label: tile.label,
        domainId: tile.domainId,
        addedAt: new Date().toISOString(),
      };
    });
    // Merge with existing goals, deduplicate by goalId.
    const merged = [...activeGoals, ...newGoals].filter(
      (g, i, arr) => arr.findIndex((x) => x.goalId === g.goalId) === i
    );
    onSave(merged);
    setSelected([]);
    onClose();
  };

  const handleRemove = (goalId: string) => {
    if (removePending === goalId) {
      const next = activeGoals.filter((g) => g.goalId !== goalId);
      onSave(next);
      setRemovePending(null);
    } else {
      setRemovePending(goalId);
    }
  };

  const cancelRemove = () => setRemovePending(null);

  // ── Decide which state to render ─────────────────────────────────────────
  const showSelectionGrid = !hasGoals || (hasGoals && activeGoals.length < MAX_ACTIVE_GOALS && selected.length > 0);
  const showAddLink = hasGoals && activeGoals.length < MAX_ACTIVE_GOALS;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="arbor-app fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={hasGoals ? "Goal status" : `Pick a focus for ${firstName}`}
            tabIndex={-1}
            className="w-full sm:max-w-lg rounded-t-[22px] sm:rounded-3xl overflow-hidden"
            style={{
              background: PAPER,
              border: `1px solid ${RULE}`,
              boxShadow: "var(--shadow-lg)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: `1px solid ${RULE}` }}>
              <div>
                <h3
                  className="text-lg font-extrabold leading-tight"
                  style={{ fontFamily: "var(--font-display)", color: INK }}
                >
                  {hasGoals && selected.length === 0
                    ? "Your focus areas"
                    : `Pick a focus for ${firstName}`}
                </h3>
                {!hasGoals && (
                  <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
                    Choose 1 to 3. Activities on Daily Play will be matched to what you pick.
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg ml-3 transition"
                style={{ border: `1px solid ${RULE}`, color: MUTED }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* ── Goal Status view (goals exist) ────────────────────────── */}
              {hasGoals && selected.length === 0 && (
                <div className="space-y-3">
                  {activeGoals.map((goal) => {
                    const obsCount = countLinkedObservations(goal, behaviorLogs);
                    const lastTs = lastLinkedObservation(goal, behaviorLogs);
                    const isRemoving = removePending === goal.goalId;

                    return (
                      <div
                        key={goal.goalId}
                        className="rounded-2xl p-4"
                        style={{ background: PAPER_DEEP, border: `1px solid ${RULE}` }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Domain colour dot */}
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              background:
                                GOAL_TILES.find((t) => t.id === goal.goalId)?.domainColor ?? GREEN,
                            }}
                            aria-hidden="true"
                          />
                          <span className="flex-1 text-[14px] font-semibold" style={{ color: INK }}>
                            {goal.label}
                          </span>
                          {!isRemoving && (
                            <button
                              onClick={() => handleRemove(goal.goalId)}
                              aria-label={`Remove ${goal.label}`}
                              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition"
                              style={{ color: MUTED }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Observation count — flat integer only (gate §B) */}
                        <p className="text-[12px] mt-2" style={{ color: MUTED }}>
                          {obsCount > 0 ? (
                            <>
                              <span className="font-bold" style={{ color: GREEN }}>
                                {obsCount}
                              </span>{" "}
                              {obsCount === 1 ? "observation" : "observations"} linked
                              {lastTs && (
                                <span style={{ color: MUTED }}>
                                  {" "}· Last linked: {daysAgoLabel(lastTs)}
                                </span>
                              )}
                            </>
                          ) : (
                            "No observations linked yet"
                          )}
                        </p>

                        {/* Remove confirmation (inline, no modal-within-modal) */}
                        {isRemoving && (
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold" style={{ color: INK }}>
                              Remove &ldquo;{goal.label}&rdquo;?
                            </span>
                            <button
                              onClick={() => handleRemove(goal.goalId)}
                              className="rounded-lg px-3 py-1.5 text-[12px] font-bold transition"
                              style={{ background: "var(--arbor-danger, #d6566f)", color: "#fff" }}
                            >
                              Yes, remove
                            </button>
                            <button
                              onClick={cancelRemove}
                              className="rounded-lg px-3 py-1.5 text-[12px] font-bold transition"
                              style={{ background: PAPER, color: MUTED, border: `1px solid ${RULE}` }}
                            >
                              Keep it
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* + Add another focus link (when room remains) */}
                  {showAddLink && (
                    <button
                      onClick={() => setSelected([])} // triggers the grid to appear below
                      className="inline-flex items-center gap-1.5 text-[13px] font-bold transition"
                      style={{ color: GREEN }}
                    >
                      <Plus className="w-4 h-4" /> Add another focus
                    </button>
                  )}

                  {/* Observation link explanation */}
                  <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
                    Observations are linked automatically when you log a moment in the same area.
                  </p>
                </div>
              )}

              {/* ── Tile selection grid (no goals, or adding more) ─────────── */}
              {(!hasGoals || selected.length > 0 || (hasGoals && showAddLink)) && (
                <div>
                  {hasGoals && (
                    <p className="text-[13px] mb-3" style={{ color: MUTED }}>
                      Choose up to {MAX_ACTIVE_GOALS - activeGoals.length} more focus
                      {MAX_ACTIVE_GOALS - activeGoals.length !== 1 ? "es" : ""}.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2.5">
                    {GOAL_TILES.filter(
                      (t) => !activeGoals.some((g) => g.goalId === t.id)
                    ).map((tile) => {
                      const isSelected = selected.includes(tile.id);
                      const isPrefill = prefillIds.includes(tile.id) && !isSelected;
                      const isDisabled =
                        !isSelected &&
                        selected.length + activeGoals.length >= MAX_ACTIVE_GOALS;

                      return (
                        <button
                          key={tile.id}
                          onClick={() => !isDisabled && toggleTile(tile)}
                          aria-pressed={isSelected}
                          aria-disabled={isDisabled}
                          title={isDisabled ? "You can set up to 3 focuses." : undefined}
                          className="flex items-center gap-3 rounded-2xl p-3.5 text-left transition"
                          style={{
                            background: isSelected
                              ? GREEN_SOFT
                              : isPrefill
                              ? "var(--arbor-lav-soft, #ece9f9)"
                              : PAPER_DEEP,
                            border: `1.5px solid ${
                              isSelected
                                ? GREEN
                                : isPrefill
                                ? "var(--arbor-lav, #7a6bd8)"
                                : RULE
                            }`,
                            opacity: isDisabled ? 0.45 : 1,
                            cursor: isDisabled ? "not-allowed" : "pointer",
                          }}
                        >
                          <span
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              background: isSelected ? GREEN : PAPER,
                              color: isSelected ? "#fff" : MUTED,
                            }}
                          >
                            {isSelected ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              ICON_MAP[tile.icon] ?? <Heart className="w-5 h-5" />
                            )}
                          </span>
                          <span
                            className="text-[13px] font-semibold leading-snug flex-1"
                            style={{ color: isSelected ? GREEN : INK }}
                          >
                            {tile.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky bottom bar — appears when at least 1 tile is selected */}
            <AnimatePresence>
              {selected.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="sticky bottom-0 px-5 py-4"
                  style={{ background: PAPER, borderTop: `1px solid ${RULE}` }}
                >
                  <button
                    onClick={handleSave}
                    className="w-full inline-flex items-center justify-center gap-2 font-extrabold text-[15px] text-white rounded-2xl py-3.5 transition active:scale-[0.98]"
                    style={{
                      background: "var(--arbor-gradient-primary)",
                      boxShadow: "var(--shadow-green)",
                    }}
                  >
                    <Check className="w-5 h-5" />
                    Save {selected.length} focus{selected.length !== 1 ? "es" : ""}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
