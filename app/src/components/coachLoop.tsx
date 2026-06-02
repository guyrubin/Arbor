import React from "react";
import { Compass, ClipboardCheck, Eye, ThumbsUp, ThumbsDown, Minus, CalendarClock } from "lucide-react";
import type { ActionPlan, CoachContract, FeedbackRating, FrameRouting, OutcomeRating } from "../types";
import { FRAME_BLURBS, leadFrame } from "../state/loop";

/**
 * H-10 — Surface the single load-bearing developmental frame inline, at the
 * top of the answer, instead of burying all six as a footer.
 */
export const LeadFrameCallout: React.FC<{ frame: FrameRouting }> = ({ frame }) => {
  const lead = leadFrame(frame);
  if (!lead.text) return null;
  return (
    <div className="mb-3 rounded-xl border border-[#d7aa55]/25 bg-[#d7aa55]/[0.06] p-3">
      <div className="flex items-center gap-2">
        <Compass className="h-3.5 w-3.5 text-[#d7aa55]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-[#f4d991]">
          The frame that matters here · {lead.label}
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-gray-100">{lead.text}</p>
      <p className="mt-0.5 text-[10px] text-[#a8a093]">{FRAME_BLURBS[lead.key]}</p>
    </div>
  );
};

type ActionsProps = {
  contract: CoachContract;
  saved: boolean;
  tracked: boolean;
  feedback?: FeedbackRating;
  observeCount: number;
  onSavePlan: () => void;
  onTrack: () => void;
  onFeedback: (rating: FeedbackRating) => void;
};

/**
 * The action bar under every coach answer. Turns the structured contract into
 * one-tap actions (H-01 save plan, H-02 track observations) and captures the
 * usefulness rating the success metric depends on (H-12).
 */
export const CoachAnswerActions: React.FC<ActionsProps> = ({
  contract,
  saved,
  tracked,
  feedback,
  observeCount,
  onSavePlan,
  onTrack,
  onFeedback
}) => {
  const canTrack = observeCount > 0;
  return (
    <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSavePlan}
          disabled={saved}
          className="flex items-center gap-1.5 rounded-lg border border-[#d7aa55]/25 bg-[#d7aa55]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#f4d991] transition hover:bg-[#d7aa55]/20 disabled:cursor-default disabled:opacity-60"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          {saved ? "Saved to plans" : "Save as plan"}
        </button>
        <button
          type="button"
          onClick={onTrack}
          disabled={tracked || !canTrack}
          title={canTrack ? "" : "No observations to track in this answer"}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-bold text-gray-200 transition hover:bg-white/[0.07] disabled:cursor-default disabled:opacity-40"
        >
          <Eye className="h-3.5 w-3.5 text-[#d7aa55]" />
          {tracked ? "Tracking these" : `Track ${observeCount || ""} observation${observeCount === 1 ? "" : "s"}`.trim()}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a8a093]">Useful tonight?</span>
        {([
          ["useful", ThumbsUp, "Yes"],
          ["partly", Minus, "Partly"],
          ["not", ThumbsDown, "No"]
        ] as [FeedbackRating, typeof ThumbsUp, string][]).map(([rating, Icon, label]) => (
          <button
            key={rating}
            type="button"
            onClick={() => onFeedback(rating)}
            aria-pressed={feedback === rating}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
              feedback === rating
                ? "border-[#d7aa55]/50 bg-[#d7aa55]/20 text-[#f4d991]"
                : "border-white/10 bg-white/[0.02] text-[#a8a093] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

type FollowUpProps = {
  plans: ActionPlan[];
  onRecord: (plan: ActionPlan, rating: OutcomeRating) => void;
};

const OUTCOME_OPTIONS: { rating: OutcomeRating; label: string; tone: string }[] = [
  { rating: "worse", label: "Worse", tone: "border-red-500/30 text-red-300 hover:bg-red-500/10" },
  { rating: "same", label: "Same", tone: "border-white/10 text-[#a8a093] hover:bg-white/5" },
  { rating: "better", label: "Better", tone: "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" },
  { rating: "resolved", label: "Resolved", tone: "border-[#d7aa55]/40 text-[#f4d991] hover:bg-[#d7aa55]/10" }
];

/**
 * H-03 — The follow-up surface. When a saved plan comes due, ask the parent
 * how it went. The recorded outcome feeds future coach context.
 */
export const FollowUpCheckins: React.FC<FollowUpProps> = ({ plans, onRecord }) => {
  if (plans.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[#d7aa55]/25 bg-gradient-to-br from-[#d7aa55]/[0.08] to-transparent p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#d7aa55]" />
        <h3 className="text-sm font-extrabold text-white">A few days on — how did it go?</h3>
      </div>
      <p className="mt-1 text-xs text-[#a8a093]">
        You saved {plans.length === 1 ? "a plan" : `${plans.length} plans`}. Telling Arbor what happened makes the next answer sharper.
      </p>
      <div className="mt-3 space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-sm font-bold text-white">{plan.title}</p>
            {plan.sourcePrompt && <p className="mt-0.5 text-[11px] text-[#a8a093] italic">"{plan.sourcePrompt}"</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {OUTCOME_OPTIONS.map((opt) => (
                <button
                  key={opt.rating}
                  type="button"
                  onClick={() => onRecord(plan, opt.rating)}
                  className={`rounded-lg border bg-white/[0.02] px-3 py-1.5 text-[11px] font-bold transition ${opt.tone}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
