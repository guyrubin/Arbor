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

import { translate, type UiLang } from "./i18n";

export interface ChildStoryInput {
  name: string;
  ageYears?: number;
  /** Parent-APPROVED memory facts only (the moat). */
  approvedFacts: Array<{ fact: string; source?: string }>;
  milestonesObserved: number;
  // B-ASKJB-19 residue (law 1): no `milestonesTotal` — the story counts the
  // milestones the parent noticed and never prints a denominator.
  /** Language of the count sentences (default "en"). */
  lang?: UiLang;
  momentsThisWeek: number;
  momentsPrevWeek: number;
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

// N5/RES-BIDI: the story is display prose (rendered + shared as text, never a
// key/seed) — name and fact interpolations go through translate(), which
// isolates a value in the other script so it can't reorder the sentence.
const WHITESPACE = /\s+/;
const WHITESPACE_G = /\s+/g;
const TRAILING_DOTS = /[.]+$/;
// B-ASKJB-20: the fallback name is keyed too ("Your child" / HE); a real name
// is the first token of the profile name, verbatim.
const firstNameOf = (name: string, lang: UiLang): string =>
  (name?.trim().split(WHITESPACE)[0] || translate(lang, "story.fallbackName"));

/** Trim a fact to a clean clause and strip a trailing period so it can be joined. */
const clause = (fact: string): string => fact.trim().replace(WHITESPACE_G, " ").replace(TRAILING_DOTS, "");

/** Facts joined with the locale's separators: "a; b; and c" / "a; b; וגם c". */
const joinFacts = (lang: UiLang, items: readonly string[]): string =>
  items.length <= 1
    ? items.join("")
    : items.slice(0, -1).join(translate(lang, "story.list.sep")) + translate(lang, "story.list.last") + items[items.length - 1];

/**
 * B-ASKJB-20: every sentence is built from `story.*` keys in the parent's
 * language (EN + HE, singular/plural). Only the child's name and the
 * parent-approved fact text are interpolated verbatim — a Hebrew story has no
 * English words except what the parent wrote. The plain-text export
 * (childStoryToText) renders this same output.
 */
export function composeChildStory(i: ChildStoryInput): ChildStory {
  const lang: UiLang = i.lang ?? "en";
  const first = firstNameOf(i.name, lang);
  // N5/RES-BIDI: translate() isolates every interpolated value whose script
  // runs opposite to the sentence (lib/bidi), so names and facts go in raw.
  const name = first;
  const title = translate(lang, "story.title", { name });
  const facts = i.approvedFacts.filter((f) => f.fact && f.fact.trim());
  const paragraphs: string[] = [];

  const nothingYet =
    facts.length === 0 &&
    i.milestonesObserved === 0 &&
    i.momentsThisWeek === 0 &&
    i.planWins === 0;

  if (nothingYet) {
    return { title, empty: true, factCount: 0, paragraphs: [translate(lang, "story.empty", { name })] };
  }

  // Opening — frame the provenance (parent owns + approved everything here).
  paragraphs.push(
    i.ageYears != null
      ? i.ageYears === 1
        ? translate(lang, "story.open.age.one", { name })
        : translate(lang, "story.open.age.other", { name, n: i.ageYears })
      : translate(lang, "story.open", { name }),
  );

  // What Arbor has learned (the approved facts — the moat itself), verbatim.
  if (facts.length) {
    const top = facts.slice(0, 5).map((f) => clause(f.fact));
    const lead =
      top.length === 1
        ? translate(lang, "story.facts.one", { fact: top[0] })
        : translate(lang, "story.facts.many", { name, list: joinFacts(lang, top) });
    const more = facts.length > 5 ? ` ${translate(lang, "story.facts.more", { n: facts.length, name })}` : "";
    paragraphs.push(lead + more);
  }

  // Rhythm of attention this week — the flat count of what the PARENT noticed.
  // CI-22/23/24 firewall (Wave-3 clinical subtraction, 2026-06-26): no
  // intensity-trend prose and no week-over-week comparison ("more than the N
  // the week before" / "a quieter week") — both were verdicts on the child's
  // own windows. Only the count stays.
  if (i.momentsThisWeek > 0) {
    paragraphs.push(i.momentsThisWeek === 1
      ? translate(lang, "story.moments.one")
      : translate(lang, "story.moments.other", { n: i.momentsThisWeek }));
  }

  // B-ASKJB-19 residue (law 1): "tracking {observed} of {total} milestones"
  // was a denominator on a parent surface. Now two keyed count sentences
  // (EN + HE): the milestones the parent noticed, and the small wins.
  const closers: string[] = [];
  if (i.milestonesObserved > 0) {
    closers.push(i.milestonesObserved === 1
      ? translate(lang, "story.milestones.one")
      : translate(lang, "story.milestones.other", { n: i.milestonesObserved }));
  }
  if (i.planWins > 0) {
    closers.push(i.planWins === 1
      ? translate(lang, "story.wins.one")
      : translate(lang, "story.wins.other", { n: i.planWins }));
  }
  if (closers.length) paragraphs.push(closers.join(" "));

  // Closing — the moat compounds.
  paragraphs.push(translate(lang, "story.close", { name }));

  return { title, paragraphs, factCount: facts.length, empty: false };
}

/** Plain-text export of the story — the parent owns it and can keep it anywhere. */
export function childStoryToText(story: ChildStory): string {
  return [story.title, "", ...story.paragraphs].join("\n\n");
}
