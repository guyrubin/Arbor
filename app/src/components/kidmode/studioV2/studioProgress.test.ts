import { describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({ items: [] as unknown[], loaded: true, confirmed: true, isCurrent: vi.fn(() => true), upsert: vi.fn(async (_row: unknown) => {}) }));
vi.mock("../../../hooks/useChildCollection", () => ({ useChildCollection: () => store }));
import { checkpointSteps, checkpointChoice, QUEST_STEPS, STUDIO_QUEST_ID, useStudioQuestProgress } from "./studioProgress";
const QUEST_CHOICES_FOR_TEST = { spot: "left", pillows: "pillow", lights: "lamp", pause: "quiet" } as const;
const row = (step: string, choice: string) => ({ id: `${STUDIO_QUEST_ID}:${step}`, questId: STUDIO_QUEST_ID, step, choice });
describe("finite child-owned quest", () => {
  it("resumes exact choices after serialization without dates or expiry", () => {
    const rows = JSON.parse(JSON.stringify([row("spot", "right"), row("pillows", "blanket"), row("lights", "daylight"), row("pause", "look")]));
    expect(checkpointSteps(rows)).toEqual(QUEST_STEPS);
    expect(checkpointChoice(rows, "spot")).toBe("right");
    expect(checkpointChoice(rows, "pillows")).toBe("blanket");
    expect(Object.keys(rows[0]).sort()).toEqual(["choice", "id", "questId", "step"]);
  });
  it("rejects malformed, foreign and out of order progress", () => {
    expect(checkpointSteps([null, {}, row("pillows", "pillow")])).toEqual([]);
    expect(checkpointSteps([row("spot", "lamp")])).toEqual([]);
    expect(checkpointSteps([{ ...row("spot", "left"), questId: "other" }])).toEqual([]);
    expect(checkpointSteps([row("spot", "left"), row("lights", "lamp")])).toEqual(["spot"]);
  });
  it("writes a bounded choice to deterministic doc, and rejects a stale owner receipt", async () => {
    store.items = [row("spot", "middle")]; store.upsert.mockClear();
    await useStudioQuestProgress("kid").advance("blanket");
    expect(store.upsert).toHaveBeenCalledWith(row("pillows", "blanket"), { requireAcknowledgement: true });
    await expect(useStudioQuestProgress("kid").advance("left")).rejects.toThrow("Choose");
    store.isCurrent.mockReturnValue(false);
    await expect(useStudioQuestProgress("kid").advance("pillow")).rejects.toThrow("scope");
    expect(store.upsert).toHaveBeenCalledTimes(1); store.isCurrent.mockReturnValue(true);
  });
  it("never awards the finish or accepts another step from unconfirmed cached writes", async () => {
    store.items = QUEST_STEPS.map(step => row(step, QUEST_CHOICES_FOR_TEST[step]));
    store.confirmed = false; store.upsert.mockClear();
    const queued = useStudioQuestProgress("kid");
    expect(queued.steps).toHaveLength(4);
    expect(queued.confirmed).toBe(false);
    expect(queued.completed).toBe(false);
    await expect(queued.advance("look")).rejects.toThrow("confirmation");
    expect(store.upsert).not.toHaveBeenCalled();
    store.confirmed = true;
    expect(useStudioQuestProgress("kid").completed).toBe(true);
  });
  it("propagates missing server acknowledgement instead of inventing a kept quest step", async () => {
    store.items = [row("spot", "left")]; store.confirmed = true;
    store.upsert.mockRejectedValueOnce(new Error("The write was not confirmed"));
    await expect(useStudioQuestProgress("kid").advance("pillow")).rejects.toThrow("not confirmed");
    expect(store.upsert).toHaveBeenLastCalledWith(row("pillows", "pillow"), { requireAcknowledgement: true });
  });
});
