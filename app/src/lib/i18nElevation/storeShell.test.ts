/**
 * Wave T lane S — storeShell module contract + the i18n HONESTY guard (MOB-13).
 *
 *  1. EN/HE key parity, elev.storeshell.* namespace, registered in index.ts.
 *  2. Honesty: no shipped key may promise "we'll email / notify / let you know"
 *     unless the request is actually persisted (api.requestAccess →
 *     auth.accessReceived). The two pre-launch promises still in the base
 *     dictionary (set.plan.checkoutSoon, ac.notify*) are dead copy owned by
 *     lane T: they must have ZERO references in shipped source until deleted.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { en, he } from "./storeShell";
import { elevationEn, elevationHe } from "./index";
import { en as baseEn, he as baseHe } from "../i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");

describe("storeShell module contract", () => {
  it("EN and HE key sets are identical, non-empty, elev.storeshell.* namespaced, translated", () => {
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(Object.keys(he).sort());
    expect(enKeys.length).toBeGreaterThan(20);
    for (const k of enKeys) {
      expect(k.startsWith("elev.storeshell."), `${k} escapes the namespace`).toBe(true);
      expect(en[k].trim()).not.toBe("");
      expect(he[k].trim()).not.toBe("");
      // store names are proper nouns and may match; everything else is transcreated
      if (!k.startsWith("elev.storeshell.store.")) expect(he[k], `${k} not translated`).not.toBe(en[k]);
    }
  });

  it("is registered in the Elevation merge (index.ts) and no base key shadows it", () => {
    expect(elevationEn["elev.storeshell.pw.disclosure"]).toBe(en["elev.storeshell.pw.disclosure"]);
    expect(elevationHe["elev.storeshell.pw.disclosure"]).toBe(he["elev.storeshell.pw.disclosure"]);
    for (const k of Object.keys(en)) expect(baseEn[k], `${k} shadowed by lib/i18n.ts`).toBeUndefined();
  });
});

/* ── MOB-13 honesty guard ──────────────────────────────────────────────────── */

// First-person promises of a follow-up nobody sends.
const PROMISE_EN = /\bwe['’]ll (email|notify|let you know|tell you|be in touch|follow up)\b|\bnotify you\b|\bemail you\b|\btell me when\b/i;
const PROMISE_HE = /נעדכן אתכם|נודיע לכם|נשלח לכם|עדכנו אותי/;

/** Keys allowed to promise: the request IS persisted (api.requestAccess). */
const PERSISTED_PROMISES = new Set(["auth.accessReceived"]);

/** Dead pre-launch copy — lane T owns lib/i18n.ts; until deleted these must be unreferenced. */
const DEAD_PENDING_LANE_T = new Set<string>([]); // Wave T: the three pre-launch keys were deleted from lib/i18n.ts

const shippedFiles = (() => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) { if (!["node_modules", "server", "routes", "config"].includes(name)) walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(name) || /\.test\./.test(name)) continue;
      if (p.endsWith(path.join("lib", "i18n.ts"))) continue;
      out.push(p);
    }
  };
  walk(SRC);
  return out.map((p) => ({ rel: path.relative(SRC, p).replace(/\\/g, "/"), code: readFileSync(p, "utf8") }));
})();

const promisingKeys = (dict: Record<string, string>, re: RegExp) => Object.keys(dict).filter((k) => re.test(dict[k]));

describe("MOB-13 — no shipped key promises an email/notification nobody sends", () => {
  const offendersEn = promisingKeys({ ...elevationEn, ...baseEn }, PROMISE_EN);
  const offendersHe = promisingKeys({ ...elevationHe, ...baseHe }, PROMISE_HE);

  it("every promising key is either persisted (allow-list) or dead copy pending lane-T deletion", () => {
    const unknown = [...new Set([...offendersEn, ...offendersHe])].filter((k) => !PERSISTED_PROMISES.has(k) && !DEAD_PENDING_LANE_T.has(k));
    expect(unknown, `new promise copy: ${unknown.join(", ")}`).toEqual([]);
  });

  it("the dead pre-launch keys have ZERO references in shipped source", () => {
    for (const key of DEAD_PENDING_LANE_T) {
      const refs = shippedFiles.filter((f) => f.code.includes(`"${key}"`)).map((f) => f.rel);
      expect(refs, `${key} is still reachable from ${refs.join(", ")}`).toEqual([]);
    }
  });

  it("the storeShell module itself makes no promise in either language", () => {
    expect(promisingKeys(en, PROMISE_EN)).toEqual([]);
    expect(promisingKeys(he, PROMISE_HE)).toEqual([]);
  });

  it("negative control: the scan catches the pre-fix copy", () => {
    expect(PROMISE_EN.test("Thanks! We'll let you know the moment Arbor Plus checkout is ready.")).toBe(true);
    expect(PROMISE_EN.test("Checkout isn't live yet — we'll email you the moment it opens.")).toBe(true);
    expect(PROMISE_EN.test("Tell me when Plus launches")).toBe(true);
    expect(PROMISE_HE.test("תודה! נעדכן אתכם ברגע שתשלום ארבור פלוס יהיה מוכן.")).toBe(true);
    // …and the allow-listed persisted copy is a promise too (so the allow-list is load-bearing)
    expect(PROMISE_EN.test(baseEn["auth.accessReceived"])).toBe(true);
  });
});
