import { describe, expect, it, vi } from "vitest";
import { acceptTodayAction } from "./accept";
import { completeObservation, isObservationAction, isUrgentOnboardingAction, type ActionLoopEntry } from "./model";
import { selectCarryOverAction } from "../components/overview/carryOverAction";
import { buildTimeline, signalDetail, signalTitle } from "../lib/signalTimeline";
import { translate } from "../lib/i18n";
import { buildJournalRequest } from "../ai/journalContext";
import { projectAcceptedActions } from "../server/companionContext";
import { focusSignalsForNow } from "../components/companion/nowRecommendationModel";
import { computeWeeklyContext } from "../ai/chatContext";

const at = new Date("2026-10-10T12:00:00Z");
const original: ActionLoopEntry = { id: "today.child-a.2026-10-09", recommendation: "What happened with Noa today?\nYou can say back: bus.", source: "onboarding", capacity: "tiny", status: "accepted", acceptedAt: "2026-10-09T12:00:00Z", acceptanceKey: "onboarding-v1.child-a.exact" };

describe("the chosen first-run observation is not an intervention outcome", () => {
  it("accepts explicit semantics without shortening the full question or details", async () => {
    const upsert = vi.fn(async () => {});
    const row = await acceptTodayAction({ childId: "child-a", items: [], upsert, recommendation: original.recommendation, source: "onboarding", capacity: "tiny", observation: true, now: at });
    expect(row).toMatchObject({ observation: true, recommendation: original.recommendation, status: "accepted" });
    expect(row.outcome).toBeUndefined();
  });
  it("recognizes only legacy notice rows, preserving factual outcomes and excluding guides/urgent rows", () => {
    expect(isObservationAction(original)).toBe(true);
    expect(isObservationAction({ ...original, source: "hard-moment" })).toBe(false);
    expect(isObservationAction({ ...original, acceptanceKey: "onboarding-urgent.child-a.exact" })).toBe(false);
    expect(isObservationAction({ ...original, acceptanceKey: undefined })).toBe(false);
    const factualOutcome: ActionLoopEntry = { ...original, outcome: "helped", status: "completed" };
    expect(isObservationAction(factualOutcome)).toBe(false);
  });
  it("keeps an explicitly submitted moment on the same row without any efficacy field", () => {
    const completed = completeObservation(original, "  He watched a bus, then said bus.  ", at);
    expect(completed).toEqual({ ...original, observation: true, status: "completed", whatHappened: "He watched a bus, then said bus.", completedAt: at.toISOString() });
    expect(original.status).toBe("accepted");
    expect(completeObservation(completed, completed.whatHappened!, new Date("2026-10-11"))).toBe(completed);
    expect(() => completeObservation(completed, "A different answer")).toThrow();
  });
  it("rejects blank, oversized, superseded and non-observation submissions", () => {
    for (const words of ["  ", "x".repeat(241)]) expect(() => completeObservation(original, words)).toThrow();
    expect(() => completeObservation({ ...original, status: "superseded" }, "A moment")).toThrow();
    expect(() => completeObservation({ ...original, source: "hard-moment" }, "A moment")).toThrow();
  });
  it.each(["en", "he"] as const)("history keeps the question, full detail and parent words with a factual completion date (%s)", lang => {
    const completed = completeObservation(original, "First line\nSecond line", at);
    const [signal] = buildTimeline({ actionOutcomes: [completed] });
    const t = (key: string) => translate(lang, key);
    expect(signal.at).toBe(at.toISOString());
    expect(signal.actionStatus).toBe("done");
    expect(signal.durationMinutes).toBeUndefined();
    expect(signalDetail(signal, t)).toBe(`${original.recommendation}\n\nFirst line\nSecond line`);
    expect(signalTitle(signal, t)).toBe(t("ob.first.observation.history.completed"));
    const [old] = buildTimeline({ actionOutcomes: [{ ...original, status: "completed", outcome: "helped" }] });
    expect(old.actionObservation).toBeUndefined(); expect(old.actionStatus).toBe("helped");
  });
  it("does not route observation text or an invented outcome to practice/focus/weekly/companion context", () => {
    const completed = completeObservation(original, "Parent-only observation text", at);
    expect(buildJournalRequest({ childId: "child-a", dateKey: "2026-10-10", actionLoop: [completed] }).doseRows).toBeUndefined();
    expect(projectAcceptedActions([original, completed])).toEqual([]);
    expect(focusSignalsForNow({ behaviorLogs: [], playLogs: [], milestones: [], actionLoop: [completed] }, at)).not.toHaveProperty("lastActionOutcome");
    expect(computeWeeklyContext({ behaviorLogs: [], milestones: [], actionLoop: [completed] }, at)).not.toHaveProperty("lastActionOutcome");
    expect(projectAcceptedActions([{ ...original, status: "completed", outcome: "helped" }])[0].outcome).toBe("helped");
  });
});

describe("a first-run safety notice saved before the fix is never a chosen step", () => {
  const urgent: ActionLoopEntry = { ...original, id: "today.child-a.2026-10-08", recommendation: "If there is immediate danger to your child or others, contact local emergency services first.", acceptanceKey: "onboarding-urgent.child-a.exact" };
  it("is recognised by its acceptance key only", () => {
    expect(isUrgentOnboardingAction(urgent)).toBe(true);
    expect(isUrgentOnboardingAction(original)).toBe(false);
    expect(isUrgentOnboardingAction({ ...urgent, acceptanceKey: undefined })).toBe(false);
  });
  it("never reaches the companion context, the history, or the carry-over question", () => {
    expect(projectAcceptedActions([urgent, { ...urgent, status: "completed", outcome: "helped" }])).toEqual([]);
    expect(buildTimeline({ actionOutcomes: [urgent] })).toEqual([]);
    expect(selectCarryOverAction([urgent], "today.child-a.2026-10-10", at.getTime())).toBeNull();
  });
});
