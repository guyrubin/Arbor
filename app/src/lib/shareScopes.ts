/**
 * CARE-3 — stable share-scope IDs: enforcement decoupled from display.
 *
 * Historically the Trusted Sharing UI stored its English DISPLAY strings
 * ("Story timeline", "Teacher Handoff", …) as the server-enforced scope values,
 * so the trust screen could never be localized without breaking enforcement.
 * This module is the single source of truth for the stable, language-neutral
 * scope IDs stored on every ShareGrant. Localized labels are resolved at
 * render time via i18n (`share.scope.<id>` keys) — never stored.
 *
 * FIREWALL CONDITION (fails closed): an unrecognized legacy scope string maps
 * to NO access — never a broader default. Only the exact English labels the UI
 * actually offered (plus the old server default "timeline") migrate; anything
 * else grants nothing.
 *
 * Pure module — imported by BOTH the client (TrustedSharing.tsx, ChildProfile.tsx)
 * and the server (sharing/shares.ts), so it must stay dependency-free.
 */
import type { ProfessionalReportType } from "./reportExport";

export const SHARE_SCOPE_IDS = [
  "story_timeline",
  "weekly_insight",
  "behavior_patterns",
  "milestones",
  "report_teacher",
  "report_therapist",
  "report_pediatrician",
  "report_slp",
  "report_behavioral_health",
] as const;

export type ShareScopeId = (typeof SHARE_SCOPE_IDS)[number];

export const isShareScopeId = (value: string): value is ShareScopeId =>
  (SHARE_SCOPE_IDS as readonly string[]).includes(value);

/** Professional consult presets → their share-scope IDs. Mirrors the REPORTS
 *  definition (Reports.tsx) one-to-one so the share scopes can never drift from
 *  the consult preset set (IA W4.5). */
export const REPORT_SCOPE_BY_TYPE: Record<ProfessionalReportType, ShareScopeId> = {
  teacher: "report_teacher",
  therapist: "report_therapist",
  pediatrician: "report_pediatrician",
  slp: "report_slp",
  behavioral_health: "report_behavioral_health",
};

/** Legacy migration map: grants created before CARE-3 stored the English
 *  display labels verbatim (SCOPE_OPTIONS in TrustedSharing.tsx) or the old
 *  server default "timeline". ONLY those exact strings migrate. */
const LEGACY_SCOPE_BY_LABEL: Record<string, ShareScopeId> = {
  "story timeline": "story_timeline",
  timeline: "story_timeline",
  "weekly insight": "weekly_insight",
  "behavior patterns": "behavior_patterns",
  milestones: "milestones",
  "teacher handoff": "report_teacher",
  "therapist summary": "report_therapist",
  "pediatrician summary": "report_pediatrician",
};

/** Resolve one stored scope value (stable ID or legacy English label) to a
 *  stable ID. FAILS CLOSED: unknown → null = no access, never a default. */
export const normalizeScope = (raw: string): ShareScopeId | null => {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (isShareScopeId(s)) return s;
  return LEGACY_SCOPE_BY_LABEL[s.toLowerCase()] ?? null;
};

/** Resolve a stored scopes array to the deduplicated set of stable IDs it
 *  actually grants. Unrecognized entries are dropped (fail closed). */
export const normalizeScopes = (raw: readonly string[] | undefined | null): ShareScopeId[] => {
  const out: ShareScopeId[] = [];
  for (const r of raw ?? []) {
    const id = normalizeScope(r);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
};

/** i18n key for a stable scope ID — labels live in lib/i18n.ts (EN + HE). */
export const shareScopeLabelKey = (id: ShareScopeId): string => `share.scope.${id}`;

/** Display labels for a grant's stored scopes: recognized scopes render their
 *  localized label; unrecognized legacy strings still RENDER as-is (the parent
 *  must see what an old grant claims) but grant nothing via normalizeScopes. */
export const scopeDisplayLabels = (
  scopes: readonly string[] | undefined | null,
  t: (key: string) => string,
): string[] =>
  (scopes ?? [])
    .map((raw) => {
      const id = normalizeScope(raw);
      return id ? t(shareScopeLabelKey(id)) : (raw ?? "").trim();
    })
    .filter(Boolean);
