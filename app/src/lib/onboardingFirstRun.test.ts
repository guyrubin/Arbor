import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../types";
import { DOMAINS } from "./domains/registry";
import { translate } from "./i18n";
import { FirstRunController, firstRunCard, initialFirstRunState, onboardingChallenges, FIRST_NOTICE_PROMPTS, validAbout } from "./onboardingFirstRun";
import { acceptTodayAction } from "../actionLoop/accept";
import type { ActionLoopEntry } from "../actionLoop/model";
import { ageMonthsFromBirthMonth, ageMonthsFromProfile, agePatchFromMonths } from "./childAge";
import { hasOnboardingNoticeReview, ONBOARDING_NOTICE_REVIEWS } from "../content/onboardingNoticeRelease";
import { HARD_MOMENT_PILOT } from "../content/pilotRelease";

const NOW = new Date("2026-10-09T12:00:00Z");
const child = (extra: Partial<ChildProfile> = {}): ChildProfile => ({ id: "child-new", name: "Noa", age: 4, birthMonth: "2022-04", languages: ["English"], challenges: [], strengths: [], schoolContext: "", onboardingComplete: false, ...extra });
function harness(resume?: ChildProfile, lang: "en" | "he" = "en") {
  const profiles = resume ? [resume] : [] as ChildProfile[];
  const rows: ActionLoopEntry[] = [];
  const addChild = vi.fn(async (input: Omit<ChildProfile, "id">) => { const c = child(input); profiles.push(c); return c; });
  const updateChild = vi.fn(async (id: string, patch: Partial<ChildProfile>) => { const target = profiles.find(p => p.id === id)!; Object.assign(target, patch); return true; });
  const upsert = vi.fn(async (row: ActionLoopEntry) => { const i = rows.findIndex(r => r.id === row.id); if (i < 0) rows.push(row); else rows[i] = row; });
  const accepted = vi.fn(async (childId: string, card: ReturnType<typeof firstRunCard>, acceptanceKey: string) => {
    await acceptTodayAction({ childId, items: rows, upsert, recommendation: card.recommendation, source: card.source, capacity: "tiny", acceptanceKey, now: NOW });
  });
  const onComplete = vi.fn();
  const services = { addChild, updateChild, accept: accepted, lang: () => lang, now: () => NOW, onComplete };
  const controller = new FirstRunController(resume, services);
  return { controller, services, profiles, rows, addChild, updateChild, upsert, accepted, onComplete };
}
function about(c: FirstRunController) { c.edit({ name: "Noa", birthMonth: "2022-04", languages: ["English"], consent: true }); }
function failCompletionOnce(h: ReturnType<typeof harness>) {
  const persist = h.updateChild.getMockImplementation()!; let failed = false;
  h.updateChild.mockImplementation(async (id, patch) => {
    if (patch.onboardingComplete === true && !failed) { failed = true; return false; }
    return persist(id, patch);
  });
}
async function ready(h = harness()) { about(h.controller); await h.controller.next(); await h.controller.next(); return h; }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network in first run"); })); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("B-SHELL-36: signed-in first run", () => {
  it.each(["en", "he"] as const)("three steps → accepted Today step, no model/network calls (%s)", async lang => {
    const h = harness(undefined, lang); const c = h.controller;
    expect(c.snapshot().step).toBe(1); expect(c.snapshot().birthMonth).toBe("");
    about(c); await c.next(); expect(c.snapshot().step).toBe(2);
    c.worry({ choice: "talking", words: "My own concern", quote: "bus" });
    await c.next(); expect(c.snapshot().step).toBe(3);
    const card = firstRunCard(c.snapshot(), lang, NOW); expect(card.sayBack).toBeDefined();
    await c.finish(card); expect(c.snapshot().complete).toBe(true);
    expect(h.profiles).toHaveLength(1); expect(h.profiles[0]).toMatchObject({ onboardingComplete: true, challenges: ["My own concern"], birthMonth: "2022-04", ageMonths: 54 });
    expect(h.profiles[0].birthDate).toBeUndefined(); expect(h.profiles[0].onboardingDraft).toBeUndefined();
    expect(h.rows).toHaveLength(1); expect(h.rows[0]).toMatchObject({ source: "onboarding", status: "accepted", recommendation: card.recommendation });
    expect(h.rows[0].id).toContain("child-new"); expect(h.onComplete).toHaveBeenCalledOnce();
  });
  it("does not create a child until name, a real birth month, a home language and consent exist", async () => {
    const h = harness(); about(h.controller); h.controller.edit({ birthMonth: "" }); await h.controller.next(); expect(h.addChild).not.toHaveBeenCalled();
    for (const invalid of ["2026-11", "2026-00", "2026-13", "2022-04-01", "garbage"]) {
      h.controller.edit({ birthMonth: invalid }); expect(validAbout(h.controller.snapshot(), NOW)).toBe(false); await h.controller.next();
    }
    h.controller.edit({ birthMonth: "2022-04", languages: [] }); await h.controller.next(); expect(h.addChild).not.toHaveBeenCalled();
  });
  it("double Continue and Back during a pending create cannot duplicate or move the flow", async () => {
    const h = harness(); about(h.controller); let resolve!: (p: ChildProfile) => void;
    h.addChild.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const pending = h.controller.next(); h.controller.back(); h.controller.edit({ name: "Changed" }); await h.controller.next();
    expect(h.addChild).toHaveBeenCalledOnce(); expect(h.controller.snapshot()).toMatchObject({ step: 1, busy: true, name: "Noa" });
    resolve(child()); await pending; expect(h.controller.snapshot()).toMatchObject({ step: 2, childId: "child-new", busy: false });
  });
  it("Back preserves edits and updates the existing child, never adds another", async () => {
    const h = await ready(); h.controller.back(); h.controller.back(); h.controller.edit({ name: "Noam", birthMonth: "2022-05" });
    await h.controller.next(); await h.controller.next(); expect(h.addChild).toHaveBeenCalledOnce();
    expect(h.profiles[0]).toMatchObject({ name: "Noam", birthMonth: "2022-05", ageMonths: 53 });
  });
  it("interruption resumes the actual persisted worry and card for that child", async () => {
    const h = harness(); about(h.controller); await h.controller.next(); h.controller.worry({ choice: "hands", words: "Buttons are hard" }); await h.controller.next();
    const resumed = new FirstRunController(h.profiles[0], h.services);
    expect(resumed.snapshot()).toMatchObject({ step: 3, childId: "child-new", worry: { choice: "hands", words: "Buttons are hard" } });
    await resumed.finish(firstRunCard(resumed.snapshot(), "en", NOW)); expect(h.addChild).toHaveBeenCalledOnce();
  });
  it("an old incomplete profile with only an age must supply a birth month without creating a new profile", async () => {
    const h = harness(child({ birthMonth: undefined })); expect(h.controller.snapshot().step).toBe(1);
    about(h.controller); await h.controller.next(); expect(h.addChild).not.toHaveBeenCalled(); expect(h.updateChild).toHaveBeenCalledOnce();
  });
  it("an existing exact DOB stays untouched through Back and profile saves", async () => {
    const h = harness(child({ birthDate: "2022-04-28" })); h.controller.back(); h.controller.edit({ birthMonth: "2023-07" });
    expect(h.controller.snapshot().birthMonth).toBe("2022-04"); await h.controller.next();
    expect(h.profiles[0].birthDate).toBe("2022-04-28");
    expect(h.profiles[0].ageMonths).toBe(53);
    expect(h.updateChild.mock.calls[0][1]).not.toHaveProperty("birthDate");
  });
  it("a failed create or worry write stays retryable and never claims completion", async () => {
    const h = harness(); about(h.controller); h.addChild.mockRejectedValueOnce(new Error("offline")); await h.controller.next();
    expect(h.controller.snapshot()).toMatchObject({ step: 1, error: true, complete: false });
    await h.controller.next(); h.controller.worry({ words: "My worry" }); h.updateChild.mockResolvedValueOnce(false); await h.controller.next();
    expect(h.controller.snapshot()).toMatchObject({ step: 2, error: true }); await h.controller.next(); expect(h.controller.snapshot().step).toBe(3);
  });
  it("duplicate accept taps and completion retry keep one accepted action", async () => {
    const h = await ready(); const card = firstRunCard(h.controller.snapshot(), "en", NOW);
    failCompletionOnce(h); await Promise.all([h.controller.finish(card), h.controller.finish(card)]);
    expect(h.controller.snapshot()).toMatchObject({ step: 3, error: true, complete: false }); expect(h.rows).toHaveLength(1);
    const resumed = new FirstRunController(h.profiles[0], h.services); await resumed.finish(card); await resumed.finish(card);
    expect(h.rows).toHaveLength(1); expect(h.upsert).toHaveBeenCalledOnce(); expect(h.onComplete).toHaveBeenCalledOnce();
  });
  it("a rejected accepted-step write does not finalize the profile", async () => {
    const h = await ready(); h.accepted.mockRejectedValueOnce(new Error("offline")); const before = h.updateChild.mock.calls.length;
    await h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW)); expect(h.updateChild).toHaveBeenCalledTimes(before + 1);
    expect(h.updateChild.mock.calls.at(-1)?.[1]).toHaveProperty("onboardingDraft");
    expect(h.profiles[0].onboardingComplete).toBe(false); expect(h.onComplete).not.toHaveBeenCalled();
  });
  it("a changed worry after a failed completion creates a new choice and supersedes only that child's previous step", async () => {
    const h = await ready(); failCompletionOnce(h); await h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW));
    h.controller.back(); h.controller.worry({ choice: "family" }); await h.controller.next(); await h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW));
    expect(h.rows.filter(r => r.status === "accepted")).toHaveLength(1); expect(h.rows.filter(r => r.status === "superseded")).toHaveLength(1);
  });
});

describe("authored content, vocabulary and pilot boundaries", () => {
  it.each(["en", "he"] as const)("all registry areas use existing translated age-banded notice copy (%s)", lang => {
    for (const birthMonth of ["2026-04", "2024-10", "2022-04", "2016-10"]) {
      for (const domain of DOMAINS) {
        const state = initialFirstRunState(child({ birthMonth })); state.worry.choice = domain.id;
        const card = firstRunCard(state, lang, NOW);
        expect(card.notice).not.toContain("elev."); expect(card.title).toBe(translate(lang, domain.labelKey)); expect(card.source).toBe("onboarding");
      }
    }
    expect(Object.keys(FIRST_NOTICE_PROMPTS)).toHaveLength(4);
  });
  it("unreviewed first notices cannot activate; an existing neutral day-0 question keeps setup open", () => {
    expect(ONBOARDING_NOTICE_REVIEWS).toEqual([]);
    expect(hasOnboardingNoticeReview("elev.prompt.preschool.10", NOW)).toBe(false);
    const state = initialFirstRunState(child()); state.worry.choice = "feelings";
    expect(firstRunCard(state, "en", NOW).notice).toBe(translate("en", "elev.journal.compose.ask", { name: "Noa" }));
  });
  it("typed parent words win; chosen area is the fallback; nothing clears challenges", () => {
    const state = initialFirstRunState(child()); state.worry.choice = "hands";
    expect(onboardingChallenges(state.worry, "he")).toEqual([translate("he", "elev.domains.hands")]);
    state.worry.words = "  My own words  "; expect(onboardingChallenges(state.worry, "en")).toEqual(["My own words"]);
    state.worry.choice = "nothing"; state.worry.words = ""; expect(onboardingChallenges(state.worry, "en")).toEqual([]);
  });
  it.each(["en", "he"] as const)("hard moments fall back to Feelings exactly at pilot expiry (%s)", lang => {
    const state = initialFirstRunState(child()); state.worry = { ...state.worry, choice: "hard-moment", hardMomentId: "tantrum" };
    expect(firstRunCard(state, lang, NOW).guide?.id).toBe("tantrum");
    const expired = firstRunCard(state, lang, new Date(HARD_MOMENT_PILOT.expiresAt));
    expect(expired.guide).toBeUndefined(); expect(expired.title).toBe(translate(lang, "elev.domains.feelings"));
    expect(expired.notice).toBe(translate(lang, "elev.journal.compose.ask", { name: "Noa" }));
  });
  it("unknown and age-mismatched guide IDs never reveal a guide", () => {
    const state = initialFirstRunState(child({ birthMonth: "2026-08" })); state.worry = { ...state.worry, choice: "hard-moment", hardMomentId: "tantrum" };
    expect(firstRunCard(state, "en", NOW).guide).toBeUndefined(); state.worry.hardMomentId = "unknown"; expect(firstRunCard(state, "en", NOW).guide).toBeUndefined();
  });
  it("expiry between preview and acceptance must show the notice before a second tap", async () => {
    const h = await ready(); h.controller.worry({ choice: "hard-moment", hardMomentId: "tantrum" }); const rendered = firstRunCard(h.controller.snapshot(), "en", NOW);
    h.services.now = () => new Date(HARD_MOMENT_PILOT.expiresAt); await h.controller.finish(rendered);
    expect(h.accepted).not.toHaveBeenCalled(); expect(h.controller.snapshot().error).toBe(true);
    await h.controller.finish(firstRunCard(h.controller.snapshot(), "en", h.services.now())); expect(h.rows[0].source).toBe("onboarding");
  });
  it.each(["she cannot breathe", "he wants to hurt himself", "מכה אותו"])("urgent words lead to existing safety copy, not an ordinary activity: %s", words => {
    const state = initialFirstRunState(child()); state.worry.words = words;
    const card = firstRunCard(state, "en", NOW); expect(card.urgent).toBe(true); expect(card.notice).toContain("emergency"); expect(card.guide).toBeUndefined();
  });
});

describe("review: first-run lifetime and exact accept checkpoint", () => {
  it("returning to an earlier choice after two completion failures accepts that choice anew without rewriting history", async () => {
    const h = await ready(), persist = h.updateChild.getMockImplementation()!;
    let fail = true; h.updateChild.mockImplementation((id, patch) => patch.onboardingComplete && fail ? Promise.resolve(false) : persist(id, patch));
    h.controller.worry({ choice: "talking", quote: "bus" }); const cardA = firstRunCard(h.controller.snapshot(), "en", NOW);
    await h.controller.finish(cardA); h.controller.back(); h.controller.worry({ choice: "family", quote: "" }); await h.controller.next();
    await h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW));
    h.controller.back(); h.controller.worry({ choice: "talking", quote: "bus" }); await h.controller.next(); fail = false;
    await h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW));
    expect(h.rows).toHaveLength(3); expect(h.rows.filter(row => row.status === "accepted")).toHaveLength(1);
    expect(h.rows.find(row => row.status === "accepted")?.recommendation).toBe(cardA.recommendation);
    expect(h.rows[0].status).toBe("superseded"); expect(h.profiles[0].onboardingComplete).toBe(true);
  });
  it("checkpoints the step-3 quote before acceptance and retains the same action after completion failure/remount", async () => {
    const h = await ready(); h.controller.worry({ choice: "talking", quote: "bus" });
    const card = firstRunCard(h.controller.snapshot(), "en", NOW); failCompletionOnce(h);
    await h.controller.finish(card);
    expect(h.profiles[0].onboardingDraft?.quote).toBe("bus"); expect(h.rows).toHaveLength(1);
    const resumed = new FirstRunController(h.profiles[0], h.services);
    const retryCard = firstRunCard(resumed.snapshot(), "en", NOW); expect(retryCard).toEqual(card);
    await resumed.finish(retryCard); expect(h.rows).toHaveLength(1); expect(h.upsert).toHaveBeenCalledOnce();
  });
  it("a failed explicit-accept checkpoint cannot write any action or completion", async () => {
    const h = await ready(); h.controller.worry({ choice: "talking", quote: "bus" });
    h.updateChild.mockResolvedValueOnce(false); await h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW));
    expect(h.accepted).not.toHaveBeenCalled(); expect(h.profiles[0].onboardingComplete).toBe(false);
  });
  it.each(["checkpoint", "accept", "completion"] as const)("service/session replacement during %s cannot continue using another owner's callbacks", async stage => {
    const h = await ready(); let resolve!: (value?: any) => void;
    if (stage === "accept") h.accepted.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    else {
      const persist = h.updateChild.getMockImplementation()!;
      h.updateChild.mockImplementation((id, patch) => (stage === "checkpoint" ? !!patch.onboardingDraft : patch.onboardingComplete === true)
        ? new Promise<boolean>(done => { resolve = done; }) : persist(id, patch));
    }
    const pending = h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW));
    for (let i = 0; i < 5 && !resolve; i++) await Promise.resolve();
    expect(resolve).toBeDefined(); const bUpdate = vi.fn(async () => true); const bComplete = vi.fn();
    h.controller.services = { ...h.services, updateChild: bUpdate, onComplete: bComplete };
    resolve(true); await pending;
    expect(bUpdate).not.toHaveBeenCalled(); expect(bComplete).not.toHaveBeenCalled(); expect(h.onComplete).not.toHaveBeenCalled();
    expect(h.controller.snapshot().complete).toBe(false);
    if (stage === "checkpoint") expect(h.accepted).not.toHaveBeenCalled();
  });
  it("unmount during accepted-action persistence cannot finalize the profile", async () => {
    const h = await ready(); let alive = true; h.controller.services = { ...h.services, sessionKey: {}, isCurrent: () => alive };
    let resolve!: () => void; h.accepted.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const pending = h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW)); await Promise.resolve(); await Promise.resolve();
    alive = false; resolve(); await pending;
    expect(h.updateChild.mock.calls.some(([, patch]) => patch.onboardingComplete === true)).toBe(false);
    expect(h.onComplete).not.toHaveBeenCalled();
  });
  it("same-session rerender keeps captured callbacks while allowing the operation to finish", async () => {
    const h = await ready(); const sessionKey = {}; h.controller.services = { ...h.services, sessionKey };
    let resolve!: () => void; h.accepted.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const pending = h.controller.finish(firstRunCard(h.controller.snapshot(), "en", NOW)); await Promise.resolve(); await Promise.resolve();
    const replacement = vi.fn(async () => true); h.controller.services = { ...h.services, sessionKey, updateChild: replacement };
    resolve(); await pending; expect(replacement).not.toHaveBeenCalled(); expect(h.controller.snapshot().complete).toBe(true);
  });
  it.each(["I want to hurt myself", "רוצה למות", "she cannot breathe"])("a quoted child utterance overrides Talking's ordinary say-back: %s", quote => {
    const s = initialFirstRunState(child()); s.worry.choice = "talking"; s.worry.quote = quote;
    const card = firstRunCard(s, "en", NOW); expect(card.urgent).toBe(true); expect(card.sayBack).toBeUndefined(); expect(card.notice).toContain("emergency");
  });
});

describe("birth-month precision", () => {
  it("validates unknown/future values without defaulting to age zero", () => {
    for (const raw of [undefined, "", "2026-13", "2026-00", "2026-11", "2024-3", "2024-03-01", "oops"]) expect(ageMonthsFromBirthMonth(raw, NOW)).toBeNull();
    expect(ageMonthsFromBirthMonth("2026-10", NOW)).toBe(0); expect(ageMonthsFromBirthMonth("2022-04", NOW)).toBe(54);
  });
  it("rolls over at the calendar month and year boundary, not a fabricated birthday", () => {
    expect(ageMonthsFromBirthMonth("2025-12", new Date(2026, 0, 1))).toBe(1);
    expect(ageMonthsFromBirthMonth("2026-09", new Date(2026, 9, 1))).toBe(1);
  });
  it("exact DOB wins; valid month wins over age; invalid month keeps compatible anchored fallback", () => {
    expect(ageMonthsFromProfile(child({ birthDate: "2022-04-28", ageMonths: 1 }), NOW)).toBe(53);
    expect(ageMonthsFromProfile(child({ ageMonths: 1 }), NOW)).toBe(54);
    expect(ageMonthsFromProfile(child({ birthMonth: "bad", ageMonths: 40, ageMonthsAsOf: "2026-09-09" }), NOW)).toBe(41);
  });
  it("a later explicit age edit clears stale month precision as well as the exact birthday", () => {
    const updated = { ...child(), ...agePatchFromMonths(20, NOW) }; expect(updated.birthMonth).toBeUndefined(); expect(ageMonthsFromProfile(updated, NOW)).toBe(20);
  });
});
