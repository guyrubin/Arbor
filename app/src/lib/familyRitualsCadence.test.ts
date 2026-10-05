/**
 * ENG-25 — the Family Rituals cadence is real, and comes back on its own.
 *
 * WHAT SHIPPED: every ritual carried its cadence as PROSE ("Weekly, same
 * evening each week, 10 to 15 minutes around the table") rendered as a grey
 * chip in Arbor Academy, and nothing in the product ever read it. A ritual a
 * parent meant to run weekly never came back — there was no schedule, no
 * record of having run it, and no surface that asked.
 *
 * WHAT THESE PIN: `cadenceDays` exists on every ritual (the prose alone cannot
 * be scheduled), the turn logic, the record, and the mount on Growth.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILY_RITUALS } from "./familyRituals";
import {
  DAY_MS,
  cadenceLabel,
  clearRitualRecord,
  daysUntilNextTurn,
  dueRituals,
  markRitualPractised,
  readRitualRecord,
  ritualIsDue,
  ritualOfTheMoment,
} from "./familyRitualsCadence";
import { en, he } from "./i18nElevation/returnhooks";
import { charterValueFor, RITUAL_VALUE_KEY } from "../components/nextopen/RitualTurnCard";
import { translate } from "./i18n";
const translateHe = (k: string) => translate("he", k);

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");

/** Minimal Storage double — the node env has no real one. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as unknown as Storage;
}

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const weekly = FAMILY_RITUALS.find((r) => r.id === "truth-practice-weekly")!;
const monthly = FAMILY_RITUALS.find((r) => r.id === "family-story-canon")!;

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  clearRitualRecord();
});

describe("ENG-25 — a cadence a machine can act on", () => {
  it("NEGATIVE CONTROL: the prose cadence alone yields no schedule", () => {
    // The exact shape that shipped: a sentence. Nothing derives a period from it.
    const prose = "Weekly, same evening each week, 10 to 15 minutes around the table.";
    expect(prose).toMatch(/weekly/i);
    expect(Number.parseInt(prose, 10)).toBeNaN();
  });

  it("every ritual now carries a positive cadence in DAYS", () => {
    expect(FAMILY_RITUALS.length).toBeGreaterThan(0);
    for (const r of FAMILY_RITUALS) {
      expect(typeof r.cadenceDays, r.id).toBe("number");
      expect(r.cadenceDays, r.id).toBeGreaterThan(0);
    }
    expect(weekly.cadenceDays).toBe(7);
    expect(monthly.cadenceDays).toBe(30);
  });

  it("the cadence label is an i18n key present in EN and HE, never raw copy", () => {
    for (const r of FAMILY_RITUALS) {
      const label = cadenceLabel(r);
      expect(en[label.key], `EN missing ${label.key}`).toBeTruthy();
      expect(he[label.key], `HE missing ${label.key}`).toBeTruthy();
    }
  });
});

describe("ENG-25 — whose turn it is", () => {
  it("a ritual never practised is due", () => {
    expect(ritualIsDue(weekly, NOW, {})).toBe(true);
    expect(dueRituals(NOW, {}).length).toBe(FAMILY_RITUALS.length);
  });

  it("a weekly ritual practised today is not due; at seven days it is again", () => {
    expect(ritualIsDue(weekly, NOW, { [weekly.id]: NOW })).toBe(false);
    expect(ritualIsDue(weekly, NOW, { [weekly.id]: NOW - 6 * DAY_MS })).toBe(false);
    expect(ritualIsDue(weekly, NOW, { [weekly.id]: NOW - 7 * DAY_MS })).toBe(true);
  });

  it("a monthly ritual is left alone for a month", () => {
    expect(ritualIsDue(monthly, NOW, { [monthly.id]: NOW - 20 * DAY_MS })).toBe(false);
    expect(ritualIsDue(monthly, NOW, { [monthly.id]: NOW - 31 * DAY_MS })).toBe(true);
  });

  it("ONE ritual is surfaced, and it is the most overdue", () => {
    const record: Record<string, number> = {};
    for (const r of FAMILY_RITUALS) record[r.id] = NOW; // everything settled
    expect(ritualOfTheMoment(NOW, record)).toBeNull();

    record[weekly.id] = NOW - 9 * DAY_MS; // 2 days past its turn
    record["weekly-reflection-sunday-reset"] = NOW - 30 * DAY_MS; // 23 days past
    const turn = ritualOfTheMoment(NOW, record);
    expect(turn).toBeTruthy();
    expect(turn!.ritual.id).toBe("weekly-reflection-sunday-reset");
    expect(turn!.daysOverdue).toBe(23);
    expect(turn!.firstTime).toBe(false);
  });

  it("a first-timer reports itself as one", () => {
    const turn = ritualOfTheMoment(NOW, {});
    expect(turn).toBeTruthy();
    expect(turn!.firstTime).toBe(true);
    expect(turn!.daysOverdue).toBe(0);
  });

  it("counts the days until a settled ritual comes back", () => {
    expect(daysUntilNextTurn(weekly, NOW, { [weekly.id]: NOW - 5 * DAY_MS })).toBe(2);
    expect(daysUntilNextTurn(weekly, NOW, { [weekly.id]: NOW - 8 * DAY_MS })).toBeNull();
    expect(daysUntilNextTurn(weekly, NOW, {})).toBeNull();
  });
});

describe("ENG-25 — the record is device-local and holds no child data", () => {
  it("marking a ritual practised restarts its clock and survives a re-read", () => {
    expect(ritualOfTheMoment(NOW, readRitualRecord())!.ritual.id).toBe(FAMILY_RITUALS[0].id);
    markRitualPractised(FAMILY_RITUALS[0].id, NOW);
    const record = readRitualRecord();
    expect(record[FAMILY_RITUALS[0].id]).toBe(NOW);
    expect(ritualIsDue(FAMILY_RITUALS[0], NOW, record)).toBe(false);
    expect(ritualOfTheMoment(NOW, record)!.ritual.id).not.toBe(FAMILY_RITUALS[0].id);
  });

  it("stores ids and timestamps only — nothing about a child", () => {
    markRitualPractised(weekly.id, NOW);
    const raw = localStorage.getItem("arbor.familyRituals.practised");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      expect(FAMILY_RITUALS.some((r) => r.id === k)).toBe(true);
      expect(typeof v).toBe("number");
    }
  });

  it("garbage in storage degrades to an empty record, never a throw", () => {
    localStorage.setItem("arbor.familyRituals.practised", "{not json");
    expect(readRitualRecord()).toEqual({});
    localStorage.setItem("arbor.familyRituals.practised", '["a"]');
    expect(readRitualRecord()).toEqual({});
    localStorage.setItem("arbor.familyRituals.practised", '{"x":"soon"}');
    expect(readRitualRecord()).toEqual({});
  });
});

describe("ENG-25 → B-GROWTH-03 — the cadence is surfaced on #/family", () => {
  // B-GROWTH-03: the card moved from Growth into Family Formation's rituals module.
  const growth = read("../components/sections/FamilyFormation.tsx");
  const card = read("../components/nextopen/RitualTurnCard.tsx");

  it("NEGATIVE CONTROL: before this change no surface referenced the cadence", () => {
    const shipped = '<span className="inline-block text-[10.5px] font-bold mt-2 px-2 py-0.5 rounded-full">{he ? r.cadenceHe : r.cadence}</span>';
    expect(/cadenceHe/.test(shipped)).toBe(true);
    expect(/ritualOfTheMoment|cadenceDays/.test(shipped)).toBe(false);
  });

  it("reads both files (a scan over an empty string proves nothing)", () => {
    expect(growth.length).toBeGreaterThan(2000);
    expect(card.length).toBeGreaterThan(1000);
  });

  it("#/family mounts the card inside the start-family-ritual module, and the card runs the cadence + records a run", () => {
    // W2-SHELLPLAY r1: the card is mounted inside the rituals module and
    // carries the route's ONE stamp on its start control (spread from the leaf).
    // W2-SHELLPLAY r2 (B-SHELL-NEW-2l): the host also passes the charter and the child
    expect(growth).toMatch(/<RitualTurnCard onStart=\{startRitual\} started=\{ritualStarted\} primaryMoveProps=\{RITUAL_MOVE\} onTurnChange=\{onTurnChange\} charterValues=\{saved \? values : \[\]\} childName=\{childProfile\?\.name\} childAge=\{childProfile\?\.age\} \/>/);
    const mod = growth.indexOf('data-module="family-rituals"');
    expect(mod).toBeGreaterThan(-1);
    expect(growth.indexOf("<RitualTurnCard")).toBeGreaterThan(mod);
    expect(read("../components/tabs/DevelopmentTab.tsx")).not.toMatch(/RitualTurnCard/);
    expect(card).toContain("ritualOfTheMoment");
    expect(card).toContain("markRitualPractised");
    expect(card).toContain('data-testid="ritual-turn-card"');
    // The run button exists and is a real 44px target.
    const btn = card.match(/data-testid="ritual-turn-practised"[\s\S]{0,600}?>/)?.[0];
    expect(btn).toBeTruthy();
    expect(btn).toContain("minHeight: 44");
  });

  it("the card is a family practice, never a measure of the child", () => {
    expect(card).not.toMatch(/\bstreak\b/i);
    expect(card).not.toMatch(/\{[^}]*\}%/);
    expect(card).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("W2-SHELLPLAY r1 — #/family: the ritual start reads first, on a real control", () => {
  const family = read("../components/sections/FamilyFormation.tsx");
  const card = read("../components/nextopen/RitualTurnCard.tsx");
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  it("the stamp is on the card's start BUTTON (via the leaf's one spread), never a wrapper div", () => {
    expect(family).toContain('const RITUAL_MOVE = { "data-primary-move": "start-family-ritual" } as const;');
    expect((code(family).match(/\bdata-primary-move\b(?!-)/g) || []).length).toBe(1);
    expect(code(family)).not.toMatch(/<div[^>]*data-primary-move/);
    const start = card.slice(card.lastIndexOf("<button", card.indexOf('data-testid="ritual-turn-start"')), card.indexOf("</button>", card.indexOf('data-testid="ritual-turn-start"')));
    expect(start).toContain("{...primaryMoveProps}");
    expect(start).toContain('background: "var(--gradient-cta)", color: "var(--arbor-on-accent)"');
    expect(start).toContain("minHeight: 44");
  });

  it("critic r2: 'Our family's way' leads (header -> charter line -> ritual turn), on a real block", () => {
    expect(family.indexOf('data-module="family-charter"')).toBeLessThan(family.indexOf('data-module="family-rituals"'));
    expect(family.indexOf('data-testid="family-way"')).toBeLessThan(family.indexOf("<RitualTurnCard"));
    expect(family).not.toContain('display: "contents"');
  });

  it("the charter input and Add are 44 px, and Add is a ghost, not a second filled CTA", () => {
    expect(family).toContain('className="flex-1 min-h-11 rounded-xl px-3 py-2.5 text-sm"');
    const add = family.slice(family.indexOf("<button onClick={add}"), family.indexOf("</button>", family.indexOf("<button onClick={add}")));
    expect(add).toContain("min-h-11");
    expect(add).not.toMatch(/text-white|background: "var\(--arbor-clay\)"/);
  });

  it("no dead self-door: the card on #/family does not offer 'Open Family Formation'", () => {
    expect(card).not.toContain('setActiveTab("family")');
    expect(card).not.toContain("elev.rh.ritual.open");
  });
});

describe("W2-SHELLPLAY r2 — #/family always has ONE move, and nothing renders twice", () => {
  const family = read("../components/sections/FamilyFormation.tsx");
  const card = read("../components/nextopen/RitualTurnCard.tsx");
  const settled = card.slice(card.indexOf("if (!turn) {"), card.indexOf("const { ritual, firstTime } = turn;"));
  const active = card.slice(card.indexOf("const { ritual, firstTime } = turn;"));

  it("G0: the stamp is spread in BOTH card states (a due ritual, and nothing due)", () => {
    expect(settled).toContain('data-testid="ritual-turn-settled"');
    expect(settled).toContain("{...primaryMoveProps}");
    expect(settled).toContain('t("elev.rh.ritual.planNext"');
    expect(active).toContain("{...primaryMoveProps}");
    expect((settled.match(/\{\.\.\.primaryMoveProps\}/g) || []).length).toBe(1);
    expect((active.match(/\{\.\.\.primaryMoveProps\}/g) || []).length).toBe(1);
    // NEGATIVE CONTROL: the r1 settled state (a bare line, no control) has no stamp
    const r1 = '<p data-testid="ritual-turn-settled">{t("elev.rh.ritual.settled")}</p>';
    expect(r1).not.toContain("primaryMoveProps");
  });

  it("the turn ritual is excluded from the library below it", () => {
    expect(family).toContain("FAMILY_RITUALS.filter((r) => r.id !== turnId).map((r) => {");
    expect(card).toContain("useEffect(() => { onTurnChange?.(turnId); }, [turnId, onTurnChange]);");
  });

  it("the heading ladder: module h2 t-lg > card h3 t-md > library h3 t-base; no orphan sizes", () => {
    expect(family).toContain('<h2 className="t-lg font-extrabold mb-3"');
    expect(card).toMatch(/<h3\s+id="ritual-turn-title"\s+className="mt-1 break-words t-md/);
    expect(family).toContain('<h3 className="t-base font-extrabold flex');
    expect(card).not.toMatch(/text-\[1[57]px\]/);
  });
});

describe("W2-SHELLPLAY r2 · B-SHELL-NEW-2l — the first turn names the family's value and the child, never a deficit", () => {
  it("charterValueFor matches the family's own word in either language; nothing for an unmapped ritual or an absent value", () => {
    expect(charterValueFor("truth-practice-weekly", ["Courage", "honesty"])).toBe("honesty");
    expect(charterValueFor("responsibility-ladder", [translateHe("elev.charter.default.responsibility")])).toBe(translateHe("elev.charter.default.responsibility"));
    // NEGATIVE CONTROLS
    expect(charterValueFor("truth-practice-weekly", ["Courage", "Kindness"])).toBeNull();
    expect(charterValueFor("family-story-canon", ["Honesty"])).toBeNull();
    expect(Object.keys(RITUAL_VALUE_KEY).every((id) => FAMILY_RITUALS.some((r) => r.id === id))).toBe(true);
  });

  it("the value sentence replaces the deficit reason in the first-time state; EN+HE keyed, HE carries no Latin and no slash-gendering", () => {
    const cardSrc = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "components", "nextopen", "RitualTurnCard.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(cardSrc).toContain("{!valueSentence && (");
    expect(cardSrc).toContain('data-testid="ritual-turn-value"');
    expect(cardSrc).toContain('background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)"');
    expect(cardSrc).toContain('fontFamily: "var(--font-editorial)"');
    for (const k of ["elev.rh.ritual.value.onCharter", "elev.rh.ritual.value.truth-practice-weekly", "elev.rh.ritual.value.responsibility-ladder", "elev.rh.ritual.closing.truth-practice-weekly"]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
      expect(he[k].replace(/\{(name|age)\}/g, "")).not.toMatch(/[A-Za-z]|\/ה\b|\/ת\b/);
    }
    for (const id of Object.keys(RITUAL_VALUE_KEY)) {
      expect(en[`elev.rh.ritual.value.${id}`]).toContain("{name}");
      expect(en[`elev.rh.ritual.value.${id}`]).not.toMatch(/not run|yet|missed|streak|%/i);
    }
    // NEGATIVE CONTROL: the old first-time line is the deficit the guard keeps off the value path
    expect(en["elev.rh.ritual.first"]).toMatch(/not run/);
  });
});

describe("SHIP-FIX r3 · #/family — the move clears the nav, and starter words are never 'your charter'", () => {
  const family = read("../components/sections/FamilyFormation.tsx");
  const card = read("../components/nextopen/RitualTurnCard.tsx");
  const active = card.slice(card.indexOf("const { ritual, firstTime } = turn;"));

  it("reason -> action -> detail: the CTA row renders BEFORE 'How it goes', which is a quiet 44 px disclosure (no deep well)", () => {
    const start = active.indexOf('data-testid="ritual-turn-start"');
    const how = active.indexOf('data-testid="ritual-turn-how"');
    expect(start).toBeGreaterThan(-1);
    expect(how).toBeGreaterThan(start);
    expect(active.indexOf('data-testid="ritual-turn-practised"')).toBeLessThan(how);
    expect(active.indexOf('data-testid="ritual-turn-steps"')).toBeGreaterThan(how);
    const btn = active.slice(active.lastIndexOf("<button", how), active.indexOf("</button>", how));
    expect(btn).toContain("minHeight: 44");
    expect(btn).toContain('color: "var(--arbor-muted)"');
    expect(btn).not.toContain("--arbor-paper-deep");
    // NEGATIVE CONTROL: the r3 order (full-width well bar before the CTA row) is caught
    const r3 = '<button onClick={() => setStepsOpen((v) => !v)} className="mt-3 flex w-full" style={{ minHeight: 44, background: "var(--arbor-paper-deep)" }}/><div className="mt-4"><button data-testid="ritual-turn-start"/>';
    expect(r3.indexOf("setStepsOpen")).toBeLessThan(r3.indexOf("ritual-turn-start"));
  });

  it("unsaved charter: the line is labelled 'Starter values' (EN+HE keyed) and the turn card gets NO values, so it never says 'on your charter'", () => {
    expect(family).toContain("const [saved, setSaved] = useState<boolean>(() => hasSavedFamilyCharter());");
    expect(family).toContain("charterValues={saved ? values : []}");
    expect(family).not.toContain("charterValues={values}");
    expect(family).toContain('{!saved && values.length > 0 && (');
    expect(family).toContain('t("elev.family.way.starter")');
    // an edit is a save: the label goes and the value reaches the card
    expect(family).toContain("const commit = (next: string[]) => { setValues(saveFamilyCharter(next)); setSaved(true); };");
    expect(en["elev.family.way.starter"]).toBe("Starter values");
    expect(he["elev.family.way.starter"]).toBeTruthy();
    expect(he["elev.family.way.starter"]).not.toMatch(/[A-Za-z]/);
    // the card's no-value path drops the charter clause (13adc5f)
    expect(charterValueFor("truth-practice-weekly", [])).toBeNull();
    expect(card).toContain("{charterValue && (");
  });

  it("the values line never opens a wrapped line with a separator (each '·' rides on the value before it)", () => {
    expect(family).not.toContain('values.join(" · ")');
    expect(family).toContain('<span className="whitespace-nowrap">{v}{i < values.length - 1 ? " ·" : ""}</span>');
  });
});
