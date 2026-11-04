/** Signed-in landing arrivals, not anonymous visitors or inferred signups.
 * One account per stage, in chronological order. No family content is read. */
export const LANDING_STAGES = ['landing_entry', 'onboarding_completed', 'activated', 'paid'];
export const LANDING_COVERAGE = 'Signed-in landing arrivals only. Anonymous page views and exits are not collected. Counts are unique accounts completing stages in order; they are not visitor-to-signup conversion or evidence of uplift. Existing analytics opt-outs and internal-account exclusions apply.';

export function countLandingFunnel(events, groupBy = 'source') {
  const accounts = new Map();
  for (const event of events) {
    if (!event.uid || event.uid === 'unknown' || !LANDING_STAGES.includes(event.event)) continue;
    const at = typeof event.at === 'number' ? event.at : Date.parse(event.at || '');
    if (!Number.isFinite(at)) continue;
    const list = accounts.get(event.uid) || [];
    list.push({ ...event, at });
    accounts.set(event.uid, list);
  }
  const groups = new Map();
  for (const list of accounts.values()) {
    list.sort((a, b) => a.at - b.at || LANDING_STAGES.indexOf(a.event) - LANDING_STAGES.indexOf(b.event));
    const entry = list.find(event => event.event === 'landing_entry');
    if (!entry) continue;
    const key = String(entry.props?.[groupBy] || 'unknown');
    const counts = groups.get(key) || LANDING_STAGES.map(() => 0);
    let stage = 0;
    for (const event of list) {
      if (event.at < entry.at || event.event !== LANDING_STAGES[stage]) continue;
      counts[stage++] += 1;
      if (stage === LANDING_STAGES.length) break;
    }
    groups.set(key, counts);
  }
  return [...groups].map(([key, counts]) => ({ key, stages: LANDING_STAGES.map((stage, i) => ({ stage, count: counts[i] })) }))
    .sort((a, b) => b.stages[0].count - a.stages[0].count || a.key.localeCompare(b.key));
}
