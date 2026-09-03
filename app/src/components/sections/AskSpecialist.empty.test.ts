/* LC-06 — the consult empty state actually mounts for a day-0 record.
 *
 * Pre-fix, `isEmpty = packet.sections.length === 0` could never be true (the
 * packet always carries "about"), so a new profile saw a one-line packet with
 * a live export bar. This renders the REAL AskSpecialist (static markup, node
 * env) with the app contexts stubbed: a profile-only record must mount the
 * `consult.empty.*` state and NO packet rows / export bar; one logged moment
 * (negative control) must mount the packet rows + the audience radiogroup. */

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const record = {
  childProfile: { id: "c1", name: "Noa Levi", age: 4, languages: ["Hebrew"], schoolContext: "", strengths: [], challenges: [], riskLevel: "Low" },
  behaviorLogs: [] as Array<{ behaviorType: string; intensity: number; timestamp: string; resolved?: boolean }>,
  milestones: [] as Array<{ domain: string; title: string; checked: boolean }>,
  actionPlans: [] as Array<{ title: string; issue?: string }>,
  approvedMemoryItems: [] as Array<{ fact: string; status: string }>,
  setActiveTab: vi.fn(),
  pendingConsultNote: null as string | null,
  consumeConsultPrefill: vi.fn(),
};

vi.mock("../../context/ArborContext", () => ({ useArbor: () => record }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (k: string) => k, uiLang: "en" }) }));
vi.mock("./Reports", () => ({ REPORTS: [], useReportExport: () => vi.fn() }));
vi.mock("./FindProfessional", () => ({ default: () => null }));
vi.mock("../ui/Modal", () => ({ Modal: () => null, default: () => null }));
vi.mock("../../lib/api", () => ({ authHeaders: async () => ({}) }));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: vi.fn(), trackShareCompleted: vi.fn() }));
vi.mock("../../services/professionals", () => ({ ARBOR_PROFESSIONALS: [] }));

describe("LC-06 — AskSpecialist empty state", () => {
  it("a profile-only record mounts the empty state and no export bar", async () => {
    const { default: AskSpecialist } = await import("./AskSpecialist");
    const html = renderToStaticMarkup(React.createElement(AskSpecialist));
    expect(html).toContain("consult.empty.title");
    expect(html).toContain("consult.empty.cta");
    expect(html).not.toContain('data-testid="consult-packet-item"');
    expect(html).not.toContain('role="radiogroup"');
  });

  it("NEGATIVE CONTROL: one logged moment mounts the packet rows + the audience step instead", async () => {
    record.behaviorLogs = [{ behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date().toISOString() }];
    const { default: AskSpecialist } = await import("./AskSpecialist");
    const html = renderToStaticMarkup(React.createElement(AskSpecialist));
    expect(html).not.toContain("consult.empty.title");
    expect(html).toContain('data-testid="consult-packet-item"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("elev.carehonesty.consult.preview.toggle");
    record.behaviorLogs = [];
  });
});
