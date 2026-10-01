/**
 * B-AI-13 — what one behaviour log may carry into /analyze-behavior.
 *
 * G-14 (CompanionContext default): moment notes stay OFF. The analysis reads
 * counts, types, triggers and the parent's chosen context — never the
 * parent's free text (`notes`, `response`, `resolutionNotes`, `sourceExcerpt`)
 * and never an attachment. One allowlist, used by the client builder
 * (lib/api.ts) AND the server prompt builder (ai/prompts.ts), so an old client
 * that still sends notes cannot get them into the prompt.
 *
 * Pure: no imports beyond types, safe for both bundles.
 */
import type { BehaviorContext } from "../types";

export type AnalyzeLogInput = {
  timestamp?: string;
  behaviorType?: string;
  trigger?: string;
  context?: BehaviorContext;
  resolved?: boolean;
};

/** The only keys a log carries into the analysis. */
export const ANALYZE_LOG_FIELDS = ["timestamp", "behaviorType", "trigger", "context", "resolved"] as const;

export function toAnalyzeLogInput(log: unknown): AnalyzeLogInput {
  const src = (log && typeof log === "object" ? log : {}) as Record<string, unknown>;
  const out: AnalyzeLogInput = {};
  if (typeof src.timestamp === "string") out.timestamp = src.timestamp;
  if (typeof src.behaviorType === "string") out.behaviorType = src.behaviorType;
  if (typeof src.trigger === "string") out.trigger = src.trigger;
  if (typeof src.context === "string") out.context = src.context as BehaviorContext;
  if (typeof src.resolved === "boolean") out.resolved = src.resolved;
  return out;
}

export function toAnalyzeLogInputs(logs: unknown): AnalyzeLogInput[] {
  return Array.isArray(logs) ? logs.map(toAnalyzeLogInput) : [];
}

/** Counts only: how many logs carry each behaviour type and each trigger.
 *  Whole numbers, no total, no share. The server overwrites the model's
 *  counting with these so a miscounted or ratio-shaped answer never reaches
 *  the parent. Blank keys are skipped. */
export function countAnalyzeLogs(logs: readonly AnalyzeLogInput[]): {
  frequencyCount: Record<string, number>;
  triggerBreakdown: { trigger: string; count: number }[];
} {
  const freq: Record<string, number> = {};
  const trig = new Map<string, number>();
  for (const l of logs) {
    const type = (l.behaviorType ?? "").trim();
    if (type) freq[type] = (freq[type] ?? 0) + 1;
    const tr = (l.trigger ?? "").trim();
    if (tr) trig.set(tr, (trig.get(tr) ?? 0) + 1);
  }
  const triggerBreakdown = [...trig.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([trigger, count]) => ({ trigger, count }));
  return { frequencyCount: freq, triggerBreakdown };
}
