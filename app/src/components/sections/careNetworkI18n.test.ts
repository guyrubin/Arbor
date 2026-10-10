/**
 * Care Network strings (Appointments) speak the parent's language, and the
 * retired directory stays retired.
 *
 * HISTORY
 * LC-16 keyed FindProfessional.tsx (the #/find-pro directory) — empty state,
 * filters, consult-request form — into i18nElevation/careNetwork. B-CAREPRO-19
 * (G3) retired that route to Consult: the directory had zero records and its
 * consult requests returned 404. The component and its strings are gone; what
 * remains in the module is what #/appointments renders.
 *
 * SCAN DISCIPLINE (house rule)
 * Every source scan asserts the bytes it read are real and non-empty, and
 * every matcher is negative-controlled.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18nElevation/careNetwork";
import { elevationEn, elevationHe } from "../../lib/i18nElevation";
import { translate } from "../../lib/i18n";
import { ARBOR_PROFESSIONALS } from "../../services/professionals";
import { RETIRED_ROUTES, resolveRouteId } from "../../lib/routes";
import { appointmentRoleLabel, PROFESSION_KEY } from "../../lib/appointmentLabel";
import { APPOINTMENT_PROFESSIONS } from "../../lib/careTrack";

const here = path.dirname(fileURLToPath(import.meta.url));
const APPTS = readFileSync(path.join(here, "Appointments.tsx"), "utf8").replace(/\r\n/g, "\n");

/* ═══════════════════════════════════════════════════════════════════════════
   Registration — an unregistered module is invisible to the app.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("registration", () => {
  it("every key reaches the merged Elevation dictionaries, EN and HE", () => {
    expect(Object.keys(en).length).toBeGreaterThan(0);
    for (const key of Object.keys(en)) {
      expect(elevationEn[key], `${key} missing from elevationEn`).toBeTruthy();
      expect(elevationHe[key], `${key} missing from elevationHe`).toBeTruthy();
    }
  });

  it("EN and HE cover exactly the same keys, all namespaced elev.careNet.*", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    for (const key of Object.keys(en)) expect(key.startsWith("elev.careNet.")).toBe(true);
  });

  it("t() resolves every key in BOTH languages; Hebrew is Hebrew", () => {
    for (const key of Object.keys(en)) {
      expect(translate("en", key)).toBe(en[key]);
      expect(translate("he", key)).toBe(he[key]);
      expect(/[\u0590-\u05FF]/.test(he[key]), `${key} has no Hebrew letters`).toBe(true);
    }
  });

  it("every key the module defines is used by Appointments or its shared label helper, and every requested key exists", () => {
    expect(APPTS.length).toBeGreaterThan(2000);
    const labels = readFileSync(path.join(here, "../../lib/appointmentLabel.ts"), "utf8");
    expect(labels).toContain("export function appointmentRoleLabel");
    expect(APPTS).toContain('import { appointmentRoleLabel, PROFESSION_KEY } from "../../lib/appointmentLabel";');
    expect(APPTS).toContain("{t(PROFESSION_KEY[p])}");
    expect(APPTS).toContain("{appointmentRoleLabel(appt, t)}");
    const live = `${APPTS}\n${labels}`.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const unused = Object.keys(en).filter((k) => !live.includes(k));
    expect(unused, "dead copy — delete it or wire it").toEqual([]);
    const asked = [...live.matchAll(/"(elev\.careNet\.[a-zA-Z0-9.]+)"/g)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThan(2);
    for (const key of asked) {
      expect(en[key], `${key} is asked for but undefined`).toBeTruthy();
      expect(he[key], `${key} has no Hebrew`).toBeTruthy();
    }
    // NEGATIVE CONTROL: a key no screen renders is reported dead.
    expect(["elev.careNet.ghost.neverRendered"].filter((k) => !live.includes(k))).toHaveLength(1);
    // Every stored profession reaches the shared localized renderer, including the fallback.
    expect(Object.keys(PROFESSION_KEY).sort()).toEqual([...APPOINTMENT_PROFESSIONS].sort());
    for (const lang of ["en", "he"] as const) {
      const t = (key: string) => translate(lang, key);
      for (const profession of APPOINTMENT_PROFESSIONS) {
        expect(appointmentRoleLabel({ profession, role: "Professional" }, t)).toBe(t(PROFESSION_KEY[profession]));
      }
      expect(appointmentRoleLabel({ role: "Professional" }, t)).toBe(t("elev.careNet.appt.professional"));
      expect(appointmentRoleLabel({ role: "" }, t)).toBe(t("elev.careNet.appt.professional"));
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   B-CAREPRO-19 — the empty directory is retired, not dressed up.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("B-CAREPRO-19 · #/find-pro is retired to Consult", () => {
  it("the directory component is deleted; the provider list is still empty", () => {
    expect(existsSync(path.join(here, "FindProfessional.tsx"))).toBe(false);
    expect(ARBOR_PROFESSIONALS).toEqual([]);
  });

  it("#/find-pro resolves to consult through RETIRED_ROUTES", () => {
    expect(RETIRED_ROUTES["find-pro"]).toBe("consult");
    expect(resolveRouteId("#/find-pro")).toBe("consult");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The persisted appointment mode stays canonical English and is translated at
   render (provider and booking records outlive a language switch).
   ═══════════════════════════════════════════════════════════════════════════ */
describe("documented exception: the persisted appointment mode stays English", () => {
  it("...and is translated at RENDER, so the parent never reads the stored English", () => {
    expect(APPTS).toContain("const modeLabel =");
    expect(APPTS).toContain('t("elev.careNet.mode.inPerson")');
    expect(APPTS).toContain('t("elev.careNet.mode.online")');
    expect(APPTS).toContain("{modeLabel}");
    expect(APPTS, "the row is back to printing the stored English").not.toContain("· {appt.mode}");
  });

  it("NEGATIVE CONTROL: the render check fails on the pre-fix row", () => {
    const before = `<p className="text-xs" dir="auto">{appt.role} · {appt.mode}</p>`;
    expect(before).toContain("· {appt.mode}");
    expect(before).not.toContain("const modeLabel =");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   B-CAREPRO-15 — packet headings render through sectionTitle/sectionNote
   (titleKey) everywhere in components/sections; the English `section.title`
   fallback never reaches a Hebrew family. Also: the recipient viewer's Close
   has a 44 px floor and share errors never interpolate the server's text.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readdirSync } from "node:fs";

describe("B-CAREPRO-15 · packet section headings are keyed", () => {
  const SECTIONS_DIR = path.dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(SECTIONS_DIR).filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f));
  const RAW_HEADING = /\{section\.(title|note)\}/;
  const sharing = readFileSync(path.join(SECTIONS_DIR, "TrustedSharing.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("the scan read real files (TrustedSharing and AskSpecialist among them)", () => {
    expect(files).toContain("TrustedSharing.tsx");
    expect(files).toContain("AskSpecialist.tsx");
    expect(files.length).toBeGreaterThan(10);
  });

  it("no {section.title} / {section.note} in components/sections", () => {
    const hits = files.filter((f) => RAW_HEADING.test(readFileSync(path.join(SECTIONS_DIR, f), "utf8")));
    expect(hits).toEqual([]);
    // NEGATIVE CONTROL: the pre-change preview/viewer lines are caught.
    expect(RAW_HEADING.test('<p className="text-[12.5px] font-extrabold" dir="auto">{section.title}</p>')).toBe(true);
    expect(RAW_HEADING.test('{section.note && <p className="text-[11px]">{section.note}</p>}')).toBe(true);
  });

  it("every TrustedSharing site renders sectionTitle(section, uiLang)", () => {
    // consent preview + recipient viewer + B-CAREPRO-26's week-card preview
    expect((sharing.match(/\{sectionTitle\(section, uiLang\)\}/g) ?? []).length).toBe(3);
  });

  it("a Hebrew heading resolves from the key (0 Latin letters in the scaffold)", () => {
    const he1 = translate("he", "elev.packet.section.about", { name: "נועה" });
    expect(he1).not.toMatch(/[A-Za-z]/);
    expect(he1).not.toBe("elev.packet.section.about");
  });

  it("the viewer Close button has a 44 px floor", () => {
    const close = /<button onClick=\{closeSharedView\}[^>]*>/.exec(sharing);
    expect(close).toBeTruthy();
    expect(close![0]).toContain("min-h-11");
  });

  it("create/revoke error toasts are keyed without the server's message", () => {
    expect(sharing).not.toMatch(/audit\.(createError|revokeError)",\s*\{\s*message/);
    expect(sharing).toContain('toast(t("sec.sharing.audit.createError"), "error")');
    expect(sharing).toContain('toast(t("sec.sharing.audit.revokeError"), "error")');
    for (const lang of ["en", "he"] as const) {
      for (const k of ["sec.sharing.audit.createError", "sec.sharing.audit.revokeError"]) {
        expect(translate(lang, k)).not.toContain("{message}");
      }
    }
    // NEGATIVE CONTROL: the pre-change call is caught.
    expect(/audit\.(createError|revokeError)",\s*\{\s*message/.test('toast(t("sec.sharing.audit.createError", { message: e.message }), "error");')).toBe(true);
  });
});
