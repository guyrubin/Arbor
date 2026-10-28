/**
 * B-CAREPRO-41 — a sharing grant scoped by DEVELOPMENTAL DOMAIN.
 *
 * Scopes (lib/shareScopes.ts) say which packet SECTIONS a grant unlocks; a
 * domain ceiling says which AREAS of the child's record may fill them
 * (spine §7b: "the SLP sees domains 1 and 7, not the whole record"). A
 * professional grant defaults to its profession's registry domains plus the
 * family context; any other grant carries no ceiling (legacy behaviour).
 *
 * FAILS CLOSED: an unknown domain id unlocks nothing; a grant whose stored
 * domains resolve to none unlocks no view at all (never a broader default).
 *
 * Why a module of its own: lib/shareScopes.ts is dependency-free by contract,
 * and the ceiling needs the ONE domain registry (lib/domains/registry). Pure:
 * the server (sharing/shares.ts, server/sharedPacket.ts) and the parent's
 * preview (TrustedSharing via consult/packet buildGrantPacket) share it, so the
 * preview IS the recipient's view.
 */
import { DOMAINS, DOMAIN_IDS, isDomainId, type DomainId, type Profession } from "./domains/registry";

/** Every domain-scoped grant carries the family context (spine §7b). */
export const FAMILY_CONTEXT_DOMAIN: DomainId = "family";

/** The professional report scopes → the registry professions they serve. */
const PROFESSIONS_BY_REPORT_SCOPE: Readonly<Record<string, readonly Profession[]>> = {
  report_slp: ["slp"],
  report_pediatrician: ["pediatrician"],
  report_behavioral_health: ["child_psychologist", "behavioral_therapist"],
  report_ot: ["ot"],
  report_pt: ["pt"],
  report_psychology: ["developmental_psychologist", "educational_psychologist", "child_psychologist"],
};

/** Stored/requested domain ids → known registry ids, deduped, registry order.
 *  Unknown ids are DROPPED (fail closed). */
export function normalizeShareDomains(raw: readonly unknown[] | undefined | null): DomainId[] {
  const seen = new Set<DomainId>();
  for (const r of raw ?? []) {
    const id = typeof r === "string" ? r.trim() : "";
    if (isDomainId(id)) seen.add(id);
  }
  return DOMAIN_IDS.filter((d) => seen.has(d));
}

/** The registry domains these professions own, plus the family context. */
export function professionDomains(professions: readonly Profession[]): DomainId[] {
  const owners = new Set<string>(professions);
  const own = DOMAINS.filter((d) => d.professions.some((p) => owners.has(p))).map((d) => d.id);
  return normalizeShareDomains([...own, FAMILY_CONTEXT_DOMAIN]);
}

/** The default ceiling of a NEW grant: a professional grant whose scopes name
 *  a profession report reads that profession's domains (+ family); any other
 *  grant has no ceiling (undefined). */
export function defaultGrantDomains(role: string | undefined, scopes: readonly string[]): DomainId[] | undefined {
  if (role !== "professional") return undefined;
  const professions = scopes.flatMap((s) => PROFESSIONS_BY_REPORT_SCOPE[s] ?? []);
  return professions.length ? professionDomains(professions) : undefined;
}

/** A stored grant's ceiling: null = none (legacy, unscoped); [] = the grant
 *  named only unknown domains and unlocks NOTHING. */
export function grantDomainCeiling(grant: { domains?: readonly unknown[] | null }): DomainId[] | null {
  return Array.isArray(grant.domains) ? normalizeShareDomains(grant.domains) : null;
}
