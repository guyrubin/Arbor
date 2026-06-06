/**
 * Scholar Council (v6 SAGE-2): multi-agent orchestration. Instead of one grounded
 * call, the Orchestrator selects the N most relevant scholar agents, runs each as
 * its own lensed model call (in parallel), and a synthesis step weaves the takes
 * into one coherent, non-diagnostic answer. Each scholar is a real agent with a
 * defined profile (method) from the canonical registry.
 */
import { Type } from "@google/genai";
import type { ModelProvider } from "../ai/modelRouter.js";
import { SCHOLARS, type ScholarEntry } from "./scholars.js";
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach.js";
import type { CouncilTake } from "../types.js";

export type { CouncilTake };

// Tie-break priority when domain signal is weak: lead with relationship + challenge + context.
const PRIORITY = ["bowlby", "vygotsky", "bronfenbrenner", "winnicott", "erikson", "montessori", "piaget"];
const priorityIndex = (id: string) => {
  const i = PRIORITY.indexOf(id);
  return i === -1 ? PRIORITY.length : i;
};

/**
 * Choose the council: the lead scholar (when a specific lens is active) plus the
 * scholars whose domains best match the child, to a total of `size`.
 */
export const selectCouncil = (lead: ScholarEntry, childDomains: string[] = [], size = 3): ScholarEntry[] => {
  const council: ScholarEntry[] = [];
  const seen = new Set<string>();
  const add = (s?: ScholarEntry) => {
    if (s && s.id !== "integrated" && !seen.has(s.id)) { seen.add(s.id); council.push(s); }
  };

  add(lead);

  const ranked = SCHOLARS
    .filter((s) => s.id !== "integrated" && !seen.has(s.id))
    .map((s) => ({ s, overlap: s.domains.filter((d) => childDomains.includes(d)).length }))
    .sort((a, b) => (b.overlap - a.overlap) || (priorityIndex(a.s.id) - priorityIndex(b.s.id)));

  for (const { s } of ranked) {
    if (council.length >= size) break;
    add(s);
  }
  return council.slice(0, size);
};

const TAKE_SCHEMA = {
  type: Type.OBJECT,
  required: ["takeaway", "suggestion"],
  properties: {
    takeaway: { type: Type.STRING },
    suggestion: { type: Type.STRING },
  },
};

/** Run each scholar agent in parallel; failures degrade gracefully to an empty take. */
export const runScholarTakes = async (
  provider: ModelProvider,
  scholars: ScholarEntry[],
  ctx: { message: string; childProfile: unknown; language?: string },
): Promise<CouncilTake[]> => {
  const languageDirective = ctx.language === "he" ? "\nWrite takeaway and suggestion in warm Hebrew (עברית)." : "";
  const takes = await Promise.all(
    scholars.map(async (s) => {
      const base: CouncilTake = { scholarId: s.id, name: s.name, concept: s.concept, takeaway: "", suggestion: "" };
      const prompt = `${NON_DIAGNOSTIC_CONTRACT}
You are ${s.name}, one voice on a parenting council. Apply ONLY your lens.
Your method: ${s.method}
Child: ${JSON.stringify(ctx.childProfile)}
The parent's situation: "${ctx.message}"
Give one short takeaway (what your lens notices here) and one concrete, doable suggestion for this week. Observations only — never a diagnosis. Return JSON {takeaway, suggestion}.${languageDirective}`;
      try {
        const r = (await provider.generateJson({
          route: "creative_low_risk",
          prompt,
          schema: TAKE_SCHEMA,
          temperature: 0.5,
        })) as { takeaway?: string; suggestion?: string };
        return { ...base, takeaway: r.takeaway || "", suggestion: r.suggestion || "" };
      } catch {
        return base;
      }
    }),
  );
  return takes.filter((t) => t.takeaway || t.suggestion);
};

/** Render the council's takes into a prompt block the synthesizer integrates. */
export const renderCouncilForSynthesis = (takes: CouncilTake[]) =>
  takes.length
    ? `SCHOLAR COUNCIL DELIBERATION (integrate these distinct expert lenses into one coherent answer; do not just list them):
${takes.map((t) => `- ${t.name} (${t.concept}): ${t.takeaway} → suggests: ${t.suggestion}`).join("\n")}`
    : "";
