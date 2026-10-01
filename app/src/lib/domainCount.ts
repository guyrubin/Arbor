/**
 * B-GROWTH-01 — the Growth hero's "areas of N" in ONE vocabulary.
 *
 * The hero used to count distinct `m.domain` over EVERY checked milestone
 * (DevelopmentalDomainId — six ids used by the catalogue) and divide by
 * `Object.keys(DOMAIN_META).length` (PracticeDomain — five). Two vocabularies,
 * so "6 areas of 5" was reachable for any child with one checked milestone per
 * domain. Both numbers now come from the SAME array: the milestones inside the
 * child's age window (`ageWindowMilestones(...)`), so the numerator can never
 * exceed the denominator.
 *
 * Pass the already-windowed array; this helper never re-filters by age.
 */
export interface WindowDomainCount {
  /** Distinct domains with ≥1 CHECKED milestone in the window. */
  active: number;
  /** Distinct domains with ≥1 milestone in the window. */
  total: number;
}

export function domainCountsIn<M extends { domain: string; checked: boolean }>(inWindow: readonly M[]): WindowDomainCount {
  const total = new Set(inWindow.map((m) => m.domain)).size;
  const active = new Set(inWindow.filter((m) => m.checked).map((m) => m.domain)).size;
  return { active, total };
}
