/** W2 supersedes R18 visual reordering: purpose, packet, review share one reading order. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const ASK = readFileSync(new URL("./AskSpecialist.tsx", import.meta.url), "utf8");
const CONSULT = readFileSync(new URL("../tabs/ConsultTab.tsx", import.meta.url), "utf8");
const body = ASK.slice(ASK.indexOf("/* W2: one DOM/visual sequence"));
const ordered = (src: string) => {
 const markers = ['data-testid="consult-reason-section"', 't("care.packet.title")', '{packetContract}', 'data-testid="consult-review-export"'];
 let at = -1;
 return markers.every(marker => { const next=src.indexOf(marker,at+1); const good=next>at; at=next; return good; });
};
describe("W2 Care — coherent purpose and share flow", () => {
 it("purpose precedes the full packet, contract and review/export in DOM and visual order", () => {
   expect(ordered(body)).toBe(true);
   expect(body).not.toMatch(/max-md:order-[234]/);
 });
 it("NEGATIVE CONTROL: packet-first visual order is rejected", () => {
   const old = 't("care.packet.title") data-testid="consult-reason-section" {packetContract} data-testid="consult-review-export"';
   expect(ordered(old)).toBe(false);
 });
 it("export controls follow rather than cover the packet", () => {
   expect(body).not.toContain("sticky bottom-");
   expect(body).not.toContain("fixed bottom-");
   expect(body).toContain('id="consult-audience-row"');
   expect(CONSULT).toContain('document.getElementById("consult-audience-row")');
 });
 it("the hub provides the only introduction without removing purpose hints", () => {
   expect(body).not.toContain('consult-section-header');
   expect(body).not.toMatch(/<h1[\s>]/);
   for (const key of ['elev.learnCare.reason.label','elev.learnCare.reason.hint','elev.learnCare.reason.placeholder','elev.learnCare.reason.missing']) expect(body).toContain(key);
   expect(CONSULT).toContain('elev.wave2Knowledge.care.sub');
 });
 it("all three contract promises remain in a single reusable disclosure", () => {
   expect(ASK).toContain('const CONTRACT_TILES = [');
   for (const key of ['consult.contract.reviewBody','consult.contract.controlBody','consult.contract.shareBody']) expect(ASK).toContain(key);
   expect(ASK.match(/CONTRACT_TILES\.map\(/g)).toHaveLength(2);
   expect(ASK).toContain('data-testid="consult-contract-summary"');
   expect(ASK).not.toContain('md:hidden rounded-[18px]');
   expect(ASK).not.toContain('min-w-0 flex-1 truncate');
 });
 it("empty and populated accounts both retain the contract", () => {
   expect(body.match(/\{packetContract\}/g)).toHaveLength(2);
   expect(body.indexOf('{packetContract}')).toBeLessThan(body.indexOf('t("care.packet.title")'));
 });
 it("purpose still uses the same packet builder and edits reset review consent", () => {
   expect(ASK).toContain("buildPacketInput");
   expect(ASK).toContain("reason,");
   expect(ASK).toContain('setReviewed(false); }, [excluded, visionNote, reason, audience, childProfile.id]');
   expect(ASK).toContain('const noneSelected = includedCount === 0 || !reviewed || exportText == null');
 });
 it("withdraws review synchronously when the outgoing audience changes", () => {
   const start = ASK.indexOf("const setAudience = (a: ExportAudience) =>");
   const setter = ASK.slice(start, ASK.indexOf("// AIX-S3(a)", start));
   const clear = 'if (a !== audience) setReviewed(false);';
   const update = 'setAudienceState(a);';
   expect(setter).toContain(clear);
   expect(setter).toContain(update);
   expect(setter.indexOf(clear)).toBeLessThan(setter.indexOf(update));
   expect(setter).not.toContain('if (a === audience) setReviewed(false);');
 });
 it("every export keeps the fail-closed guard and scanner", () => {
   expect(ASK).toContain('ClinicalLanguageError');
   expect(ASK).toContain('serializeForExport(audience, packet, excluded');
   expect(ASK).toContain('disabled={noneSelected}');
   expect(ASK).toContain('if (exportText == null) return');
   expect(ASK).toContain('hasDirectory ? t("consult.send") : t("elev.learnCare.trusted.send")');
 });
});
