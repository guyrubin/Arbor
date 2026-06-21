/**
 * T4 — "The Story of {child}": narrativize the longitudinal memory moat.
 *
 * The moat is already browsable (Child Memory) and charted (the timeline), but
 * never *narrated*. This composes the parent-approved facts + the milestone /
 * momentum signals into a short, warm prose summary — the one artifact a parent
 * intrinsically wants to revisit and (later) share.
 *
 * It is DETERMINISTIC and SOURCE-GROUNDED on purpose: no model call (no cost, no
 * latency) and — per copy-governance gate G2 — it only ever restates what the
 * parent already approved or logged. No outcome verbs ("improving", "delayed",
 * "proven"), no clinical claim, no invented fact.
 */

export interface ChildStoryInput {
  name: string;
  ageYears?: number;
  /** Parent-APPROVED memory facts only (the moat). */
  approvedFacts: Array<{ fact: string; source?: string }>;
  milestonesObserved: number;
  milestonesTotal: number;
  momentsThisWeek: number;
  momentsPrevWeek: number;
  /** From computeMomentum: how this week's intensity compares. */
  intensityTrend: "rising" | "easing" | "steady" | "none" | string;
  planWins: number;
}

export interface ChildStory {
  title: string;
  /** Warm, source-grounded prose — render each as a paragraph. */
  paragraphs: string[];
  /** How many approved facts underpin the story (for an honest "built from N" note). */
  factCount: number;
  /** True when there is genuinely nothing to narrate yet. */
  empty: boolean;
}

const firstNameOf = (name: string): string => (name?.trim().split(/\s+/)[0] || "Your child");

/** Trim a fact to a clean clause and strip a trailing period so it can be joined. */
const clause = (fact: string): string => fact.trim().replace(/\s+/g, " ").replace(/[.]+$/, "");

export function composeChildStory(i: ChildStoryInput): ChildStory {
  const first = firstNameOf(i.name);
  const title = `The Story of ${first}`;
  const facts = i.approvedFacts.filter((f) => f.fact && f.fact.trim());
  const paragraphs: string[] = [];

  const nothingYet =
    facts.length === 0 &&
    i.milestonesObserved === 0 &&
    i.momentsThisWeek === 0 &&
    i.planWins === 0;

  if (nothingYet) {
    return {
      title,
      empty: true,
      factCount: 0,
      paragraphs: [
        `${first}'s story hasn't started yet. As you log moments, talk with Arbor, and approve what it learns, this becomes a living story — built only from what you choose to keep.`,
      ],
    };
  }

  // Opening — frame the provenance (parent owns + approved everything here).
  paragraphs.push(
    i.ageYears != null
      ? `Here's ${first}'s story so far, at ${i.ageYears}${i.ageYears === 1 ? " year" : " years"} old — built only from what you've approved.`
      : `Here's ${first}'s story so far — built only from what you've approved.`,
  );

  // What Arbor has learned (the approved facts — the moat itself).
  if (facts.length) {
    const top = facts.slice(0, 5).map((f) => clause(f.fact));
    const lead =
      top.length === 1
        ? `You've shared that ${top[0]}.`
        : `You've shared a few things that make ${first} who they are: ${top.slice(0, -1).join("; ")}; and ${top[top.length - 1]}.`;
    const more = facts.length > 5 ? ` Arbor is holding ${facts.length} memories about ${first} in all.` : "";
    paragraphs.push(lead + more);
  }

  // Rhythm of attention this week + milestones tracked — observational, hedged.
  const rhythmBits: string[] = [];
  if (i.momentsThisWeek > 0) {
    const vsLast =
      i.momentsPrevWeek > 0
        ? i.momentsThisWeek >= i.momentsPrevWeek
          ? ` — even more than the ${i.momentsPrevWeek} the week before`
          : ` — a quieter week than the ${i.momentsPrevWeek} before`
        : "";
    rhythmBits.push(`This week you noticed ${i.momentsThisWeek} moment${i.momentsThisWeek === 1 ? "" : "s"} worth keeping${vsLast}`);
  }
  if (i.intensityTrend === "easing") rhythmBits.push("and the harder moments have felt a little calmer");
  else if (i.intensityTrend === "rising") rhythmBits.push("and some moments have felt bigger lately");
  if (rhythmBits.length) paragraphs.push(rhythmBits.join(" ") + ".");

  const closers: string[] = [];
  if (i.milestonesTotal > 0) {
    closers.push(`Together you're tracking ${i.milestonesObserved} of ${i.milestonesTotal} milestones`);
  }
  if (i.planWins > 0) {
    closers.push(`${closers.length ? "and " : "You've "}celebrated ${i.planWins} small win${i.planWins === 1 ? "" : "s"} along the way`);
  }
  if (closers.length) paragraphs.push(closers.join(", ") + ".");

  // Closing — the moat compounds.
  paragraphs.push(`Every memory you approve makes Arbor's guidance more truly about ${first}.`);

  return { title, paragraphs, factCount: facts.length, empty: false };
}

/** Plain-text export of the story — the parent owns it and can keep it anywhere. */
export function childStoryToText(story: ChildStory): string {
  return [story.title, "", ...story.paragraphs].join("\n\n");
}
