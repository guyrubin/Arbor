/**
 * Non-diagnostic developmental "red-flag" screening (Wave 3, MVP).
 *
 * IMPORTANT FRAMING: this is NOT a diagnostic instrument and NOT a medical
 * device. Items are plain-language, general developmental-awareness prompts
 * derived from public-domain milestone guidance (CDC "Learn the Signs. Act
 * Early."-style), grouped by the app's six developmental domains. The output is
 * only ever "on track" vs "worth a conversation with a professional" — never a
 * score, probability, or condition name. See
 * docs/prd-red-flag-screening-2026-06-07.md.
 */

export type ScreenDomainId =
  | "attachment_regulation"
  | "language_communication"
  | "cognition_executive_function"
  | "social_development"
  | "independence_adaptive_skills"
  | "sensory_motor_patterns";

export type ScreenAnswer = "yes" | "sometimes" | "not_yet";

export interface ScreenItem {
  id: string;
  domain: ScreenDomainId;
  /** Plain-language, parent-observable prompt. Phrased so "yes" = on track. */
  prompt: string;
}

export interface AgeBand {
  id: string;
  label: string;
  minMonths: number;
  maxMonths: number;
  items: ScreenItem[];
}

export const DOMAIN_LABEL: Record<ScreenDomainId, string> = {
  attachment_regulation: "Attachment & regulation",
  language_communication: "Language & communication",
  cognition_executive_function: "Thinking & attention",
  social_development: "Social development",
  independence_adaptive_skills: "Independence & daily skills",
  sensory_motor_patterns: "Sensory & movement",
};

/**
 * Compact age-banded item bank. Deliberately modest for the MVP — the goal is to
 * prove the flow (check → framed result → care action), not to be exhaustive.
 * Each band carries a few observable prompts across domains.
 */
export const AGE_BANDS: AgeBand[] = [
  {
    id: "0-1",
    label: "Under 1 year",
    minMonths: 0,
    maxMonths: 11,
    items: [
      { id: "b01-soc1", domain: "social_development", prompt: "Smiles back at you and seeks your face." },
      { id: "b01-lang1", domain: "language_communication", prompt: "Coos, babbles, or makes sounds back and forth with you." },
      { id: "b01-att1", domain: "attachment_regulation", prompt: "Settles with comfort from a familiar adult." },
      { id: "b01-mot1", domain: "sensory_motor_patterns", prompt: "Reaches for toys and follows things with their eyes." },
      { id: "b01-cog1", domain: "cognition_executive_function", prompt: "Looks for a toy or face that's hidden or moved." },
    ],
  },
  {
    id: "1-2",
    label: "1–2 years",
    minMonths: 12,
    maxMonths: 23,
    items: [
      { id: "b12-lang1", domain: "language_communication", prompt: "Uses a few words and tries to copy words you say." },
      { id: "b12-soc1", domain: "social_development", prompt: "Points to show you something interesting." },
      { id: "b12-soc2", domain: "social_development", prompt: "Looks at you and shares a smile during play (shared attention)." },
      { id: "b12-mot1", domain: "sensory_motor_patterns", prompt: "Walks on their own and is steady on their feet." },
      { id: "b12-cog1", domain: "cognition_executive_function", prompt: "Follows a simple instruction like 'give me the ball.'" },
      { id: "b12-ind1", domain: "independence_adaptive_skills", prompt: "Settles to sleep and stays asleep reasonably for their age." },
    ],
  },
  {
    id: "2-3",
    label: "2–3 years",
    minMonths: 24,
    maxMonths: 35,
    items: [
      { id: "b23-lang1", domain: "language_communication", prompt: "Puts two or more words together ('more milk')." },
      { id: "b23-lang2", domain: "language_communication", prompt: "Most of what they say is understandable to family." },
      { id: "b23-soc1", domain: "social_development", prompt: "Notices other children and plays near or with them." },
      { id: "b23-soc2", domain: "social_development", prompt: "Responds to their name and makes eye contact during talk." },
      { id: "b23-att1", domain: "attachment_regulation", prompt: "Recovers from upset with help within a reasonable time." },
      { id: "b23-ind1", domain: "independence_adaptive_skills", prompt: "Eats a reasonable range of foods and textures." },
    ],
  },
  {
    id: "3-5",
    label: "3–5 years",
    minMonths: 36,
    maxMonths: 71,
    items: [
      { id: "b35-lang1", domain: "language_communication", prompt: "Speaks in short sentences a stranger can mostly understand." },
      { id: "b35-soc1", domain: "social_development", prompt: "Takes turns and plays cooperative, pretend games with others." },
      { id: "b35-cog1", domain: "cognition_executive_function", prompt: "Follows two-step instructions and stays with a task briefly." },
      { id: "b35-att1", domain: "attachment_regulation", prompt: "Manages most transitions and disappointments without prolonged meltdowns." },
      { id: "b35-ind1", domain: "independence_adaptive_skills", prompt: "Manages basics like dressing, toileting and sleep for their age." },
      { id: "b35-mot1", domain: "sensory_motor_patterns", prompt: "Copes with everyday sounds, textures and busy spaces." },
    ],
  },
  {
    id: "5-8",
    label: "5–8 years",
    minMonths: 72,
    maxMonths: 107,
    items: [
      { id: "b58-cog1", domain: "cognition_executive_function", prompt: "Sustains attention on a task and follows multi-step routines." },
      { id: "b58-soc1", domain: "social_development", prompt: "Makes and keeps friendships and resolves small conflicts." },
      { id: "b58-lang1", domain: "language_communication", prompt: "Holds a back-and-forth conversation and follows a story." },
      { id: "b58-att1", domain: "attachment_regulation", prompt: "Calms after upset and bounces back from setbacks." },
      { id: "b58-ind1", domain: "independence_adaptive_skills", prompt: "Sleeps well and manages morning/school routines with support." },
    ],
  },
  {
    id: "8-12",
    label: "8–12 years",
    minMonths: 108,
    maxMonths: 156,
    items: [
      { id: "b812-cog1", domain: "cognition_executive_function", prompt: "Organizes schoolwork and manages attention for their age." },
      { id: "b812-soc1", domain: "social_development", prompt: "Maintains friendships and navigates social ups and downs." },
      { id: "b812-att1", domain: "attachment_regulation", prompt: "Talks about feelings and recovers from hard days." },
      { id: "b812-ind1", domain: "independence_adaptive_skills", prompt: "Handles daily responsibilities and sleeps adequately." },
    ],
  },
];

export function bandForAge(years: number): AgeBand {
  const months = Math.round((Number.isFinite(years) ? years : 0) * 12);
  return (
    AGE_BANDS.find((b) => months >= b.minMonths && months <= b.maxMonths) ??
    AGE_BANDS[AGE_BANDS.length - 1]
  );
}

export interface DomainResult {
  domain: ScreenDomainId;
  label: string;
  total: number;
  /** "not_yet" counts 1, "sometimes" 0.5 toward a watch signal. */
  concern: number;
  status: "on_track" | "watch";
}

export interface ScreeningResult {
  bandId: string;
  bandLabel: string;
  answeredAt: string;
  domains: DomainResult[];
  /** Domains worth a professional conversation. */
  watchAreas: DomainResult[];
  elevated: boolean;
}

/**
 * Score answers into a non-diagnostic, domain-level "worth a conversation" read.
 * A domain is flagged "watch" when its concern weight is at least 1 (i.e. one
 * clear "not yet", or two "sometimes"). This intentionally biases toward "a
 * conversation never hurts" rather than reassurance.
 */
export function scoreScreening(items: ScreenItem[], answers: Record<string, ScreenAnswer>): ScreeningResult {
  const band = AGE_BANDS.find((b) => b.items.some((i) => items.some((it) => it.id === i.id)));
  const byDomain = new Map<ScreenDomainId, { total: number; concern: number }>();
  for (const it of items) {
    const cur = byDomain.get(it.domain) ?? { total: 0, concern: 0 };
    cur.total += 1;
    const a = answers[it.id];
    if (a === "not_yet") cur.concern += 1;
    else if (a === "sometimes") cur.concern += 0.5;
    byDomain.set(it.domain, cur);
  }
  const domains: DomainResult[] = Array.from(byDomain.entries()).map(([domain, v]) => ({
    domain,
    label: DOMAIN_LABEL[domain],
    total: v.total,
    concern: v.concern,
    status: v.concern >= 1 ? "watch" : "on_track",
  }));
  const watchAreas = domains.filter((d) => d.status === "watch");
  return {
    bandId: band?.id ?? "",
    bandLabel: band?.label ?? "",
    answeredAt: new Date().toISOString(),
    domains,
    watchAreas,
    elevated: watchAreas.length > 0,
  };
}
