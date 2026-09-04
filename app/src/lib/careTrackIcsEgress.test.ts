/**
 * The .ics reaches the parent's calendar on the platform this app ships on.
 *
 * Two claims in the tree could not both be true. `schoolBrief.ts` justifies the
 * LC-11 rewrite with "on a Capacitor WKWebView a blob `<a download>` is not
 * reliable egress at all", and Appointments saved the .ics with precisely that
 * mechanism — and toasted "Calendar file saved" whether or not anything was.
 * This app ships through Capacitor 8, so the School Brief's claim is the
 * governing one and the .ics now rides the same native-first ladder the report
 * PDF uses (`lib/reportExport.openPrintableReport`).
 *
 * These pin the ladder behaviourally (fakes, node env) and pin the surface's
 * use of it by source scan with a negative control against the pre-change body.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appointmentToIcs,
  saveIcsFile,
  type Appointment,
  type IcsEgressDeps,
  type IcsFile,
} from "./careTrack";

const NOW = Date.parse("2026-09-04T09:00:00.000Z");
const APPT: Appointment = {
  id: "a1",
  who: "Dr Levi",
  role: "Pediatrician",
  when: "",
  mode: "In person",
  whenIso: "2026-09-10T08:30:00.000Z",
  status: "confirmed",
};

const FILE = appointmentToIcs(APPT, NOW) as IcsFile;

/** Recording fakes — every platform touch is injected, so this runs in node. */
function deps(over: Partial<IcsEgressDeps> = {}) {
  const calls: string[] = [];
  const base: IcsEgressDeps = {
    isNative: () => {
      calls.push("isNative");
      return false;
    },
    shareNative: async () => {
      calls.push("shareNative");
    },
    downloadWeb: () => {
      calls.push("downloadWeb");
      return true;
    },
    ...over,
  };
  return { calls, d: { ...base, ...over } as IcsEgressDeps };
}

describe("the fixture is real (guard against a vacuous test)", () => {
  it("appointmentToIcs produced a calendar file", () => {
    expect(FILE).toBeTruthy();
    expect(FILE.content).toContain("BEGIN:VCALENDAR");
    expect(FILE.filename).toMatch(/\.ics$/);
    expect(FILE.mime).toContain("text/calendar");
  });
});

describe("saveIcsFile — native share sheet first, browser download second", () => {
  it("on a native runtime the OS share sheet is used and no download happens", async () => {
    const calls: string[] = [];
    const channel = await saveIcsFile(FILE, {
      isNative: () => true,
      shareNative: async () => void calls.push("shareNative"),
      downloadWeb: () => {
        calls.push("downloadWeb");
        return true;
      },
    });
    expect(channel).toBe("native_share");
    expect(calls).toEqual(["shareNative"]);
    // NEGATIVE CONTROL: the pre-change surface had no native branch at all —
    // it always took the blob path, which is what this asserts is now skipped.
    expect(calls).not.toContain("downloadWeb");
  });

  it("on the web the browser download is used and the sheet is never opened", async () => {
    const { calls, d } = deps({ isNative: () => false });
    const channel = await saveIcsFile(FILE, d);
    expect(channel).toBe("download");
    expect(calls).toContain("downloadWeb");
    expect(calls).not.toContain("shareNative");
  });

  it("a failed or cancelled native share falls through to the download", async () => {
    const calls: string[] = [];
    const channel = await saveIcsFile(FILE, {
      isNative: () => true,
      shareNative: async () => {
        calls.push("shareNative");
        throw new Error("plugin unavailable");
      },
      downloadWeb: () => {
        calls.push("downloadWeb");
        return true;
      },
    });
    expect(channel).toBe("download");
    expect(calls).toEqual(["shareNative", "downloadWeb"]);
  });

  it("reports `unavailable` when NEITHER path works — never a false 'saved'", async () => {
    const bothFail = await saveIcsFile(FILE, {
      isNative: () => true,
      shareNative: async () => {
        throw new Error("no plugin");
      },
      downloadWeb: () => false,
    });
    expect(bothFail).toBe("unavailable");

    // …including when the download path throws rather than returning false.
    const thrown = await saveIcsFile(FILE, {
      isNative: () => false,
      shareNative: async () => undefined,
      downloadWeb: () => {
        throw new Error("no DOM");
      },
    });
    expect(thrown).toBe("unavailable");
  });

  it("never throws, whatever the platform does — a hostile probe degrades to web", async () => {
    const channel = await saveIcsFile(FILE, {
      isNative: () => {
        throw new Error("hostile runtime");
      },
      shareNative: async () => {
        throw new Error("should not be reached");
      },
      downloadWeb: () => true,
    });
    expect(channel).toBe("download");
  });
});

/* ── The surface uses the ladder, and tells the truth about the outcome ───── */

const here = path.dirname(fileURLToPath(import.meta.url));
const SURFACE = readFileSync(
  path.join(here, "..", "components", "sections", "Appointments.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The pre-change handler, verbatim — the negative control. */
const PRE_CHANGE = `
  const saveIcs = (a: Appointment) => {
    const file = appointmentToIcs(a, Date.now());
    if (!file) return;
    const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast(t("elev.learnCare.appt.ics.done"), "success");
  };
`.replace(/\r\n/g, "\n");

const HANDLER = /const saveIcs = async \(a: Appointment\) => \{[\s\S]*?\n  \};/;

describe("Appointments routes the .ics through the ladder", () => {
  it("the source was really read", () => {
    expect(SURFACE.length).toBeGreaterThan(2000);
    expect(SURFACE).toContain("export default function Appointments");
    expect(HANDLER.exec(SURFACE), "saveIcs handler not found").toBeTruthy();
  });

  it("calls saveIcsFile with the real platform deps", () => {
    const body = HANDLER.exec(SURFACE)![0];
    expect(body).toContain("saveIcsFile(file, defaultIcsEgressDeps())");
    expect(HANDLER.exec(PRE_CHANGE), "negative control").toBeNull();
  });

  it("the blob + <a download> mechanism is gone from the surface", () => {
    for (const banned of ["URL.createObjectURL", "new Blob(", "link.download", ".click()"]) {
      expect(SURFACE, `"${banned}" is back on the surface`).not.toContain(banned);
      // NEGATIVE CONTROL: each banned token really was present before.
      expect(PRE_CHANGE).toContain(banned);
    }
  });

  it("the success toast fires only on the path that actually saved a file", () => {
    const body = HANDLER.exec(SURFACE)![0];
    expect(body).toMatch(/channel === "download"[\s\S]{0,120}?elev\.learnCare\.appt\.ics\.done/);
    expect(body).toMatch(/channel === "unavailable"[\s\S]{0,120}?elev\.learnCare\.appt\.ics\.failed/);
    // NEGATIVE CONTROL: the old handler toasted "done" with no condition.
    expect(PRE_CHANGE).toMatch(/elev\.learnCare\.appt\.ics\.done/);
    expect(PRE_CHANGE).not.toMatch(/channel === "download"/);
  });

  it("both new strings exist in BOTH dictionaries", async () => {
    const learnCare = await import("./i18nElevation/learnCare");
    expect(Object.keys(learnCare.en).length).toBeGreaterThan(0);
    for (const key of ["elev.learnCare.appt.ics.done", "elev.learnCare.appt.ics.failed"]) {
      expect(learnCare.en[key], `missing EN for ${key}`).toBeTruthy();
      expect(learnCare.he[key], `missing HE for ${key}`).toBeTruthy();
      expect(learnCare.he[key]).not.toBe(learnCare.en[key]);
    }
  });
});
