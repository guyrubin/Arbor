/**
 * B-CAREPRO-20 · spine §5 "Practice that matches the referral".
 *
 * For the professional the parent is preparing for, name the two or three
 * Practice worlds that exercise the same developmental domain, so "what can we
 * do at home while we wait" has a real answer.
 *
 *   audience (Consult preset) → professions (registry metadata, D2: lenses)
 *     → registry domains (DOMAINS[].professions) → worlds whose declared
 *     `domains` match (STUDIO_WORLDS, spine §7b).
 *
 * Rules (the guard in homePractice.test.ts pins each):
 *  - PARENT-ONLY. The result renders on Consult's step 2 and never enters a
 *    packet: serializeForExport / exportPrintSections take no world input.
 *  - Names only — no counts, no performance, no domain verdict.
 *  - The teacher audience hands over to the School Brief; "my records" has no
 *    professional — both return no worlds.
 *  - Pure: no React, no i18n runtime.
 */
import { DOMAINS, DOMAIN_IDS, type DomainId, type Profession } from "../lib/domains/registry";
import { STUDIO_WORLDS, type StudioWorld } from "../components/practice/studioWorlds";
import type { ExportAudience } from "./packet";

/** Who each Consult audience is, in the registry's profession vocabulary. */
export const AUDIENCE_PROFESSIONS: Readonly<Record<ExportAudience, readonly Profession[]>> = {
  pediatrician: ["pediatrician"],
  slp: ["slp"],
  behavioral_health: ["child_psychologist", "behavioral_therapist"],
  // "Another clinician": the OT / PT seat until B-CAREPRO-42 splits the preset.
  therapist: ["ot", "pt"],
  teacher: [],
  self: [],
};

/** The cap the item sets: two or three worlds, never a catalogue. */
export const HOME_PRACTICE_MAX = 3;

/** Registry domains an audience's professions own, in registry order. */
export function domainsForAudience(audience: ExportAudience): DomainId[] {
  const profs = new Set<Profession>(AUDIENCE_PROFESSIONS[audience] ?? []);
  if (profs.size === 0) return [];
  const owned = new Set(DOMAINS.filter((d) => d.professions.some((p) => profs.has(p))).map((d) => d.id));
  return DOMAIN_IDS.filter((id) => owned.has(id));
}

/**
 * The worlds that work an audience's domains: a world whose PRIMARY domain
 * matches ranks before one where it is secondary; ties keep the Practice
 * Studio order. At most HOME_PRACTICE_MAX.
 */
export function homePracticeWorlds(audience: ExportAudience, worlds: readonly StudioWorld[] = STUDIO_WORLDS): StudioWorld[] {
  const domains = new Set(domainsForAudience(audience));
  if (domains.size === 0) return [];
  const ranked = worlds
    .map((w, i) => ({ w, i, primary: domains.has(w.domains[0]), any: w.domains.some((d) => domains.has(d)) }))
    .filter((x) => x.any)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.i - b.i);
  return ranked.slice(0, HOME_PRACTICE_MAX).map((x) => x.w);
}

/** Open a world: its own parent-shell route when it has one, else Kid Mode
 *  ON that world (B-KID-11 carries the world id into the arcade). */
export function openHomePracticeWorld(
  world: StudioWorld,
  seams: { setActiveTab: (tab: NonNullable<StudioWorld["tab"]>) => void; openKidMode: (target?: { view?: string; worldId?: string | null }) => void },
): void {
  if (world.tab) seams.setActiveTab(world.tab);
  else seams.openKidMode({ view: "arcade", worldId: world.id });
}
