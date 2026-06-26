/**
 * CI-28 — GoalBuilderPromptCard
 *
 * Appears on the Today (overview) tab below the Rhythm strip and above the
 * Daily Play card when activeGoals is empty. Dismissible once per session.
 * Tapping "Set a focus" opens GoalBuilderModal.
 *
 * Clinical copy is 100% static, from the allowedCopy list:
 * - "What are you working on with [name] right now?"
 * - No diagnostic language, no condition names, no effect-verb claims.
 */

import React from "react";
import { Target, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const RULE = "var(--arbor-rule)";

export interface GoalBuilderPromptCardProps {
  childName: string;
  onSetFocus: () => void;
  onDismiss: () => void;
}

export default function GoalBuilderPromptCard({
  childName,
  onSetFocus,
  onDismiss,
}: GoalBuilderPromptCardProps) {
  const { t } = useLanguage();
  const firstName = (childName || "your child").split(" ")[0];

  return (
    <div
      className="rounded-[var(--r-xl)] p-5 flex items-start gap-4"
      style={{
        background: GREEN_SOFT,
        border: `1px solid var(--arbor-clay-border)`,
      }}
    >
      {/* Icon */}
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--arbor-clay-dim)", color: GREEN }}
      >
        <Target className="w-5 h-5" />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[15px] font-extrabold leading-snug"
          style={{ fontFamily: "var(--font-display)", color: INK }}
        >
          What are you working on with {firstName} right now?
        </p>
        <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: MUTED }}>
          Set a focus and Daily Play will be matched to it.
        </p>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button
            onClick={onSetFocus}
            className="inline-flex items-center justify-center gap-1.5 font-bold text-sm text-white rounded-full px-4 min-h-[44px] transition active:scale-[0.98]"
            style={{ background: GREEN, boxShadow: "var(--shadow-green)" }}
          >
            Set a focus
          </button>
          <button
            onClick={onDismiss}
            className="inline-flex items-center min-h-[44px] text-[13px] font-semibold transition"
            style={{ color: MUTED }}
          >
            Not now
          </button>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label={t("aria.dismissGoalPrompt")}
        className="flex-shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition"
        style={{ color: MUTED, border: `1px solid ${RULE}` }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
