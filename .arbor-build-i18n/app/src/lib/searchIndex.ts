/**
 * AP-045: Static content-catalog search index.
 *
 * AC-6 SAFETY CONTRACT — this module imports ONLY the four approved catalogs:
 *   - app/src/playbank/content.ts        (activity names + domain)
 *   - app/src/lib/milestoneData.ts       (milestone names + domain)
 *   - app/src/lib/heroJourneys.ts        (journey titles)
 *   - app/src/practice/worlds.ts         (practice-world names)
 *
 * It NEVER imports: memory/, families/, behaviors data, childData,
 * ChildMemory, observation logs, ProfileContext, or any child-record field.
 * The index is STATIC CONTENT METADATA only. Results are deep-links, not
 * data reads. No AI inference on the query — plain string match only.
 *
 * arbor-sec WILL grep this file's imports. Do NOT add imports here.
 */

import { PLAY_ACTIVITIES } from "../playbank/content";
import { ALL_MILESTONES } from "./milestoneData";
import { HERO_STORIES } from "./heroJourneys";
import { WORLDS } from "../practice/worlds";
import type { ActiveTab } from "../context/ArborContext";

/** A single search result entry — content metadata + deep-link target only. */
export interface SearchEntry {
  /** Unique key for React rendering. */
  key: string;
  /** Display name (activity title, milestone title, journey title, world title). */
  label: string;
  /** Category label shown in the result row. */
  category: "Activity" | "Milestone" | "Journey" | "Practice World";
  /** Domain or pack label shown as a sub-label (descriptive, not child data). */
  sub: string;
  /** The existing tab to navigate to on selection. */
  tab: ActiveTab;
}

/**
 * Build the static search index from the four content catalogs.
 * Called once at module load; the result is a frozen array.
 * No child-record fields are read here — only catalog metadata.
 */
function buildIndex(): readonly SearchEntry[] {
  const entries: SearchEntry[] = [];

  // 1. Activities from playbank/content.ts (name + domain)
  for (const activity of PLAY_ACTIVITIES) {
    entries.push({
      key: `activity:${activity.id}`,
      label: activity.title,
      category: "Activity",
      sub: activity.domain,
      tab: "daily-play",
    });
  }

  // 2. Milestones from lib/milestoneData.ts (name + domain)
  for (const milestone of ALL_MILESTONES) {
    entries.push({
      key: `milestone:${milestone.id}`,
      label: milestone.title,
      category: "Milestone",
      sub: milestone.domain,
      tab: "development",
    });
  }

  // 3. Journeys from lib/heroJourneys.ts (title only — no child data)
  for (const story of HERO_STORIES) {
    entries.push({
      key: `journey:${story.id}`,
      label: story.title,
      category: "Journey",
      sub: story.pack,
      tab: "stories",
    });
  }

  // 4. Practice worlds from practice/worlds.ts (name only)
  for (const world of WORLDS) {
    entries.push({
      key: `world:${world.id}`,
      label: world.title,
      category: "Practice World",
      sub: world.status === "live" ? "available" : "coming soon",
      tab: "practice",
    });
  }

  return Object.freeze(entries);
}

/** The static content-catalog index — built once, never mutated. */
export const SEARCH_INDEX: readonly SearchEntry[] = buildIndex();

/**
 * Client-side plain-string filter. No AI, no fuzzy matching, no child data.
 * Returns up to `limit` entries whose label or sub matches the query term.
 */
export function searchIndex(query: string, limit = 12): SearchEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const results: SearchEntry[] = [];
  for (const entry of SEARCH_INDEX) {
    if (results.length >= limit) break;
    if (
      entry.label.toLowerCase().includes(term) ||
      entry.sub.toLowerCase().includes(term)
    ) {
      results.push(entry);
    }
  }
  return results;
}
