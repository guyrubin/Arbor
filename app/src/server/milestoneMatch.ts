/**
 * B-LOOP-06 — a moment becomes milestone EVIDENCE, never by itself.
 *
 * The client sends the ids of the child's OPEN milestones it would accept
 * (≤ 24). The server trusts none of it: every id must be a catalogue row
 * (never a parent-added one — its title is the parent's free text), inside
 * the child's age window (current band + one earlier, `milestoneAgeWindow`,
 * corrected age under 24 months — never ahead of band), and its title and
 * shelf come from the CATALOGUE, not from the request. The model may only
 * choose among those candidates or return nothing; `validateMilestoneMatch`
 * drops any id outside the list. The parent confirms every proposal in the
 * capture sheet — nothing writes itself.
 */
import type { ChildProfile, Milestone } from "../types.js";
import type { MilestoneMatchCandidate } from "../ai/prompts.js";
import { ALL_MILESTONES, isCatalogueMilestone, milestoneAgeWindow } from "../lib/milestoneData.js";
import { comparisonMonthsOf } from "../lib/age/forChild.js";
import { SHELF_IDS, milestoneShelf, type ShelfId } from "../lib/shelves/registry.js";

export const MAX_MILESTONE_CANDIDATES = 24;

export type MilestoneMatch = { shelf: ShelfId; milestoneId?: string; confidence: "high" | "low" };

const CATALOGUE: ReadonlyMap<string, Milestone> = new Map(ALL_MILESTONES.map((m) => [m.id, m]));

/** The server-built candidate list (possibly empty). */
export function buildMilestoneCandidates(rawIds: unknown, childProfile: unknown): MilestoneMatchCandidate[] {
  if (!Array.isArray(rawIds) || rawIds.length === 0) return [];
  const months = comparisonMonthsOf((childProfile ?? null) as ChildProfile | null);
  if (months === null) return [];
  const window = milestoneAgeWindow(months);
  const out: MilestoneMatchCandidate[] = [];
  const seen = new Set<string>();
  for (const raw of rawIds) {
    if (out.length >= MAX_MILESTONE_CANDIDATES) break;
    const id = typeof raw === "string" ? raw.trim().slice(0, 64) : "";
    if (!id || seen.has(id)) continue;
    const row = CATALOGUE.get(id);
    if (!row || !isCatalogueMilestone(row) || typeof row.ageMonths !== "number" || !window.includes(row.ageMonths)) continue;
    let shelf: ShelfId;
    try {
      shelf = milestoneShelf(row);
    } catch {
      continue;
    }
    seen.add(id);
    out.push({ id, shelf, title: row.title });
  }
  return out;
}

/**
 * The model's raw `milestoneMatch`, validated against the candidates:
 *  - an id outside the list → null (dropped);
 *  - "high" needs a listed id; the shelf is the candidate's own shelf;
 *  - "low" carries a valid shelf and no id;
 *  - anything else → null.
 */
export function validateMilestoneMatch(raw: unknown, candidates: readonly MilestoneMatchCandidate[]): MilestoneMatch | null {
  if (!raw || typeof raw !== "object" || candidates.length === 0) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.milestoneId === "string" ? r.milestoneId.trim() : "";
  if (id) {
    const hit = candidates.find((c) => c.id === id);
    if (!hit) return null;
    // A low-confidence pick names the shelf only — never a milestone to tick.
    if (r.confidence === "low") return { shelf: hit.shelf as ShelfId, confidence: "low" };
    return { shelf: hit.shelf as ShelfId, milestoneId: hit.id, confidence: "high" };
  }
  const shelf = typeof r.shelf === "string" ? (r.shelf.trim() as ShelfId) : null;
  if (!shelf || !SHELF_IDS.includes(shelf)) return null;
  return { shelf, confidence: "low" };
}
