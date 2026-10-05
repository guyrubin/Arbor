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

/* ── 4 · B-CAREPRO-03 — a ticked crisis sign has a door, not only a pink row ── */

import { helplineOrderFor } from "../../safety/escalation";

describe("B-CAREPRO-03 — ticked sign renders a tel: link", () => {
  const src = tabSource.replace(/\r\n/g, "\n");

  it("ticked sign renders a tel: link to the page's primary helpline, inside the checklist card", () => {
    const card = /<SectionCard title=\{t\("elev\.safety\.checklist\.title"\)\}[\s\S]*?<\/SectionCard>/.exec(src);
    expect(card, "checklist card extracted").toBeTruthy();
    const row = /\{anySignTicked && \([\s\S]*?<\/a>\s*\)\}/.exec(card![0]);
    expect(row, "the call row is conditional on a ticked sign and lives inside the checklist card").toBeTruthy();
    expect(row![0]).toContain("href={`tel:${primaryHelpline.tel}`}");
    expect(row![0]).toContain("{primaryHelpline.number}");
    expect(row![0]).toContain('t("elev.safety.signs.callRow")');
    // untick → row gone: the flag derives from the persisted checked map only
    expect(src).toContain("const anySignTicked = WARNING_SIGN_KEYS.some((_, i) => !!checked[i]);");
  });

  it("HE family gets 1201 first, international gets 112 (the primary the row dials)", () => {
    const primaryFor = (hint: string) => HELPLINE_DIRECTORY.find((h) => h.region === helplineOrderFor(hint)[0])!;
    expect(primaryFor("he").number).toBe("1201");
    expect(primaryFor("en").number).toBe("112");
  });

  it("law 1: ticked rows change weight, never colour", () => {
    const label = /<label key=\{n\} data-touch-shell="checklist-row"[\s\S]*?<\/label>/.exec(src);
    expect(label).toBeTruthy();
    expect(label![0]).not.toContain("pink");
    expect(label![0]).not.toMatch(/checked\[i\] \? "var\(--arbor-/);
    expect(label![0]).toMatch(/fontWeight: checked\[i\] \? 700 : 400/);
    // NEGATIVE CONTROL: the pre-change row is caught by the same rule.
    const pre = `<span style={{ color: checked[i] ? "var(--arbor-pink-ink)" : "var(--arbor-ink)", fontWeight: checked[i] ? 700 : 400 }}>`;
    expect(/checked\[i\] \? "var\(--arbor-/.test(pre)).toBe(true);
  });
});

/* ── 5 · B-CAREPRO-03 (rest, via B-CAREPRO-13) — "Prepare a conversation" ── */

describe("B-CAREPRO-03 — a ticked sign can prepare a conversation in Consult", () => {
  const src = tabSource.replace(/\r\n/g, "\n");

  it("the button is conditional on a ticked sign and lives inside the checklist card", () => {
    const card = /<SectionCard title=\{t\("elev\.safety\.checklist\.title"\)\}[\s\S]*?<\/SectionCard>/.exec(src);
    expect(card).toBeTruthy();
    const btn = /\{anySignTicked && \(\s*<button[\s\S]*?<\/button>\s*\)\}/.exec(card![0]);
    expect(btn, "prepare button extracted").toBeTruthy();
    expect(btn![0]).toContain("onClick={prepareConversation}");
    expect(btn![0]).toContain('t("elev.safety.signs.prepare")');
    expect(btn![0]).toContain("min-h-[44px]");
    expect(btn![0]).not.toMatch(/pink/);
  });

  it("the ticked labels ride in as the Consult REASON (the widened seam), then route to consult", () => {
    const fn = /const prepareConversation = \(\) => \{[\s\S]*?\n  \};/.exec(src);
    expect(fn).toBeTruthy();
    expect(fn![0]).toContain("WARNING_SIGN_KEYS.filter((_, i) => !!checked[i])");
    expect(fn![0]).toContain('requestConsultPrefill({ reason: t("elev.safety.signs.consultReason", { labels }) });');
    expect(fn![0]).toContain('setActiveTab("consult");');
    // NEGATIVE CONTROL: a bare-string call (lands as the note) fails the rule.
    expect('requestConsultPrefill(labels);').not.toContain("requestConsultPrefill({ reason:");
  });

  it("EN + HE strings exist and the reason names the labels", () => {
    for (const rec of [safetyEnRecord, safetyHeRecord]) {
      expect(rec["elev.safety.signs.prepare"]).toBeTruthy();
      expect(rec["elev.safety.signs.consultReason"]).toContain("{labels}");
    }
    expect(safetyHeRecord["elev.safety.signs.prepare"]).not.toMatch(/[A-Za-z]/);
    expect(safetyHeRecord["elev.safety.signs.consultReason"].replace("{labels}", "")).not.toMatch(/[A-Za-z]/);
  });
});

/* ── 6 · B-CAREPRO-14 — one memory ledger; no nag on a first visit ────────── */

describe("B-CAREPRO-14 — Safety links to the memory ledger and greets a first visit neutrally", () => {
  const src = tabSource.replace(/\r\n/g, "\n");

  it("no Forget control and no second memory list on Safety", () => {
    expect(src).not.toContain("handleMemoryDecision");
    expect(src).not.toContain("approvedMemoryItems");
    expect(src).not.toContain('data-module="safety-memory"');
    expect(src).not.toContain("elev.safety.memory.forget");
    // NEGATIVE CONTROL: the pre-change one-tap Forget is what the rule catches.
    expect('onClick={() => handleMemoryDecision(item.memoryId, "deleted")}').toContain("handleMemoryDecision");
  });

  it("one 44 px link row reaches the ledger", () => {
    const row = /<button[^>]*?data-testid="safety-memory-link"[\s\S]*?<\/button>/.exec(src);
    expect(row, "memory link row extracted").toBeTruthy();
    expect(row![0]).toContain('setActiveTab("memory")');
    expect(row![0]).toContain("min-h-[44px]");
    expect(row![0]).toContain('t("elev.safety.memory.link")');
  });

  it("demoted modules = 4 (helplines, checklist, contacts, safeguards)", () => {
    const demoted = [...src.matchAll(/data-module="([^"]+)" data-module-demoted/g)].map((m) => m[1]);
    expect(demoted).toEqual(["safety-helplines", "safety-checklist", "safety-contacts", "safety-safeguards"]);
  });

  it("the stale nudge needs a past review older than 30 days; never-reviewed reads 'Not reviewed yet'", () => {
    expect(src).toContain("const reviewStale = !!lastReviewed && Date.now() - new Date(lastReviewed).getTime() > 30 * 86_400_000;");
    // NEGATIVE CONTROL: the pre-change predicate fires on a first visit.
    const pre = (lastReviewed: string | null) => !lastReviewed || Date.now() - new Date(lastReviewed).getTime() > 30 * 86_400_000;
    const post = (lastReviewed: string | null) => !!lastReviewed && Date.now() - new Date(lastReviewed).getTime() > 30 * 86_400_000;
    expect(pre(null)).toBe(true);
    expect(post(null)).toBe(false);
    expect(post(new Date(Date.now() - 31 * 86_400_000).toISOString())).toBe(true);
    expect(post(new Date().toISOString())).toBe(false);
    expect(safetyEnRecord["elev.safety.review.notYet"]).toBe("Not reviewed yet");
    expect(safetyHeRecord["elev.safety.review.notYet"]).toMatch(/[֐-׿]/);
  });
});

describe("W2-CAREPRO r1 — both answers above the fold; the CTA says who answers", () => {
  it("dangerLineFor: HE (ERAN first) → the danger call dials MDA 101; EN (112 first) → names an emotional line", async () => {
    const { dangerLineFor, helplineOrderFor, HELPLINE_DIRECTORY: DIR } = await import("../../safety/escalation");
    const he = helplineOrderFor("he");
    const hePrimary = DIR.find((h) => h.region === he[0])!;
    expect(hePrimary.id).toBe("il_eran");
    const heLine = dangerLineFor(he, hePrimary)!;
    expect(heLine.kind).toBe("emergency");
    if (heLine.kind === "find") throw new Error("HE must dial MDA");
    expect(heLine.entry.tel).toBe("101");
    expect(heLine.entry.tel).not.toBe(hePrimary.tel);
    const en = helplineOrderFor("en");
    const enPrimary = DIR.find((h) => h.region === en[0])!;
    expect(enPrimary.id).toBe("eu_112");
    // W2-CAREPRO r2 (P0): the EU group holds only 112 — an unknown market is
    // never handed Israel's ERAN under "EU-wide"; it gets the by-country door.
    const enLine = dangerLineFor(en, enPrimary)!;
    expect(enLine.kind).toBe("find");
    expect("entry" in enLine).toBe(false);
  });

  it("the danger call is a 44 px tel: link in the crisis card, no second stamp", () => {
    const card = tabSource.slice(tabSource.indexOf('data-module="safety-crisis-language"'), tabSource.indexOf('data-module-disclosure="safety-more"'));
    expect((card.match(/data-testid="safety-danger-call"/g) ?? []).length).toBe(2);
    expect(card).toContain("href={`tel:${dangerLine.entry.tel}`}");
    expect(card).toContain("min-h-[44px]");
    expect((tabSource.match(/data-primary-move="/g) ?? []).length).toBe(1);
    for (const k of ["elev.safety.crisis.dangerCall", "elev.safety.crisis.talkLine"]) {
      expect(safetyEnRecord[k as keyof typeof safetyEnRecord]).toContain("{number}");
      expect(safetyHeRecord[k as keyof typeof safetyHeRecord]).toContain("{number}");
    }
  });

  it("the primary CTA never truncates who answers, uses no opacity hierarchy and is the CTA gradient", () => {
    const cta = tabSource.slice(tabSource.indexOf('data-primary-move="call-helpline"'), tabSource.indexOf("</a>", tabSource.indexOf('data-primary-move="call-helpline"')));
    expect(cta).not.toMatch(/\btruncate\b/);
    expect(cta).not.toMatch(/opacity-\d/);
    expect(cta).toContain("var(--gradient-cta)");
    expect(cta).not.toContain('background: "var(--arbor-pink-ink)"');
    expect(cta).toContain("whitespace-nowrap");
    // NEGATIVE CONTROL: the pre-change sub-label is caught
    const pre = `<span className="text-[12px] font-bold opacity-90 truncate">{t(x)}</span>`;
    expect(/\btruncate\b/.test(pre) && /opacity-\d/.test(pre)).toBe(true);
  });
});

describe("B-CAREPRO-NEW-1m / 1n — the crisis card names the child, shows the review date, and the family's own first call", () => {
  it("1m: the numbers-checked line reads HELPLINES_REVIEWED_ON (no literal date) in EN + HE", () => {
    expect(tabSource).toContain('data-testid="safety-numbers-checked"');
    expect(tabSource).toContain("fmtDay(HELPLINES_REVIEWED_ON, uiLang)");
    expect(tabSource).not.toMatch(/Numbers checked \d/);
    expect(safetyEnRecord["elev.safety.numbersChecked" as keyof typeof safetyEnRecord]).toContain("{date}");
    expect(safetyHeRecord["elev.safety.numbersChecked" as keyof typeof safetyHeRecord]).toContain("{date}");
  });
  it("1n: the kicker names the child (fallback to the generic kicker); the script uses the editorial face at 60ch", () => {
    expect(tabSource).toContain('crisisFirstName ? t("elev.safety.crisis.kickerNamed", { name: `\u2068${crisisFirstName}\u2069` }) : t("elev.safety.crisis.kicker")');
    expect(tabSource).toContain("max-w-[60ch]");
    expect(tabSource).toContain('fontFamily: uiLang === "he" ? "var(--font-display)" : "var(--font-editorial)"');
    for (const rec of [safetyEnRecord, safetyHeRecord]) expect(rec["elev.safety.crisis.kickerNamed" as keyof typeof rec]).toContain("{name}");
  });
  it("1n: the first saved contact is a 44 px tel: row under the one tap — not a module, not a stamp", () => {
    const at = tabSource.indexOf('data-testid="safety-first-contact"');
    expect(at).toBeGreaterThan(tabSource.indexOf('data-primary-move="call-helpline"'));
    expect(at).toBeLessThan(tabSource.indexOf('data-module="safety-crisis-language"'));
    const row = tabSource.slice(tabSource.lastIndexOf("<a", at), tabSource.indexOf("</a>", at));
    expect(row).toContain("min-h-[44px]");
    expect(row).toContain("tel:${dialable(contacts[0].phone)}");
    expect(row).not.toContain("data-module");
    expect(row).toContain("<bdi");
  });
});

/* W2-CAREPRO c2 r1 (safety product P1 G0 + design P1 G1) — the page promises
 * only what it keeps, and paints one gradient (the CTA). "Nothing here is
 * saved" sat above saved contacts and localStorage-persisted ticks. */
describe("W2-CAREPRO c2 r1 — copy versus persistence; flat crisis wash", () => {
  const NOTHING_SAVED = /nothing[^.]*(saved|kept|stored)|לא נשמר|לא נשמרים/i;
  const safetyCopy = (rec: Record<string, string>) =>
    Object.entries(rec).filter(([k]) => k.startsWith("elev.safety.")).map(([k, v]) => `${k}: ${v}`);
  const persists = (source: string) => /localStorage\.setItem|\.upsert\(|setDoc\(|addDoc\(/.test(source);

  it("the subtitle keeps its word in EN and HE", () => {
    expect(safetyEnRecord["elev.safety.header.sub" as keyof typeof safetyEnRecord]).toBe("One tap reaches a person. Arbor never records the call.");
    expect(safetyHeRecord["elev.safety.header.sub" as keyof typeof safetyHeRecord]).toBe("לחיצה אחת ואדם עונה. ארבור לא מתעדת את השיחה.");
  });

  it("no Safety string claims nothing is saved while SafetyTab persists anything", () => {
    expect(persists(tabSource), "the screen does persist (contacts, review date)").toBe(true);
    for (const rec of [safetyEnRecord, safetyHeRecord] as Record<string, string>[]) {
      const hits = safetyCopy(rec).filter((line) => NOTHING_SAVED.test(line));
      expect(hits).toEqual([]);
    }
  });

  it("NEGATIVE CONTROL: the pre-fix subtitle trips the scan in both locales", () => {
    expect(NOTHING_SAVED.test("One tap reaches a person. Nothing here is saved.")).toBe(true);
    expect(NOTHING_SAVED.test("לחיצה אחת ואדם עונה. שום דבר כאן לא נשמר.")).toBe(true);
  });

  it("the warning-sign ticks are session-only: never written, never read back", () => {
    expect(tabSource).not.toContain("arbor.safetyChecklist");
    expect(tabSource).not.toMatch(/localStorage\.setItem\(checklistKey/);
    const writes = [...tabSource.matchAll(/localStorage\.setItem\((\w+)/g)].map((m) => m[1]);
    expect(writes).toEqual(["reviewedKey"]);
  });

  it("the crisis card and its chip are a flat wash — the CTA is the page's one gradient", () => {
    expect(tabSource).not.toContain("var(--arbor-pink-soft)");
    expect((tabSource.match(/var\(--arbor-pink-wash\)/g) ?? []).length).toBe(2);
    const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "index.css"), "utf8");
    const wash = /--arbor-pink-wash:\s*([^;]+);/.exec(css);
    expect(wash?.[1].trim()).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
