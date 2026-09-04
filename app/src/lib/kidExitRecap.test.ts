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
import { countsSince, kidExitRecapLine, totalActivity, type KidActivityLedgers } from "./kidExitRecap";
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
