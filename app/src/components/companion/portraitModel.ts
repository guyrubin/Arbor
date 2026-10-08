import { DOMAIN_IDS, type DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";

export interface PortraitChapter {
  id: string;
  from: Date;
  until: Date;
  observations: Observation[];
}

/** Calendar buckets, never a developmental trajectory. The current bucket ends now. */
export function buildPortraitChapters(observations: readonly Observation[], childId: string, now: Date, months = 3): PortraitChapter[] {
  const dates = observations.filter(o => o.childId === childId && Number.isFinite(Date.parse(o.at)) && Date.parse(o.at) <= now.getTime()).map(o => new Date(o.at));
  const oldest = dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : now;
  const historyMonths = (now.getFullYear() - oldest.getFullYear()) * 12 + now.getMonth() - oldest.getMonth() + 1;
  const width = months === 0 ? Math.max(1, Math.ceil(historyMonths / 3)) : months === 12 ? 4 : 1;
  return Array.from({ length: 3 }, (_, i) => {
    const from = new Date(now.getFullYear(), now.getMonth() - (2 - i) * width - width + 1, 1);
    const until = i === 2 ? new Date(now.getTime() + 1) : new Date(now.getFullYear(), now.getMonth() - (1 - i) * width - width + 1, 1);
    return {
      id: `${from.getFullYear()}-${from.getMonth() + 1}`,
      from,
      until,
      observations: observations.filter(o => o.childId === childId && Date.parse(o.at) >= from.getTime() && Date.parse(o.at) < until.getTime()).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    };
  });
}

/** All domains are present in registry order. No inferred connections or missing-skill labels. */
export function buildPortraitThreads(chapters: readonly PortraitChapter[]) {
  return DOMAIN_IDS.map(domain => ({ domain, cells: chapters.map(chapter => chapter.observations.filter(o => o.domains.includes(domain))) }));
}

/** Environment is an explicit recorded field. Never infer it from a note or an activity. */
export function buildPortraitEnvironments(observations: readonly Observation[]) {
  const groups = new Map<string, Observation[]>();
  for (const observation of observations) {
    const context = observation.value.type === "moment" ? observation.value.context?.trim() : undefined;
    const key = context || "unspecified";
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups].map(([context, items]) => ({ context, observations: items, domains: DOMAIN_IDS.filter(domain => items.some(o => o.domains.includes(domain))) }));
}

export function portraitDiscussionPrompt(domains: readonly DomainId[], domainLabel: (domain: DomainId) => string, he: boolean): string {
  const areas = [...new Set(domains)].map(domainLabel).join(he ? " ו" : " and ");
  // The selected IDs may be attached as provenance; saved free-text notes never become a prompt here (G14).
  return he
    ? `אני רוצה להבין טוב יותר את ${areas || "התמונה של הילד שלי"}. עזרו לי לבחור שאלה אחת שכדאי להתבונן בה, בלי להסיק מסקנות ממספר התיעודים.`
    : `I'd like to understand ${areas || "my child's picture"} better. Help me choose one question to explore, without drawing conclusions from how many records there are.`;
}
