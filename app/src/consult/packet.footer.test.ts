/**
 * B-CAREPRO-47 — every packet, school brief and report export ends with the
 * ONE Arbor line (EN + HE): who prepared it, with what, and the account-free
 * page that explains it to a professional. Two egress paths carry documents
 * out: the packet's copied/sent text (serializeForExport) and the print shell
 * every PDF uses (lib/reportExport renderPrintableHtml: the packet's Save as
 * PDF, the School brief and Reports). Both end with the same key.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildConsultPacket, EXPORT_AUDIENCES, serializeForExport, type BuildPacketInput } from "./packet";
import { arborDocumentLine, renderPrintableHtml } from "../lib/reportExport";
import { translate } from "../lib/i18n";
import { FOR_PROFESSIONALS_URL } from "../lib/legalLinks";

const NOW = Date.UTC(2026, 9, 2);
const FIXTURE: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, languages: ["Hebrew"], schoolContext: "Gan", strengths: ["curious"], challenges: [] },
  logs: [{ behaviorType: "Moment", intensity: 1, timestamp: new Date(NOW - 86_400_000).toISOString(), trigger: "Built a tower" }],
  milestones: [{ domain: "communication", title: "Says two-word phrases", checked: true, status: "yes", observedAt: new Date(NOW - 5 * 86_400_000).toISOString() }],
  plans: [],
  memory: [],
  nowMs: NOW,
};
const LANGS = ["en", "he"] as const;
const lastLine = (md: string) => md.trim().split("\n").filter((l) => l.trim()).pop()!.replace(/^_(.*)_$/, "$1");
const visibleTail = (html: string) => html.replace(/<script>[\s\S]*?<\/script>/g, "").replace(/\s+<\/body>[\s\S]*$/, "").trim();

describe("B-CAREPRO-47 · the one Arbor line", () => {
  it("is one key, EN + HE, naming the account-free page", () => {
    const host = FOR_PROFESSIONALS_URL.replace(/^https:\/\//, "");
    expect(host).toBe("arborparentingapp.com/for-professionals");
    for (const lang of LANGS) {
      const line = arborDocumentLine(lang);
      expect(line).toBe(translate(lang, "elev.reports.arborLine"));
      expect(line).toContain(host);
    }
    expect(arborDocumentLine("he")).not.toBe(arborDocumentLine("en"));
    // Critic r1: the Hebrew line lands on the page's Hebrew section.
    expect(arborDocumentLine("he")).toContain(`${host}#he`);
    expect(arborDocumentLine("en")).not.toContain("#he");
    expect(arborDocumentLine("he")).toMatch(/[֐-׿]/);
  });

  it("every copied/sent packet (each clinician preset and my records) ends with it, EN + HE", () => {
    const packet = buildConsultPacket(FIXTURE);
    for (const lang of LANGS) {
      for (const audience of EXPORT_AUDIENCES.filter((a) => a !== "teacher")) {
        for (const note of ["", "Please ask about the countdown."]) {
          expect(lastLine(serializeForExport(audience, packet, new Set(), note, "Parent note", lang)), `${lang} ${audience}`).toBe(arborDocumentLine(lang));
        }
      }
    }
  });

  it("every printed document (packet PDF, School brief, Reports) ends with it, EN + HE", () => {
    for (const lang of LANGS) {
      const html = renderPrintableHtml({ title: "School brief", subtitle: "Dylan", sections: [{ heading: "Strengths", body: ["curious"] }] }, "Dylan", lang);
      const tail = visibleTail(html);
      expect(tail.endsWith(`<p class="arbor-line" data-arbor-line dir="${lang === "he" ? "rtl" : "ltr"}">${arborDocumentLine(lang).replace(/'/g, "&#39;")}</p>`), lang).toBe(true);
      expect(html.indexOf("data-arbor-line")).toBeGreaterThan(html.indexOf('class="footer"'));
    }
    // the three document families reach that shell
    const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
    expect(read("components/sections/SchoolBrief.tsx")).toContain("void openPrintableReport(");
    expect(read("components/sections/Reports.tsx")).toContain("openPrintableReport(doc, childProfile.name, uiLang)");
    expect(read("lib/reportExport.ts")).toMatch(/export async function openPrintableReport[\s\S]{0,200}renderPrintableHtml\(doc, childName, lang\)/);
  });

  it("NEGATIVE CONTROL: the pre-change shell ended on the non-diagnostic footer", () => {
    const pre = `<div class="footer">Arbor is non-diagnostic</div>\n  <script>window.onload=function(){}</script>\n  </body></html>`;
    expect(visibleTail(pre).endsWith("</div>")).toBe(true);
    expect(pre).not.toContain("data-arbor-line");
  });
});
