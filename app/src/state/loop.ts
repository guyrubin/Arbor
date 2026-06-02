import type {
  ActionPlan,
  CoachContract,
  FrameRouting,
  InterventionOutcome,
  TrackingPrompt
} from "../types";

/**
 * Closed-loop helpers — the "harvest" layer.
 *
 * The coach endpoint already returns a rich structured contract on every
 * answer (todayPlan, parentScript, observe, frameRouting, …). Until now the
 * UI flattened all of it into markdown and threw the structure away. These
 * pure functions turn that contract into durable, trackable objects so the
 * core loop (ask → act → track → learn) actually closes.
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested without a browser or a model.
 */

export const FRAME_KEYS: (keyof FrameRouting)[] = [
  "aim",
  "twoAxes",
  "story",
  "shadow",
  "marriage",
  "shepherd"
];

export const FRAME_LABELS: Record<keyof FrameRouting, string> = {
  aim: "Aim",
  twoAxes: "Warmth & Structure",
  story: "Story",
  shadow: "Shadow",
  marriage: "Caregiver Alignment",
  shepherd: "Next Steward"
};

export const FRAME_BLURBS: Record<keyof FrameRouting, string> = {
  aim: "What this moment is ultimately for.",
  twoAxes: "Balancing warmth with structure.",
  story: "The ritual or meaning to carry forward.",
  shadow: "The hard feeling to face, not bypass.",
  marriage: "Aligning the adults who care for the child.",
  shepherd: "Who should hold the next step."
};

const FOLLOW_UP_DAYS = 3;

export const addDays = (iso: string, days: number): string => {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "item";

const titleFromContract = (contract: CoachContract, prompt: string): string => {
  const lead = contract.nonDiagnosticHypotheses[0]?.label?.trim();
  if (lead) {
    return lead.charAt(0).toUpperCase() + lead.slice(1);
  }
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Today's plan";
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
};

/**
 * H-01 — Materialize a coach answer into a saved, checkable ActionPlan.
 * The plan carries provenance and a follow-up date so the loop can close.
 */
export const contractToActionPlan = (
  contract: CoachContract,
  prompt: string,
  childId: string,
  now: string = new Date().toISOString()
): ActionPlan => {
  const steps = contract.todayPlan
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ text, completed: false }));

  return {
    id: `plan-coach-${slug(titleFromContract(contract, prompt))}-${new Date(now).getTime()}`,
    title: titleFromContract(contract, prompt),
    issue: prompt.trim() || contract.nonDiagnosticHypotheses[0]?.rationale || "Saved from a coach answer.",
    phases: [
      {
        name: "Today",
        description: "Same-day steps from your Arbor coach answer.",
        steps: steps.length > 0 ? steps : [{ text: "Review the coach guidance together.", completed: false }]
      }
    ],
    scripts: [
      {
        scenario: titleFromContract(contract, prompt),
        say: contract.parentScript,
        avoid: contract.avoid.join(" ")
      }
    ],
    successIndicators: contract.observe.length > 0 ? contract.observe : ["Calmer recovery over the next few days."],
    childId,
    createdAt: now,
    source: "coach",
    sourcePrompt: prompt,
    followUpDueAt: addDays(now, FOLLOW_UP_DAYS)
  };
};

/**
 * H-02 — Turn the coach answer's `observe` list into trackable prompts.
 */
export const observeToTrackingPrompts = (
  contract: CoachContract,
  prompt: string,
  childId: string,
  now: string = new Date().toISOString()
): TrackingPrompt[] =>
  contract.observe
    .map((metric) => metric.trim())
    .filter(Boolean)
    .map((metric, index) => ({
      id: `track-${slug(metric)}-${new Date(now).getTime()}-${index}`,
      childId,
      metric,
      prompt: `Did you notice: ${metric.replace(/\.$/, "")}?`,
      frequency: "daily" as const,
      createdAt: now,
      sourcePrompt: prompt,
      active: true
    }));

/**
 * H-03 — Plans that are due for a follow-up check-in and have no outcome yet.
 */
export const dueFollowUps = (
  plans: ActionPlan[],
  outcomes: InterventionOutcome[],
  now: string = new Date().toISOString()
): ActionPlan[] => {
  const settled = new Set(outcomes.map((outcome) => outcome.planId));
  const nowMs = new Date(now).getTime();
  return plans.filter(
    (plan) =>
      plan.source === "coach" &&
      !!plan.followUpDueAt &&
      new Date(plan.followUpDueAt).getTime() <= nowMs &&
      !settled.has(plan.id)
  );
};

const FRAME_SIGNALS = /\b(warmth|structure|boundary|boundaries|repair|anger|fear|avoid|align|face|limit|ritual|responsib|comfort|rupture)\b/i;

/**
 * H-10 — Pick the single load-bearing frame to surface inline, instead of
 * dumping all six as a footer. Heuristic: weight substance (word count) plus
 * salience (presence of action/emotion signal words); break ties with a fixed
 * in-the-moment priority order. Deterministic, so it is testable.
 */
export const leadFrame = (
  frame: FrameRouting
): { key: keyof FrameRouting; label: string; text: string } => {
  const priority: (keyof FrameRouting)[] = ["twoAxes", "shadow", "aim", "marriage", "story", "shepherd"];

  const score = (key: keyof FrameRouting) => {
    const text = (frame[key] || "").trim();
    if (!text) return -1;
    const words = text.split(/\s+/).length;
    const salience = FRAME_SIGNALS.test(text) ? 6 : 0;
    const priorityBoost = (priority.length - priority.indexOf(key)) * 0.1;
    return words + salience + priorityBoost;
  };

  let best: keyof FrameRouting = "aim";
  let bestScore = -Infinity;
  for (const key of FRAME_KEYS) {
    const value = score(key);
    if (value > bestScore) {
      bestScore = value;
      best = key;
    }
  }

  return { key: best, label: FRAME_LABELS[best], text: (frame[best] || "").trim() };
};
