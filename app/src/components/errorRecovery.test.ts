/**
 * CR-02 shared parent error recovery.
 *
 * Real static markup is the assertion surface. React's server renderer does
 * not catch render errors, so boundary tests apply React's error-state hook
 * and render the actual fallback returned by the class. Browser catch/retry,
 * focus, computed touch sizes and 390px/RTL layout remain parent-run gates.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../context/LanguageContext";
import { track } from "../lib/analytics";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ui/ErrorState";

// Leave the components, language context and dictionaries real. Keep API and
// analytics side effects out of this focused node-environment suite.
vi.mock("../lib/api", () => ({ setAiLanguage: vi.fn() }));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../lib/loopEvents", () => ({ trackErrorBannerShown: vi.fn() }));

const copy = {
  en: {
    head: "We couldn't load this section",
    body: "Try again in a moment. If it still doesn't load, come back later.",
    retry: "Try again",
    retrying: "Trying again…",
    today: "Back to Today",
    escapeNote: "Returning to Today reloads Arbor. Unsaved changes may be lost.",
    dir: "ltr",
  },
  he: {
    head: "לא הצלחנו לטעון את החלק הזה",
    body: "נסו שוב בעוד רגע. אם זה עדיין לא נטען, אפשר לחזור מאוחר יותר.",
    retry: "לנסות שוב",
    retrying: "מנסים שוב…",
    today: "חזרה להיום",
    escapeNote: "החזרה להיום טוענת את ארבור מחדש. שינויים שלא נשמרו עלולים להימחק.",
    dir: "rtl",
  },
} as const;
type UiLang = keyof typeof copy;
const languages: UiLang[] = ["en", "he"];
const noop = () => {};

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function documentLanguage(lang: string) {
  vi.stubGlobal("document", { documentElement: { lang } });
}

function failedBoundary(error: unknown = new Error("synthetic-private-detail")) {
  const boundary = new ErrorBoundary({
    children: React.createElement("p", null, "Child content"),
  });
  boundary.state = ErrorBoundary.getDerivedStateFromError(error);
  return boundary;
}

function renderErrorState(
  uiLang: UiLang,
  props: React.ComponentProps<typeof ErrorState> = {},
) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => key === "arbor.uiLang" ? uiLang : "en",
    setItem: vi.fn(),
  });
  return renderToStaticMarkup(
    React.createElement(LanguageProvider, {
      children: React.createElement(ErrorState, props),
    }),
  );
}

// Inspect the actual controls returned by the class, not an independently
// authored fallback or a callback copied from its implementation.
function findControl<Tag extends "button" | "a">(
  node: React.ReactNode,
  tag: Tag,
): React.ReactElement<React.ComponentProps<Tag>> | undefined {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return;
  if (node.type === tag) return node as React.ReactElement<React.ComponentProps<Tag>>;
  for (const child of React.Children.toArray(node.props.children)) {
    const control = findControl(child, tag);
    if (control) return control;
  }
}

function expectText(markup: string, text: string) {
  // Compare escaped text exactly as React renders it (including apostrophes).
  expect(markup).toContain(renderToStaticMarkup(text));
}

function expectRecovery(markup: string, uiLang: UiLang) {
  expect(markup).toContain('role="alert"');
  expect(markup).toContain(`lang="${uiLang}"`);
  expect(markup).toContain(`dir="${copy[uiLang].dir}"`);
  expectText(markup, copy[uiLang].head);
  expectText(markup, copy[uiLang].body);
  expect(markup).not.toContain("elev.states.");
  expect(markup).not.toMatch(/data is safe|המידע שלכם בטוח|הנתונים שלכם בטוחים/i);
}

function retryButton(markup: string) {
  const match = markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/);
  expect(match, "the fallback needs one actionable retry").not.toBeNull();
  expect(markup.match(/<button\b/g)).toHaveLength(1);
  return match![0];
}

function expectTouchTarget(button: string) {
  expect(button).toContain('type="button"');
  expect(button).toContain("min-h-[44px]");
  expect(button).toContain("min-w-[44px]");
  expect(button).toContain("max-w-full");
}

describe("CR-02 ErrorBoundary — provider-independent parent recovery", () => {
  it.each(languages)("renders friendly %s copy without LanguageProvider", (lang) => {
    documentLanguage(lang);
    const markup = renderToStaticMarkup(failedBoundary().render());
    expectRecovery(markup, lang);
    const button = retryButton(markup);
    expectText(button, copy[lang].retry);
    expectTouchTarget(button);
    expect(button).not.toContain("disabled");
    expect(markup).not.toContain("Child content");
  });

  it.each(["he-IL", "HE", "iw"])("recognizes Hebrew document tag %s", (tag) => {
    documentLanguage(tag);
    expectRecovery(renderToStaticMarkup(failedBoundary().render()), "he");
  });

  it.each(["", "fr", "en-US"])("uses English for document tag %s", (tag) => {
    documentLanguage(tag);
    expectRecovery(renderToStaticMarkup(failedBoundary().render()), "en");
  });

  it("can render the fallback without a browser document", () => {
    vi.stubGlobal("document", undefined);
    expectRecovery(renderToStaticMarkup(failedBoundary().render()), "en");
  });

  it.each(languages)("never renders or retains exception details in %s", (lang) => {
    documentLanguage(lang);
    const secret = "SYNTHETIC_PRIVATE_DETAIL";
    const error = new Error(`<script>${secret}</script>`);
    error.stack = `SYNTHETIC_PRIVATE_STACK: ${secret}`;
    for (const thrown of [error, secret, { message: secret, stack: secret }, null, 42]) {
      const boundary = failedBoundary(thrown);
      const markup = renderToStaticMarkup(boundary.render());
      expectRecovery(markup, lang);
      expect(markup).not.toContain(secret);
      expect(markup).not.toContain("SYNTHETIC_PRIVATE_STACK");
      expect(boundary.state).toEqual({ hasError: true });
    }
  });

  it.each(languages)("recovers real rendered child content through the %s retry control", (lang) => {
    documentLanguage(lang);
    let failing = true;
    function Section() {
      if (failing) throw new Error("SYNTHETIC_RETRY_FAILURE");
      return React.createElement("p", null, "Recovered section");
    }
    const boundary = new ErrorBoundary({ children: React.createElement(Section) });
    // Node SSR has no mounted React updater or boundary lifecycle. Simulate
    // only that host plumbing; keep the child, fallback, and handler real.
    boundary.setState = ((next: { hasError: boolean }) => {
      boundary.state = next;
    }) as typeof boundary.setState;
    const render = () => {
      try {
        return renderToStaticMarkup(boundary.render());
      } catch (error) {
        boundary.state = ErrorBoundary.getDerivedStateFromError(error);
        return renderToStaticMarkup(boundary.render());
      }
    };

    const failed = render();
    expectRecovery(failed, lang);
    expect(failed).not.toContain("SYNTHETIC_RETRY_FAILURE");
    const retry = findControl(boundary.render(), "button");
    expect(retry?.props.onClick).toBeTypeOf("function");
    failing = false;
    retry!.props.onClick!({} as React.MouseEvent<HTMLButtonElement>);

    const recovered = render();
    expect(recovered).toBe("<p>Recovered section</p>");
    expect(recovered).not.toContain('role="alert"');
    expect(recovered).not.toContain("<button");
  });

  it.each(languages)("offers a localized %s escape that reloads the Today route", (lang) => {
    documentLanguage(lang);
    const location = { hash: "#/coach", reload: vi.fn() };
    location.reload.mockImplementation(() => {
      expect(location.hash).toBe("#/overview");
    });
    vi.stubGlobal("window", { location });
    const boundary = failedBoundary();
    const markup = renderToStaticMarkup(boundary.render());
    expectText(markup, copy[lang].today);
    expectText(markup, copy[lang].escapeNote);
    const linkMarkup = markup.match(/<a\b[^>]*>[\s\S]*?<\/a>/)?.[0];
    expect(linkMarkup).toContain('href="#/overview"');
    expect(linkMarkup).toContain("min-h-[44px]");
    expect(linkMarkup).toContain("min-w-[44px]");
    expect(linkMarkup).toContain("max-w-full");
    const escape = findControl(boundary.render(), "a");
    expect(escape?.props.onClick).toBeTypeOf("function");
    const preventDefault = vi.fn();
    escape!.props.onClick!({ preventDefault } as unknown as React.MouseEvent<HTMLAnchorElement>);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(location.reload).toHaveBeenCalledOnce();
    // Escape uses navigation, not a retry of the same failed subtree.
    expect(boundary.state.hasError).toBe(true);
  });

  it("preserves existing bounded diagnostics without adding payload fields", () => {
    const error = new Error("m".repeat(350));
    error.stack = "s".repeat(650);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    failedBoundary(error).componentDidCatch(error);
    expect(log).toHaveBeenCalledExactlyOnceWith("Arbor tab error:", error);
    expect(track).toHaveBeenCalledExactlyOnceWith("error", {
      message: "m".repeat(300),
      stack: "s".repeat(600),
    });
  });

  it("still renders recovery if the diagnostic sink throws", () => {
    documentLanguage("he");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(track).mockImplementationOnce(() => { throw new Error("sink unavailable"); });
    const error = new Error("synthetic");
    const boundary = failedBoundary(error);
    expect(() => boundary.componentDidCatch(error)).not.toThrow();
    expectRecovery(renderToStaticMarkup(boundary.render()), "he");
  });
});

describe("CR-02 ErrorState — real language context and rendered overrides", () => {
  it.each(languages)("uses current %s context even before the document effect runs", (lang) => {
    documentLanguage(lang === "he" ? "en" : "he");
    const markup = renderErrorState(lang, { onRetry: noop });
    expectRecovery(markup, lang);
    const button = retryButton(markup);
    expectText(button, copy[lang].retry);
    expectTouchTarget(button);
    expect(button).not.toContain('disabled=""');
    expect(button).toContain('aria-busy="false"');
  });

  it.each(languages)("disables retry with localized busy feedback in %s", (lang) => {
    const markup = renderErrorState(lang, { onRetry: noop, retrying: true });
    expectRecovery(markup, lang);
    const button = retryButton(markup);
    expectText(button, copy[lang].retrying);
    expectTouchTarget(button);
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-busy="true"');
    expect(button).toContain("motion-safe:animate-spin");
  });

  it.each(languages)("preserves provided copy in %s, including while retrying", (lang) => {
    const overrides = {
      headline: "CUSTOM_HEAD",
      body: "CUSTOM_BODY",
      retryLabel: "CUSTOM_RETRY",
      className: "custom-recovery",
      onRetry: noop,
    };
    for (const retrying of [false, true]) {
      const markup = renderErrorState(lang, { ...overrides, retrying });
      for (const text of [overrides.headline, overrides.body, overrides.retryLabel]) {
        expectText(markup, text);
      }
      expect(markup).toContain("custom-recovery");
      expect(markup).not.toContain(renderToStaticMarkup(copy[lang].head));
      expect(markup).not.toContain(renderToStaticMarkup(copy[lang].body));
      expect(markup).not.toContain(renderToStaticMarkup(copy[lang].retrying));
    }
  });

  it.each(languages)("fills only omitted copy in %s and offers no inert retry", (lang) => {
    const markup = renderErrorState(lang, { headline: "CUSTOM_HEAD" });
    expectText(markup, "CUSTOM_HEAD");
    expectText(markup, copy[lang].body);
    expect(markup).not.toContain("<button");
  });

  it("renders caller copy as text and permits a deliberately empty body", () => {
    const markup = renderErrorState("he", {
      headline: "<script>synthetic</script>",
      body: "",
      retryLabel: "CUSTOM_RETRY",
      onRetry: noop,
    });
    expectText(markup, "<script>synthetic</script>");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain(renderToStaticMarkup(copy.he.body));
    expect(markup).not.toContain(renderToStaticMarkup(copy.he.retry));
  });
});

describe("CR-02 narrow source guards for contracts static rendering cannot exercise", () => {
  const boundary = readFileSync(new URL("./ErrorBoundary.tsx", import.meta.url), "utf8");
  const errorState = readFileSync(new URL("./ui/ErrorState.tsx", import.meta.url), "utf8");

  it("keeps the boundary fallback independent of provider-backed components", () => {
    expect(boundary).not.toMatch(/useLanguage|from ["'][^"']*(?:LanguageContext|ui\/ErrorState)["']/);
    expect(boundary.slice(boundary.indexOf("  render()"))).not.toMatch(/\.message\b|\.stack\b|\{message\}/);
    expect(boundary).toContain("onClick={this.reset}");
    expect(boundary).toContain("onClick={this.goToToday}");
    expect(errorState).toContain("onClick={onRetry}");
  });

  it("keeps banner analytics id-only and once per mount", () => {
    expect(errorState).toMatch(/useEffect\(\(\) => \{\s*trackErrorBannerShown\(surface\);[\s\S]*?\}, \[\]\)/);
    expect(errorState).not.toMatch(/trackErrorBannerShown\([^)]*(?:headline|body|retryLabel)/);
  });

  it("does not reintroduce the old English fallback or data-safety promise", () => {
    for (const source of [boundary, errorState]) {
      expect(source).not.toMatch(/This section hit a snag|Something went wrong\.|Your data is safe|retryLabel = "Try again"/);
      expect(source).not.toContain("dangerouslySetInnerHTML");
    }
  });
});
