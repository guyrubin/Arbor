import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* B-LOOP-12 — the professional view: the back link to the parent view is the
   first control; eight domain sections in registry order; the owning
   professions as TEXT (rendered only here and in Care — the grep pin below);
   counts only; the intake packet as labelled lines with the standing
   non-diagnostic line and the demo header; EN + HE; no firewall word. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import ProView, { proCountsLine } from "./ProView";
import { DOMAIN_IDS } from "../../lib/domains/registry";
import { DEMO_HEADER_KEY, INTAKE_PROFESSIONS, buildIntakePacket, type ConsultPacket } from "../../consult/packet";
import { proDomainCounts } from "../../lib/journal/shelfView";
import { shelfDef } from "../../lib/shelves/registry";
import { toObservations } from "../../lib/observations";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";
import type { BehaviorLog } from "../../types";
import type { ActionLoopEntry } from "../../actionLoop/model";

const NOW = new Date("2026-10-06T12:00:00Z");
const logs = [
  { id: "w1", behaviorType: "A moment", trigger: "Said big ball at the park", timestamp: "2026-09-29T08:00:00Z", context: "home", shelf: "words" },
  { id: "m1", behaviorType: "A moment", trigger: "Climbed the ladder", timestamp: "2026-10-02T08:00:00Z", context: "home", shelf: "moving" },
] as unknown as BehaviorLog[];
const doses = [{ id: "d1", recommendation: "x", source: "practice", capacity: "tiny", status: "completed", acceptedAt: "2026-10-01T08:00:00Z", practiceId: "p1", shelf: "words" }] as ActionLoopEntry[];
const child = { id: "c1", name: "Dylan", age: 3, demo: true };
const counts = proDomainCounts(toObservations({ behaviorLogs: logs, actionLoops: doses }, child), (s) => shelfDef(s).domain, NOW);
const packetFor = (lang: "en" | "he"): ConsultPacket =>
  buildIntakePacket("slp", { child, milestones: [], behaviorLogs: logs, actionLoops: doses, questions: ["Is the lisp worth a look?"], nowMs: NOW.getTime(), lang });

const noop = () => undefined;
const render = (lang: "en" | "he" = "en") => {
  state.lang = lang;
  return renderToStaticMarkup(
    <ProView childName="Dylan" profession="slp" onSelectProfession={noop} packet={packetFor(lang)} questions="" onQuestionsChange={noop} onEgress={noop} counts={counts} onBack={noop} primaryMoveProps={{ "data-primary-move": "open-shelf" }} />,
  );
};
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

describe("ProView — the professional view", () => {
  it("the flip back to the parent view is the FIRST control", () => {
    const first = render().match(/<(button|a|input|textarea)\b[^>]*>/)!;
    expect(first[0]).toContain('data-testid="pro-back"');
  });

  it("eight domain sections in registry order, each naming its shelves, its professions as text and counts only (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render(lang);
      const domains = [...html.matchAll(/data-testid="pro-domain" data-domain="([a-z]+)"/g)].map((m) => m[1]);
      expect(domains).toEqual([...DOMAIN_IDS]);
      expect(domains).toHaveLength(8);
      const profs = [...html.matchAll(/data-testid="pro-domain-professions"[^>]*>([^<]*)</g)].map((m) => decode(m[1]));
      expect(profs[0]).toBe(translate(lang, "elev.professions.slp") + " · " + translate(lang, "elev.professions.audiology"));
      for (const p of profs) expect(p).not.toMatch(/elev\.professions\./);
      const countLines = [...html.matchAll(/data-testid="pro-domain-counts"[^>]*>([^<]*)</g)].map((m) => decode(m[1]));
      expect(countLines[0]).toBe(proCountsLine(counts.get("talking"), (k, v) => translate(lang, k, v)));
      expect(countLines[DOMAIN_IDS.indexOf("thinking")]).toBe(translate(lang, "elev.shelfJournal.pro.count.none"));
      for (const c of countLines) expect(c).not.toMatch(/%|\b0\b/);
    }
  });

  it("the intake packet: chips (selected = navy fill), five labelled lines, the non-diagnostic line and the demo header", () => {
    const html = render();
    expect([...html.matchAll(/data-profession="([a-z]+)"/g)].map((m) => m[1])).toEqual([...INTAKE_PROFESSIONS]);
    expect(html).toMatch(/aria-checked="true"[^>]*data-profession="slp"[^>]*style="background:var\(--arbor-subtab-active\)/);
    expect([...html.matchAll(/data-testid="pro-packet-line" data-section="([a-z-]+)"/g)].map((m) => m[1])).toEqual(["intake-seen", "intake-not-yet", "intake-moments", "intake-practice", "intake-questions"]);
    expect(text(html)).toContain("Said big ball at the park");
    expect(text(html)).not.toContain("Climbed the ladder");
    expect(text(html)).toContain(translate("en", "elev.packet.prepared", { date: "2026-10-06" }));
    expect(html).toContain('data-testid="pro-packet-demo"');
    expect(text(html)).toContain(translate("en", DEMO_HEADER_KEY));
    for (const v of ["pdf", "copy", "send"]) expect(html).toMatch(new RegExp(`data-testid="pro-egress-${v}"[^>]*min-h-11|min-h-11[^>]*data-testid="pro-egress-${v}"`));
  });

  it("P5-LOOP c2 r1 (G0): the packet's verbs sit under its title, BEFORE the lines; each line folds to 3 under ONE 'Show all' (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render(lang);
      const actions = html.indexOf('data-testid="pro-packet-actions"');
      expect(actions).toBeGreaterThan(html.indexOf('data-testid="pro-packet-prepared"'));
      expect(actions).toBeLessThan(html.indexOf('data-testid="pro-packet-line"'));
      expect(html.indexOf('data-testid="pro-egress-pdf"')).toBeLessThan(html.indexOf('data-testid="pro-packet-line"'));
      // the base packet has no line over 3 → no toggle
      expect(html).not.toContain('data-testid="pro-packet-show-all"');
      const base = packetFor(lang);
      const long: ConsultPacket = {
        ...base,
        sections: base.sections.map((sec) => sec.id === "intake-moments"
          ? { ...sec, items: [1, 2, 3, 4, 5].map((n) => ({ ...(sec.items[0] ?? { id: "x", text: "" }), id: `m${n}`, text: `Moment number ${n}` })) }
          : sec),
      };
      state.lang = lang;
      const folded = renderToStaticMarkup(
        <ProView childName="Dylan" profession="slp" onSelectProfession={noop} packet={long} questions="" onQuestionsChange={noop} onEgress={noop} counts={counts} onBack={noop} primaryMoveProps={{ "data-primary-move": "open-shelf" }} />,
      );
      expect(text(folded)).toContain("Moment number 3");
      expect(text(folded)).not.toContain("Moment number 4");
      const toggle = folded.match(/<button[^>]*data-testid="pro-packet-show-all"[^>]*>/g) ?? [];
      expect(toggle).toHaveLength(1);
      expect(toggle[0]).toMatch(/aria-expanded="false"/);
      expect(toggle[0]).toMatch(/min-h-11/);
      expect(text(folded)).toContain(translate(lang, "elev.shelfJournal.pro.showAll"));
    }
  });

  it("three modules, one stamp (the packet's first verb)", () => {
    const html = render();
    expect([...html.matchAll(/data-module="([a-z-]+)"/g)].map((m) => m[1])).toEqual(["pro-header", "pro-packet", "pro-domains"]);
    expect((html.match(/data-primary-move=/g) || []).length).toBe(1);
    expect(html).toMatch(/data-testid="pro-egress-pdf"[^>]*data-primary-move="open-shelf"/);
  });

  it("no firewall word, no verdict, no %, no claim the app cannot keep (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const out = text(render(lang));
      expect(loopFirewallHits(out)).toEqual([]);
      expect(out).not.toMatch(/%|nothing is added|לא נוסף/i);
    }
  });

  it("tokens and logical properties only (source); no gradient on the view", () => {
    const src = readFileSync(path.resolve(__dirname, "ProView.tsx"), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\b(ml|mr|pl|pr)-\d|\bleft-\d|\bright-\d/);
    expect(src).not.toMatch(/gradient|-grad[)"]/);
  });
});

/** GREP PIN (B-LOOP-12 acceptance): professions render as text ONLY in the
 *  professional view and in Care. No component outside components/journal/
 *  ProView.tsx and components/care|consult imports the professions
 *  dictionary or spells one of its keys. */
describe("grep pin — professions are rendered only in ProView and Care", () => {
  const COMPONENTS = path.resolve(__dirname, "..");
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
    }
    return out;
  };
  const allowed = (rel: string) => rel === "journal/ProView.tsx" || rel.startsWith("care/") || rel.startsWith("consult/");

  it("only the allowed files import i18nElevation/professions or spell an elev.professions key", () => {
    const offenders = walk(COMPONENTS)
      .map((f) => ({ rel: path.relative(COMPONENTS, f).split(path.sep).join("/"), src: readFileSync(f, "utf8") }))
      .filter((f) => /i18nElevation\/professions|elev\.professions\./.test(f.src))
      .filter((f) => !allowed(f.rel))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("negative control: ProView itself is caught by the scan", () => {
    const src = readFileSync(path.resolve(__dirname, "ProView.tsx"), "utf8");
    expect(/i18nElevation\/professions/.test(src)).toBe(true);
  });
});
