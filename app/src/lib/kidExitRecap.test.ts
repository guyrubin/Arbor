/**
 * KID-12 guard — the parent strip on Kid Mode exit.
 *
 * Behaviour first (the fold + the copy), then the mount (the finding was
 * "capability built, unmounted": the fold and the EN/HE copy already existed
 * and `closeKidMode` simply returned nothing).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countsSince, kidExitRecapLine, totalActivity, KID_ACTIVITY_KINDS, type KidActivityKind, type KidActivityLedgers } from "./kidExitRecap";
import type { ChildActivityType } from "./signalTimeline";
import { withChildSignals } from "./i18nElevation/childsignals";
import { elevationEn, elevationHe } from "./i18nElevation";
import { en as baseEn, he as baseHe } from "./i18n";

const en = { ...elevationEn, ...baseEn };
const he = { ...elevationHe, ...baseHe };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const OPENED = Date.parse("2026-09-04T09:00:00.000Z");
const during = (mins: number) => new Date(OPENED + mins * 60_000).toISOString();
const before = (mins: number) => new Date(OPENED - mins * 60_000).toISOString();

/** The real dictionary, wired the way the component wires it. */
const tEn = withChildSignals((k, vars) => {
  const raw = en[k] ?? k;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, n: string) => (n in vars ? String(vars[n]) : m)) : raw;
}, false);
const tHe = withChildSignals((k, vars) => {
  const raw = he[k] ?? en[k] ?? k;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, n: string) => (n in vars ? String(vars[n]) : m)) : raw;
}, true);

describe("KID-12 · the fold counts only what happened during the session", () => {
  it("rows logged before Kid Mode opened are not counted", () => {
    const ledgers: KidActivityLedgers = {
      speech: [before(30), before(5), during(2), during(9)],
      mission: [before(120)],
    };
    const counts = countsSince(ledgers, OPENED);
    expect(counts.speech).toBe(2);
    expect(counts.mission).toBeUndefined();
    expect(totalActivity(counts)).toBe(2);
  });

  it("a quiet session counts nothing and produces NO strip", () => {
    const counts = countsSince({ speech: [before(10)] }, OPENED);
    expect(totalActivity(counts)).toBe(0);
    expect(kidExitRecapLine(counts, tEn, "Mia")).toBeNull();
  });

  it("garbage timestamps are ignored rather than counted", () => {
    const counts = countsSince({ speech: ["not a date", null, undefined, "", during(1)] }, OPENED);
    expect(counts.speech).toBe(1);
  });
});

describe("KID-12 · the strip is one parent-register line", () => {
  it("names the child and what they did, using the EXISTING childsignals copy", () => {
    const counts = countsSince({ speech: [during(1), during(3)], adventure: [during(5)] }, OPENED);
    const line = kidExitRecapLine(counts, tEn, "Mia");
    expect(line).toBeTruthy();
    expect(line!).toContain("Mia");
    expect(line!).toContain("Completed 2 speech practice rounds");
    expect(line!).toContain("Completed an adventure scene");
  });

  it("singular and plural both read naturally", () => {
    const one = kidExitRecapLine(countsSince({ speech: [during(1)] }, OPENED), tEn, "Mia");
    expect(one!).toContain("Completed a speech practice round");
    expect(one!).not.toContain("1 speech");
  });

  it("renders in Hebrew too", () => {
    const line = kidExitRecapLine(countsSince({ speech: [during(1), during(2)] }, OPENED), tHe, "מיה");
    expect(line).toBeTruthy();
    expect(line!).toContain("מיה");
    expect(line!).not.toMatch(/[A-Za-z]{3}/); // no English fell through
  });

  it("an unnamed child degrades to the neutral fallback, never to an empty name", () => {
    const line = kidExitRecapLine(countsSince({ speech: [during(1)] }, OPENED), tEn, "   ");
    expect(line).toBeTruthy();
    expect(line!).toContain("Child");
  });

  it("CLINICAL FIREWALL: counts only — no percentage, score or verdict", () => {
    const line = kidExitRecapLine(
      countsSince({ speech: [during(1), during(2)], mimic: [during(3)], practice: [during(4)] }, OPENED),
      tEn,
      "Mia"
    )!;
    expect(line).not.toMatch(/\d+(\.\d+)?\s*%/);
    expect(line).not.toMatch(/score|correct|accuracy|level|streak/i);
  });
});

describe("KID-12 · the strip is actually MOUNTED on the exit path", () => {
  const recap = read("components/kidmode/KidExitRecap.tsx");
  const ctx = read("components/kidmode/KidModeContext.tsx");

  /** The pre-change provider: close cleared state and returned nothing. */
  const PRE_CTX = `
  const closeKidMode = () => {
    setKidModeActive(false);
    writeKidModeState({ open: false });
    setIsKidModeOpen(false);
  };
    <KidModeContext.Provider value={{ isKidModeOpen, openKidMode, closeKidMode }}>
      {children}
    </KidModeContext.Provider>
`.replace(/\r\n/g, "\n");

  it("the sources were really read", () => {
    expect(recap.length).toBeGreaterThan(500);
    expect(ctx).toContain("export function KidModeProvider");
  });

  it("the provider mounts the recap while Kid Mode is open", () => {
    expect(/\{isKidModeOpen && <KidExitRecap \/>\}/.exec(ctx)).toBeTruthy();
    expect(/KidExitRecap/.exec(PRE_CTX)).toBeNull(); // negative control
  });

  it("the recap speaks on unmount — i.e. on exit — and only once", () => {
    expect(/useEffect\(\(\) => \(\) => speakRef\.current\(\), \[\]\)/.exec(recap)).toBeTruthy();
    expect((recap.match(/toast\(/g) ?? []).length).toBe(1);
  });

  it("it diffs the ledgers against the moment Kid Mode opened", () => {
    expect(/countsSince\(ledgersRef\.current, openedAtRef\.current\)/.exec(recap)).toBeTruthy();
    expect(/usePracticeData\(childProfile\.id\)/.exec(recap)).toBeTruthy();
  });

  it("REGISTER SEPARATION: the strip is parent register — no kid.* copy, nothing rendered", () => {
    expect(recap).not.toMatch(/["']kid\./);
    expect(recap).toContain("return null;");
    // and it is not part of Kid Mode's scanned surface graph
    const scan = read("lib/kidRegisterScan.test.ts");
    expect(scan.length).toBeGreaterThan(1000);
    expect(scan).not.toContain("KidExitRecap");
  });

  it("SAFETY: read-only — no child-data write on enter or exit", () => {
    for (const write of ["upsert(", "addDoc(", "setDoc(", "updateDoc(", "deleteDoc(", "writeBatch"]) {
      expect(recap).not.toContain(write);
    }
  });
});

describe("B-SHELL-04 · the recap names hero stories and stays until kept or dismissed", () => {
  // Type-level: every ChildActivityType is a KidActivityKind. If a new activity
  // type is added to the timeline and not here, this line stops compiling.
  type Missing = Exclude<ChildActivityType, KidActivityKind>;
  const exhaustive: [Missing] extends [never] ? true : false = true;
  // Runtime: a Record over ChildActivityType must list every member (tsc
  // rejects a missing key), and every key must be in KID_ACTIVITY_KINDS.
  const ALL_ACTIVITY_TYPES: Record<ChildActivityType, true> = {
    practice: true, speech: true, mimic: true, adventure: true, mission: true, hero: true,
  };

  it("KID_ACTIVITY_KINDS ⊇ ChildActivityType (type-level + runtime list)", () => {
    expect(exhaustive).toBe(true);
    for (const kind of Object.keys(ALL_ACTIVITY_TYPES)) {
      expect(KID_ACTIVITY_KINDS).toContain(kind);
    }
  });

  it("one finished hero story reads '1 hero story' (EN) and is named in Hebrew", () => {
    const counts = countsSince({ hero: [during(4)] }, OPENED);
    expect(counts.hero).toBe(1);
    expect(kidExitRecapLine(counts, tEn, "Mia")!).toContain("1 hero story");
    const he1 = kidExitRecapLine(counts, tHe, "מיה")!;
    expect(he1).toContain("סיפור גיבור");
    expect(he1).not.toMatch(/[A-Za-z]{3}/);
    expect(kidExitRecapLine(countsSince({ hero: [during(1), during(2)] }, OPENED), tEn, "Mia")!).toContain("2 hero stories");
  });

  const recap = read("components/kidmode/KidExitRecap.tsx");

  // B-KID-31 (KA-20, VETO): the hero ledger counts FINISHED stories only, and
  // a check-in is not a round — one shared builder, both callers.
  it("the hero ledger is mirrored from heroRuns, finished stories only (B-KID-31)", () => {
    expect(recap).toMatch(/useChildCollection<HeroJourneyRun>\(childProfile\.id, "heroRuns"\)/);
    expect(recap).toContain("ledgersRef.current = kidActivityLedgers(practice, heroRuns.items);");
    expect(recap).not.toMatch(/completedAt \|\| x\.startedAt/);
    expect(read("components/practice/PracticeStudioTab.tsx")).toContain("ledgers: kidActivityLedgers(data),");
  });

  it("B-KID-31: 2 check-ins + 1 started-not-finished story → nothing to say", async () => {
    const { kidActivityLedgers } = await import("./kidExitRecap");
    const at = new Date(OPENED + 60_000).toISOString();
    const empty = { items: [] as { timestamp: string }[] };
    const ledgers = kidActivityLedgers(
      { speech: empty, mimic: empty, missions: empty, adventures: empty, events: { items: [{ kind: "mood-checkin", timestamp: at }, { kind: "mood-checkin", timestamp: at }] } },
      [{ completedAt: undefined }],
    );
    const counts = countsSince(ledgers, OPENED);
    expect(counts).toEqual({});
    expect(kidExitRecapLine(counts, tEn, "Mia")).toBeFalsy();
    // a played round and a finished story still count
    const real = countsSince(kidActivityLedgers(
      { speech: empty, mimic: empty, missions: empty, adventures: empty, events: { items: [{ kind: "memory-match", timestamp: at }] } },
      [{ completedAt: at }],
    ), OPENED);
    expect(real).toEqual({ practice: 1, hero: 1 });
  });

  it("the toast carries a Keep action (so it never auto-removes) that writes one moment", () => {
    expect(recap).toMatch(/toast\(line, "info", \{/);
    expect(recap).toContain('t("elev.learnCare.kidExit.keep")');
    expect((recap.match(/addMoment\(/g) ?? []).length).toBe(1);
    const toastCtx = read("context/ToastContext.tsx");
    // an action toast is never auto-removed; the kid lock queues it until exit
    expect(toastCtx).toContain("if (!action) setTimeout(() => remove(id), 4000);");
    expect(toastCtx).toMatch(/if \(isKidModeActive\(\)\) \{\s*queueRef\.current\.push/);
  });

  it("the Keep label exists in EN and HE", () => {
    expect(en["elev.learnCare.kidExit.keep"]).toBeTruthy();
    expect(he["elev.learnCare.kidExit.keep"]).toBeTruthy();
    expect(he["elev.learnCare.kidExit.keep"]).not.toBe(en["elev.learnCare.kidExit.keep"]);
  });
});
