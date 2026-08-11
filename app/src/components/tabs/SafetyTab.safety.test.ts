/* W0.2 — Safety screen can actually summon help.
 *
 * Node-env guard suite (tokens.test.ts style): the vitest config runs .test.ts
 * in a node environment, so SafetyTab is verified at the source level — the
 * same technique as the bg-white / hex-creep guards — plus direct assertions
 * on the two data modules it renders from. Deliberately does NOT import
 * src/lib/i18nElevation/index.ts: the module records are tested directly so
 * this suite is independent of the orchestrator's registry wiring. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  escalationCategories,
  FIND_A_HELPLINE_URL,
  HELPLINE_DIRECTORY,
} from "../../safety/escalation";
import { en as safetyEnRecord, he as safetyHeRecord, safetyEn, safetyHe } from "../../lib/i18nElevation/safety";

const here = path.dirname(fileURLToPath(import.meta.url));
const tabSource = readFileSync(path.join(here, "SafetyTab.tsx"), "utf8");

/* ── 1 · Helpline directory: complete, dialable, and drift-locked ──────────── */

describe("HELPLINE_DIRECTORY — structured crisis numbers", () => {
  it("carries every masterplan-mandated number", () => {
    const numbers = new Set(HELPLINE_DIRECTORY.map((h) => h.number));
    for (const required of ["1201", "101", "100", "112", "0800-0113", "1813", "1712", "988", "911"]) {
      expect(numbers.has(required), `missing crisis number ${required}`).toBe(true);
    }
  });

  it("every entry has a dialable tel: target (digits/+ only) and a unique id", () => {
    const ids = new Set<string>();
    for (const h of HELPLINE_DIRECTORY) {
      expect(h.tel, `${h.id} tel must be dialable`).toMatch(/^\+?\d+$/);
      expect(ids.has(h.id), `duplicate helpline id ${h.id}`).toBe(false);
      ids.add(h.id);
    }
  });

  it("cannot drift from the coach-side escalation markdown (single source of numbers)", () => {
    const markdown = escalationCategories.map((c) => c.resources).join("\n");
    for (const h of HELPLINE_DIRECTORY) {
      expect(markdown.includes(h.number), `${h.id} (${h.number}) no longer appears in escalation resources`).toBe(true);
    }
    expect(markdown.includes(FIND_A_HELPLINE_URL)).toBe(true);
  });
});

/* ── 2 · SafetyTab source: tel links, analytics, loading, no English ───────── */

describe("SafetyTab.tsx — renders help, not prose", () => {
  it("renders every helpline as a tel: link (maps the full directory)", () => {
    // The component maps HELPLINE_DIRECTORY (filtered per region group) into
    // <a href={`tel:${h.tel}`}> — so directory coverage == rendered coverage
    // provided every region in the directory is in the rendered group list.
    expect(tabSource).toContain("HELPLINE_DIRECTORY");
    expect(tabSource).toContain("href={`tel:${h.tel}`}");
    const groupsMatch = tabSource.match(/HELPLINE_GROUPS[^=]*=\s*\[([^\]]+)\]/);
    expect(groupsMatch, "HELPLINE_GROUPS render list must exist").not.toBeNull();
    const renderedRegions = new Set([...groupsMatch![1].matchAll(/"(\w+)"/g)].map((m) => m[1]));
    for (const h of HELPLINE_DIRECTORY) {
      expect(renderedRegions.has(h.region), `region ${h.region} (${h.id}) is not in the rendered group list`).toBe(true);
    }
  });

  it("links the international directory and saved-contact phones as tel:", () => {
    expect(tabSource).toContain("FIND_A_HELPLINE_URL");
    expect(tabSource).toContain("tel:${dialable(c.phone)}");
  });

  it("tracks helpline and contact tel taps", () => {
    expect(tabSource).toContain('track("safety_helpline_tel_tap", { code: h.tel })');
    expect(tabSource).toContain('track("safety_contact_tel_tap")');
  });

  it("respects contactsCol.loaded with a Skeleton loading state", () => {
    expect(tabSource).toContain("contactsCol.loaded");
    expect(tabSource).toMatch(/<Skeleton\b/);
  });

  it("contains no hardcoded-English UI literals (all copy flows through t())", () => {
    const forbidden = [
      "Crisis script",
      "Safety & Escalation",
      "Care Network",
      "Emergency contacts",
      "Mark reviewed",
      "Last reviewed",
      "What Arbor knows",
      "Sudden loss of previously mastered",
      "Escalation checklist",
      "Any checked sign",
      "No approved memory yet",
      "Medical escalation safeguard",
      "GDPR & data minimization",
      "Multi-professional handoff",
      "I am here. You are safe.",
      ">Forget<",
      ">never<",
    ];
    for (const literal of forbidden) {
      expect(tabSource.includes(literal), `hardcoded English literal in SafetyTab.tsx: "${literal}"`).toBe(false);
    }
    // Placeholders must be localized too — no raw placeholder="…" literals.
    expect(tabSource).not.toMatch(/placeholder="/);
    // PageHeader silently drops `eyebrow`; passing it is dead weight.
    expect(tabSource).not.toMatch(/\beyebrow=/);
  });
});

/* ── 3 · i18n module: en/he parity and full key coverage ───────────────────── */

describe("i18nElevation/safety — en/he records", () => {
  it("exports the registry contract (en/he) and the masterplan aliases (safetyEn/safetyHe)", () => {
    expect(safetyEn).toBe(safetyEnRecord);
    expect(safetyHe).toBe(safetyHeRecord);
  });

  it("en and he carry the identical key set, all namespaced elev.safety.*", () => {
    const enKeys = Object.keys(safetyEnRecord).sort();
    const heKeys = Object.keys(safetyHeRecord).sort();
    expect(enKeys).toEqual(heKeys);
    for (const k of enKeys) expect(k, `non-namespaced key ${k}`).toMatch(/^elev\.safety\./);
  });

  it("every Hebrew value is real Hebrew; English values carry none", () => {
    const HEBREW = /[֐-׿]/;
    for (const [k, v] of Object.entries(safetyHeRecord)) {
      expect(v.trim().length, `${k} (he) is empty`).toBeGreaterThan(0);
      expect(HEBREW.test(v), `${k} (he) contains no Hebrew: "${v}"`).toBe(true);
    }
    for (const [k, v] of Object.entries(safetyEnRecord)) {
      expect(v.trim().length, `${k} (en) is empty`).toBeGreaterThan(0);
      expect(HEBREW.test(v), `${k} (en) contains Hebrew`).toBe(false);
    }
  });

  it("covers every key SafetyTab constructs — static and template-built", () => {
    const required = new Set<string>();
    // Static t("elev.safety.…") calls lifted from the component source.
    for (const m of tabSource.matchAll(/t\(\s*[`"](elev\.safety\.[^"`$]+)[`"]/g)) required.add(m[1]);
    // Template-built keys, reconstructed from their driving data.
    for (const h of HELPLINE_DIRECTORY) {
      required.add(`elev.safety.helpline.${h.id}`);
      required.add(`elev.safety.helplines.group.${h.region}`);
    }
    for (const n of [1, 2, 3, 4, 5, 6]) required.add(`elev.safety.sign.${n}`);
    for (const g of ["medical", "gdpr", "handoff"]) {
      required.add(`elev.safety.guard.${g}.title`);
      required.add(`elev.safety.guard.${g}.body`);
    }
    expect(required.size).toBeGreaterThan(30); // sanity: extraction actually ran
    for (const k of required) {
      expect(k in safetyEnRecord, `missing en key ${k}`).toBe(true);
      expect(k in safetyHeRecord, `missing he key ${k}`).toBe(true);
    }
  });
});
