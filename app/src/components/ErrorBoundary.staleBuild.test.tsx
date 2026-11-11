/**
 * 11 Nov 2026 regression: a tab opened before a release asked for a lazy chunk
 * that release removed. The boundary offered "Try again", which can never work
 * (React.lazy keeps the rejection). A stale-build error now reloads once and
 * otherwise offers Reload; every other error keeps the existing recovery copy.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const reloadIntoCurrentBuild = vi.hoisted(() => vi.fn(() => false));
vi.mock("../lib/staleBuild", async (importActual) => ({ ...(await importActual<typeof import("../lib/staleBuild")>()), reloadIntoCurrentBuild }));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));

import { ErrorBoundary } from "./ErrorBoundary";
import { en, he } from "../lib/i18nElevation/states";

const STALE = new TypeError("Failed to fetch dynamically imported module: https://arborparentingapp.com/assets/CoachTab-WcNfv40N.js");
const ORDINARY = new TypeError("Cannot read properties of undefined (reading 'title')");

function caught(error: unknown, props: Partial<React.ComponentProps<typeof ErrorBoundary>> = {}) {
  const boundary = new ErrorBoundary({ children: <p>child</p>, ...props });
  boundary.state = ErrorBoundary.getDerivedStateFromError(error);
  vi.spyOn(console, "error").mockImplementation(() => {});
  boundary.componentDidCatch(error);
  return { boundary, html: renderToStaticMarkup(<>{boundary.render()}</>) };
}

afterEach(() => { vi.restoreAllMocks(); reloadIntoCurrentBuild.mockClear(); delete (globalThis as { document?: unknown }).document; });

describe("ErrorBoundary — a chunk from a replaced release", () => {
  it("starts the guarded reload and offers Reload, not Try again", () => {
    const { html } = caught(STALE);
    expect(reloadIntoCurrentBuild).toHaveBeenCalledTimes(1);
    expect(html).toContain('data-stale-build="true"');
    expect(html).toContain(en["elev.states.update.head"].replace("'", "&#x27;"));
    expect(html).toContain(en["elev.states.update.reload"]);
    expect(html).not.toContain(en["elev.states.retry"]);
    expect(html).not.toContain(en["elev.states.error.head"].replace("'", "&#x27;"));
  });

  it("the Reload button reloads the page", () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const { boundary } = caught(STALE);
    boundary.reload();
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("speaks Hebrew when the document is Hebrew", () => {
    (globalThis as { document?: unknown }).document = { documentElement: { lang: "he" } };
    const { html } = caught(STALE);
    expect(html).toContain(he["elev.states.update.head"]);
    expect(html).toContain(he["elev.states.update.reload"]);
    expect(html).toContain('dir="rtl"');
  });
});

describe("ErrorBoundary — every other error keeps its recovery", () => {
  it("no reload; Try again and Back to Today stay", () => {
    const { html } = caught(ORDINARY);
    expect(reloadIntoCurrentBuild).not.toHaveBeenCalled();
    expect(html).not.toContain("data-stale-build");
    expect(html).toContain(en["elev.states.retry"]);
    expect(html).toContain(en["elev.states.error.today"]);
  });

  it("Try again clears the error and tells the opener", () => {
    const onReset = vi.fn();
    const { boundary } = caught(ORDINARY, { onReset });
    const setState = vi.spyOn(boundary, "setState").mockImplementation(() => {});
    boundary.reset();
    expect(setState).toHaveBeenCalledWith({ hasError: false, staleBuild: false });
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorBoundary — floating, for a sheet mounted outside main", () => {
  it("lays the card over the page instead of below it", () => {
    const floating = caught(ORDINARY, { floating: true }).html;
    expect(floating).toMatch(/^<div class="fixed inset-0 z-50[^"]*"/);
    expect(floating).not.toContain(" mt-10");
    const inline = caught(ORDINARY).html;
    expect(inline).toMatch(/^<div role="alert"/);
    expect(inline).toContain(" mt-10");
  });

  it("renders children untouched while nothing failed", () => {
    const boundary = new ErrorBoundary({ children: <p>child</p>, floating: true });
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toBe("<p>child</p>");
  });
});
