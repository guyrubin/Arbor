/**
 * VC-4 — the /voice `done`-event safety contract, extracted pure so the client
 * behavior is unit-testable without a DOM.
 *
 * The server buries two fail-closed signals in the SSE `done` payload:
 *   - `escalation` + `resourcesMarkdown`: the input tripped the crisis screen.
 *     The spoken redirect already streamed as a normal delta; the FULL crisis
 *     resources block (renderEscalationMarkdown VERBATIM — real numbers: 988,
 *     112, 1201, 0800-0113…) arrives here and must land ON SCREEN, and the
 *     hands-free loop must STOP — a parent in acute distress is never returned
 *     to a listening mic as if nothing happened.
 *   - `outputBlocked` + `blockedMarkdown`: the output screen flagged the draft.
 *     The calm spoken fallback already streamed as a delta; the visible blocked
 *     state (byte parity with /chat's renderBlockedOutputMarkdown) renders from
 *     `blockedMarkdown`.
 *
 * Fail-closed details:
 *   - On escalation the loop stops even if `resourcesMarkdown` is missing
 *     (a legacy/older server) — stopping is the safety floor, resources are
 *     additive.
 *   - `outputBlocked` does NOT stop the loop: it screens one answer, not a
 *     crisis; the parent may keep talking.
 */
export type VoiceDoneData = {
  escalation?: unknown;
  resourcesMarkdown?: unknown;
  outputBlocked?: unknown;
  blockedMarkdown?: unknown;
  [key: string]: unknown;
};

export type VoiceDoneHooks = {
  /** Stop the hands-free voice loop NOW (never re-listen after a crisis turn). */
  stopLoop: () => void;
  /** Append screened markdown to the persisted AI voice bubble (on screen, not spoken). */
  appendMarkdown: (markdown: string) => void;
};

export function handleVoiceDone(data: VoiceDoneData, hooks: VoiceDoneHooks): void {
  if (typeof data.escalation === "string" && data.escalation) {
    hooks.stopLoop();
    if (typeof data.resourcesMarkdown === "string" && data.resourcesMarkdown.trim()) {
      hooks.appendMarkdown(data.resourcesMarkdown);
    }
  }
  if (data.outputBlocked === true && typeof data.blockedMarkdown === "string" && data.blockedMarkdown.trim()) {
    hooks.appendMarkdown(data.blockedMarkdown);
  }
}
