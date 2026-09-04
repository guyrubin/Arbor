import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { T } from "./tokens";
import { ACCENT_THEMES } from "./theme";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(here, "..", "index.css"), "utf8");
const button = readFileSync(path.join(here, "..", "components", "ui", "Button.tsx"), "utf8");
const AA = 4.5;
type Declarations = Record<string, string>;
type Color = [number, number, number, number];
type Rule = { selectors: string[]; declarations: Declarations; conditional: boolean };
type Scope = { name: string; values: Declarations; flat: boolean };

/** Walk braces rather than taking the first regex match: later declarations,
 * theme rules and both flat scopes participate. Comments cannot create tokens.
 * Conditional colour overrides must get explicit scenarios before being added. */
function rulesOf(source: string): Rule[] {
  const rules: Rule[] = [];
  const stack: Rule[] = [];
  let buffer = "";
  for (const char of source.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (char === "{") {
      const selectors = buffer.trim().split(",").map((s) => s.trim());
      stack.push({
        selectors,
        declarations: {},
        conditional: stack.some((rule) => rule.selectors.some((s) => s.startsWith("@"))),
      });
      buffer = "";
    } else if (char === "}") {
      // The last CSS declaration may legally omit its semicolon.
      const declaration = buffer.trim().match(/^(--[\w-]+)\s*:\s*(.+)$/s);
      if (declaration && stack.length) stack[stack.length - 1].declarations[declaration[1]] = declaration[2].trim();
      const rule = stack.pop();
      if (!rule) throw new Error("Unbalanced CSS block");
      if (Object.keys(rule.declarations).length) rules.push(rule);
      buffer = "";
    } else if (char === ";") {
      const declaration = buffer.trim().match(/^(--[\w-]+)\s*:\s*(.+)$/s);
      if (declaration && stack.length) stack[stack.length - 1].declarations[declaration[1]] = declaration[2].trim();
      buffer = "";
    } else {
      buffer += char;
    }
  }
  if (stack.length) throw new Error("Unclosed CSS block");
  return rules;
}

/** All supported selectors have equal specificity. Resolve locally declared
 * var() references at their declaring element; inherited aliases/gradients
 * are already computed, just as CSS custom-property inheritance requires. */
function cascade(rules: Rule[], inherited: Declarations, selectors: string[]): Declarations {
  const local: Declarations = {};
  for (const rule of rules) {
    if (rule.selectors.some((selector) => selectors.includes(selector))) Object.assign(local, rule.declarations);
  }
  const resolved = { ...inherited };
  const resolve = (name: string, trail: string[] = []): string => {
    if (trail.includes(name)) throw new Error("Cyclic token: " + [...trail, name].join(" → "));
    if (!(name in local)) return required(inherited, name);
    const value = local[name].replace(/var\((--[\w-]+)\)/g, (_, ref: string) => resolve(ref, [...trail, name]));
    if (value.includes("var(")) throw new Error("Unsupported variable expression: " + value);
    return value;
  };
  for (const name of Object.keys(local)) resolved[name] = resolve(name);
  return resolved;
}

function required(values: Declarations, name: string): string {
  if (!(name in values)) throw new Error("Missing token " + name);
  return values[name];
}

function runtimeScopes(source: string): Scope[] {
  const rules = rulesOf(source);
  const root = cascade(rules, {}, [":root"]);
  const scopes: Scope[] = [];
  for (const theme of ["green", "teal", "blue"]) {
    const selector = '[data-theme="' + theme + '"]';
    const themedRoot = cascade(rules, {}, [":root", selector]);
    const app = cascade(rules, themedRoot, [".arbor-app"]);
    scopes.push(
      { name: theme + " root", values: themedRoot, flat: false },
      { name: theme + " descendant theme", values: cascade(rules, root, [selector]), flat: false },
      { name: theme + " flat app", values: app, flat: true },
      { name: theme + " flat parent", values: cascade(rules, themedRoot, [".arbor-parent"]), flat: true },
      { name: theme + " nested parent", values: cascade(rules, app, [".arbor-parent"]), flat: true },
      { name: theme + " theme on app", values: cascade(rules, root, [selector, ".arbor-app"]), flat: true },
    );
  }
  return scopes;
}

function colorOf(value: string): Color {
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    const channels = digits.match(/../g)!.map((pair) => parseInt(pair, 16) / 255);
    return [channels[0], channels[1], channels[2], channels[3] ?? 1];
  }
  const rgb = value.trim().match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(",");
    if (parts.some((part) => part.trim() === "")) throw new Error("Empty RGB channel: " + value);
    const channels = parts.map(Number);
    if ((channels.length !== 3 && channels.length !== 4) || channels.some((n) => !Number.isFinite(n)) ||
        channels.slice(0, 3).some((n) => n < 0 || n > 255) ||
        (channels[3] !== undefined && (channels[3] < 0 || channels[3] > 1))) {
      throw new Error("Invalid RGB colour: " + value);
    }
    return [channels[0] / 255, channels[1] / 255, channels[2] / 255, channels[3] ?? 1];
  }
  throw new Error("Unsupported colour: " + value);
}

function over(foreground: Color, background: Color): Color {
  if (background[3] !== 1) throw new Error("Background must first be composited onto opaque paper");
  return [
    foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
    foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
    foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
    1,
  ];
}

function luminance(color: Color): number {
  const linear = color.slice(0, 3).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground: Color, background: Color): number {
  const a = luminance(over(foreground, background));
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function splitArguments(value: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) {
      result.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error("Unbalanced gradient");
  return [...result, value.slice(start).trim()];
}

/** Check every declared stop and samples through every segment, including alpha.
 * Reject unsupported syntax instead of dropping a colour or assuming white. */
function samplesOf(value: string): Color[] {
  if (!value.startsWith("linear-gradient(")) return [colorOf(value)];
  const args = splitArguments(value.slice("linear-gradient(".length, -1));
  if (!/^-?[\d.]+deg$/.test(args.shift() ?? "")) throw new Error("Unsupported gradient direction: " + value);
  const stops = args.map((stop) => colorOf(stop.replace(/\s+-?[\d.]+%$/, "")));
  if (stops.length < 2) throw new Error("Gradient needs at least two stops");
  const samples: Color[] = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const alpha = a[3] * (1 - t) + b[3] * t;
      const channel = (c: number) => alpha === 0 ? 0 : (a[c] * a[3] * (1 - t) + b[c] * b[3] * t) / alpha;
      samples.push([channel(0), channel(1), channel(2), alpha]);
    }
  }
  return samples;
}

const PAPER = ["--arbor-paper", "--arbor-paper-elevated", "--arbor-paper-deep", "--arbor-paper-sunk"];
const TINTS = ["--arbor-paper-tinted", "--arbor-clay-dim", "--arbor-clay-soft",
  "--arbor-green-soft", "--arbor-peach-soft", "--arbor-lav-soft",
  "--arbor-yellow-soft", "--arbor-pink-soft", "--arbor-sky-soft"];
const TEXT = ["--arbor-ink", "--arbor-ink-soft", "--arbor-muted", "--arbor-faint",
  "--arbor-muted-alt", "--arbor-clay", "--arbor-clay-deep", "--arbor-clay-ink"];
const FUNCTIONAL = ["green", "peach", "lav", "yellow", "pink", "sky"];
const CTA = ["--arbor-gradient-primary", "--gradient-cta"];
const FLAT_TINTS = ["--arbor-tint", "--arbor-tint-2", "--arbor-topbar-band", "--arbor-coach-grad"];

function backgrounds(values: Declarations, flat: boolean): { name: string; color: Color }[] {
  const papers = PAPER.map((name) => ({ name, color: colorOf(required(values, name)) }));
  if (papers.some((paper) => paper.color[3] !== 1)) throw new Error("Paper must be opaque");
  const tints = [...TINTS, ...(flat ? FLAT_TINTS : [])];
  return [...papers, ...papers.flatMap((paper) => tints.flatMap((name) =>
    samplesOf(required(values, name)).map((sample, i) => ({
      name: name + "[" + i + "] over " + paper.name,
      color: over(sample, paper.color),
    }))))];
}

type Pair = { name: string; foreground: Color; background: Color; floor: number };
function declaredPairs(scope: Scope): Pair[] {
  const values = scope.values;
  const surfaces = backgrounds(values, scope.flat);
  const pairs: Pair[] = [];
  const add = (ink: string, surface: { name: string; color: Color }, floor = AA) => pairs.push({
    name: scope.name + ": " + ink + " on " + surface.name,
    foreground: colorOf(required(values, ink)), background: surface.color, floor,
  });
  for (const ink of [...TEXT, ...(scope.flat ? ["--accent"] : [])]) {
    for (const surface of surfaces) add(ink, surface);
  }
  for (const tone of FUNCTIONAL) {
    for (const surface of surfaces.filter((s) => PAPER.includes(s.name) ||
      s.name.startsWith("--arbor-paper-tinted[") || s.name.startsWith("--arbor-" + tone + "-soft["))) {
      add("--arbor-" + tone + "-ink", surface);
    }
  }
  const paper = colorOf(required(values, "--arbor-paper"));
  for (const fill of ["--arbor-clay", "--arbor-clay-deep", "--arbor-green-cta-start", ...CTA]) {
    samplesOf(required(values, fill)).forEach((sample, i) =>
      add("--arbor-on-accent", { name: fill + "[" + i + "]", color: over(sample, paper) }));
  }
  if (scope.flat) {
    add("--arbor-subtab-on-ink", { name: "--arbor-subtab-active", color: colorOf(required(values, "--arbor-subtab-active")) });
  }
  // Primary focus/selected-state fills also meet the UI-component floor.
  for (const surface of surfaces) add("--arbor-clay", surface, 3);
  return pairs;
}

function failures(pairs: Pair[]): string[] {
  return pairs.flatMap((pair) => {
    const ratio = contrast(pair.foreground, pair.background);
    return ratio < pair.floor ? [pair.name + ": " + ratio.toFixed(3) + " < " + pair.floor] : [];
  });
}


/** Bounded consumer model: read the actual filter's two style branches and
 * count span, then composite the count's opacity against that branch's fill.
 * Unmodelled styles fail explicitly rather than disappearing from coverage. */
function storyFilterConsumer(source: string): string {
  const start = source.indexOf("{/* Filters */}");
  const end = source.indexOf("{/* Timeline */}", start);
  if (start < 0 || end < start) throw new Error("Missing StoryTimeline filter section");
  const section = source.slice(start, end);
  if (!/const on = filter === f\.key;/.test(section)) throw new Error("Unmodelled filter selection condition");
  const buttons = [...section.matchAll(/<button\b[\s\S]*?<\/button>/g)];
  if (buttons.length !== 1) throw new Error("Expected one mapped filter button");
  return buttons[0][0];
}

function storyFilterCountPairs(source: string, runtime: Scope[]): Pair[] {
  const consumer = storyFilterConsumer(source);
  const classes = consumer.match(/className="([^"]*)"/);
  if (!classes || /(?:^|\s)\S*(?:opacity|brightness|contrast|filter|mix-blend)-/.test(classes[1])) {
    throw new Error("Unmodelled filter-button colour/opacity effect");
  }
  const branches = consumer.match(/style=\{on\s*\?\s*\{([^}]+)\}\s*:\s*\{([^}]+)\}\}/);
  if (!branches) throw new Error("Missing selected/unselected filter styles");
  const styleOf = (body: string): Declarations => {
    const properties = /(\w+)\s*:\s*"([^"]*)"/g;
    const entries = [...body.matchAll(properties)].map((match) => [match[1], match[2]]);
    if (body.replace(properties, "").replace(/[\s,]/g, "") ||
        entries.some(([key]) => !["background", "color", "border"].includes(key))) {
      throw new Error("Unmodelled filter-button style");
    }
    const style = Object.fromEntries(entries);
    if (!style.background || !style.color) throw new Error("Filter needs a declared fill and ink");
    return style;
  };
  const spans = [...consumer.matchAll(/<span\b([^>]*)>\s*\{n\}\s*<\/span>/g)];
  if (spans.length !== 1) throw new Error("Missing unique filter count span");
  const attributes = spans[0][1].trim();
  let opacity = 1;
  if (attributes) {
    const countClasses = attributes.match(/^className="([^"]*)"$/);
    if (!countClasses) throw new Error("Unmodelled count attributes");
    for (const className of countClasses[1].split(/\s+/).filter(Boolean)) {
      const alpha = className.match(/^opacity-(\d+)$/);
      if (!alpha || Number(alpha[1]) > 100) throw new Error("Unmodelled count class: " + className);
      opacity *= Number(alpha[1]) / 100;
    }
  }
  const states = [
    { name: "selected", style: styleOf(branches[1]) },
    { name: "unselected", style: styleOf(branches[2]) },
  ];
  return runtime.flatMap((scope) => states.flatMap((state) => {
    const resolve = (value: string) => value.replace(/var\((--[\w-]+)\)/g,
      (_, name: string) => required(scope.values, name));
    const ink = colorOf(resolve(state.style.color));
    const foreground: Color = [ink[0], ink[1], ink[2], ink[3] * opacity];
    const paper = colorOf(required(scope.values, "--arbor-paper"));
    return samplesOf(resolve(state.style.background)).map((sample, i) => ({
      name: scope.name + ": " + state.name + " StoryTimeline filter count [" + i + "]",
      foreground,
      background: over(sample, paper),
      floor: AA,
    }));
  }));
}

/** The shared scoped rule outranks .arbor-app button { min-width: 0 }.
 * Verify the actual mapped control opts in and both dimensions use the
 * declared 44px token; browser verification still owns rendered geometry. */
function storyFilterTouchFailures(source: string, stylesheet: string, runtime: Scope[]): string[] {
  const consumer = storyFilterConsumer(source);
  const classes = consumer.match(/className="([^"]*)"/)?.[1].split(/\s+/) ?? [];
  const failures: string[] = [];
  if (!classes.includes("touch-target")) failures.push("filter button must use touch-target");
  const clean = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = clean.match(/\.touch-target,\s*\.arbor-app \.touch-target\s*\{([^}]+)\}/)?.[1];
  for (const dimension of ["height", "width"]) {
    if (!rule || !new RegExp("min-" + dimension + ":\\s*var\\(--touch-min\\);").test(rule)) {
      failures.push("app-scoped touch-target must set min-" + dimension);
    }
  }
  for (const scope of runtime) {
    if (scope.values["--touch-min"] !== "44px") failures.push(scope.name + ": touch floor must be 44px");
  }
  return failures;
}

const scopes = runtimeScopes(css);

describe("CR-01 — declared runtime contrast", () => {
  it("covers root, inherited themes, flat app/parent and nested parent cascades", () => {
    const rules = rulesOf(css);
    expect(rules.some((r) => r.selectors.includes(":root"))).toBe(true);
    // Theme cascades are derived from ACCENT_THEMES, not hardcoded. "green" is
    // :root (no attribute), so only the non-default themes need their own
    // block. This used to name teal and blue literally, which meant retiring
    // them broke the test — and, worse, re-adding a theme WITHOUT contrast
    // coverage would not have. Every offered theme now has to be audited.
    const themeSelectors = ACCENT_THEMES.filter((theme) => theme !== "green").map((theme) => `[data-theme="${theme}"]`);
    for (const selector of [...themeSelectors, ".arbor-app", ".arbor-parent"]) {
      expect(rules.some((r) => r.selectors.includes(selector)), selector).toBe(true);
    }
    // No magic total: every audited scope must belong to a cascade we support,
    // and the audit must actually be covering something. An exact integer here
    // only ever encoded "how many themes shipped the day this was written".
    expect(scopes.length).toBeGreaterThanOrEqual(12);
    const checked = new Set([...PAPER, ...TINTS, ...TEXT, ...CTA, ...FLAT_TINTS, "--accent",
      "--arbor-on-accent", "--arbor-green-cta-start", "--arbor-subtab-active", "--arbor-subtab-on-ink",
      ...FUNCTIONAL.map((tone) => "--arbor-" + tone + "-ink")]);
    const supported = new Set([":root", ".arbor-app", ".arbor-parent",
      ...ACCENT_THEMES.map((theme) => `[data-theme="${theme}"]`)]);
    const unsupported = rules.filter((r) => Object.keys(r.declarations).some((name) => checked.has(name)) &&
      (r.conditional || r.selectors.some((s) => !supported.has(s))));
    expect(unsupported, "Add explicit scenarios for new colour scopes; never silently skip them").toEqual([]);
  });

  for (const scope of scopes) {
    it(scope.name + ": normal text, functional inks, solid CTAs and every primary gradient segment meet AA", () => {
      const pairs = declaredPairs(scope);
      expect(pairs.length).toBeGreaterThan(500);
      expect(failures(pairs)).toEqual([]);
    });
  }

  it("the typed caption/primary accessors resolve to the tested declarations", () => {
    for (const reference of [T.clay, T.clayDeep, T.clayInk, T.muted, T.faint, T.mutedAlt, T.onAccent, T.greenCtaStart]) {
      const name = reference.match(/^var\((--[\w-]+)\)$/)![1];
      for (const scope of scopes) expect(() => colorOf(required(scope.values, name))).not.toThrow();
    }
  });

  it("primary Button uses declared on-accent ink with safe default and hover fills, and retains the touch floor", () => {
    const primary = button.match(/primary:\s*"([^"]+)"/)![1];
    expect(primary).toContain("text-[var(--arbor-on-accent)]");
    const fills = [...primary.matchAll(/(?:^|\s)(?:hover:)?bg-\[var\((--[\w-]+)\)\]/g)].map((m) => m[1]);
    expect(fills).toEqual(["--arbor-clay", "--arbor-clay-deep"]);
    for (const scope of scopes) {
      for (const fill of fills) {
        expect(contrast(colorOf(required(scope.values, "--arbor-on-accent")), colorOf(required(scope.values, fill)))).toBeGreaterThanOrEqual(AA);
      }
    }
    expect(button).toContain("touch-target");
    expect(css).toMatch(/\.touch-target,\s*\.arbor-app \.touch-target\s*\{/);
    expect(button).toContain("min-h-[var(--touch-min)]");
    expect(button).toContain("min-w-[var(--touch-min)]");
    for (const scope of scopes) expect(scope.values["--touch-min"]).toBe("44px");
    expect(primary).not.toMatch(/(?:^|\s)(?:hover:)?opacity-/);
  });
});

describe("CR-01 — negative controls and fail-closed source parsing", () => {
  it("anchors the WCAG arithmetic to black/white and the reported pre-fix CTA", () => {
    expect(contrast(colorOf("#000"), colorOf("#fff"))).toBe(21);
    expect(contrast(colorOf("#fff"), colorOf("#fff"))).toBe(1);
    expect(contrast(colorOf("#fff"), colorOf("#2b7fff"))).toBeCloseTo(3.762, 2);
  });

  // Verbatim pre-fix declarations: each must produce a failure through the
  // SAME declared-pair checker. None is excluded or treated as a passing floor.
  for (const [name, ink, background] of [
    ["flat solid CTA", "#ffffff", "#2b7fff"],
    ["flat primary accent", "#2b7fff", "#eef3fb"],
    ["root solid CTA", "#ffffff", "#58a6ff"],
    ["old muted caption on paper", "#6b7a6e", "#fbfaf7"],
    ["old faint caption on deep", "#8a958e", "#eef3fb"],
    ["root faint on deep", "#64748b", "#f1f4f2"],
    ["alternate muted on deep", "#69747f", "#eef3fb"],
    ["recommended fill used as text on deep", "#1a6be8", "#eef3fb"],
    ["root green ink on white", "#059669", "#ffffff"],
  ]) {
    it("rejects " + name, () => {
      const fixture = ":root { --ink: " + ink + "; --background: " + background + "; }";
      const values = cascade(rulesOf(fixture), {}, [":root"]);
      expect(failures([{ name, foreground: colorOf(values["--ink"]),
        background: colorOf(values["--background"]), floor: AA }])).toHaveLength(1);
    });
  }

  it("rejects the frozen pre-fix CTA gradient, including its bright middle stop", () => {
    const old = "linear-gradient(135deg, #58a6ff, #58a6ff 60%, #1f6feb)";
    const oldPairs = samplesOf(old).map((background, i) => ({
      name: "old gradient " + i, foreground: colorOf("#fff"), background, floor: AA,
    }));
    expect(failures(oldPairs).length).toBeGreaterThan(20);
    const middle = samplesOf("linear-gradient(135deg, #124da8, #58a6ff 60%, #124da8)");
    expect(failures(middle.map((background) => ({
      name: "bright interior", foreground: colorOf("#fff"), background, floor: AA,
    }))).length).toBeGreaterThan(0);
  });

  it("catches a later theme/flat override and preserves inherited computed aliases", () => {
    const fixture = ":root { --ink: #124da8; --alias: var(--ink); }\n" +
      '[data-theme="blue"] { --ink: #58a6ff; }\n' +
      ".arbor-app { --ink: #1558c0; }\n.arbor-app { --ink: #58a6ff }";
    const rules = rulesOf(fixture);
    const root = cascade(rules, {}, [":root"]);
    const theme = cascade(rules, {}, [":root", '[data-theme="blue"]']);
    const child = cascade(rules, root, [".arbor-app"]);
    expect(theme["--alias"]).toBe("#58a6ff");
    expect(child["--alias"]).toBe("#124da8");
    for (const values of [theme, child]) {
      expect(failures([{ name: "late regression", foreground: colorOf("#fff"),
        background: colorOf(values["--ink"]), floor: AA }])).toHaveLength(1);
    }
  });

  it("composites translucent tints instead of silently assuming white", () => {
    const tint = over(colorOf("rgba(43,127,255,0.10)"), colorOf("#eef3fb"));
    expect(contrast(colorOf("#1a6be8"), tint)).toBeLessThan(AA);
    expect(tint).not.toEqual(colorOf("#fff"));
  });

  it("throws on missing, cyclic, unsupported and unparsed colours", () => {
    expect(() => required({}, "--missing")).toThrow();
    expect(() => cascade(rulesOf(":root { --a: var(--b); --b: var(--a); }"), {}, [":root"])).toThrow();
    expect(() => cascade(rulesOf(":root { --a: var(--missing); }"), {}, [":root"])).toThrow();
    expect(() => colorOf("not-a-colour")).toThrow();
    expect(() => samplesOf("linear-gradient(135deg, #fff, unknown)")).toThrow();
    expect(() => samplesOf("linear-gradient(in oklab, #fff, #000)")).toThrow();
  });
});


describe("CR-01 — StoryTimeline filter-count consumer", () => {
  const source = readFileSync(path.join(here, "..", "components", "tabs", "StoryTimelineTab.tsx"), "utf8");

  it("the actual filter button retains the app-scoped 44px touch floor in both states", () => {
    expect(storyFilterTouchFailures(source, css, scopes)).toEqual([]);
  });

  it("rejects the pre-fix control without touch-target and a lost app-scoped floor", () => {
    const consumer = storyFilterConsumer(source);
    const old = source.replace(consumer, consumer.replace("touch-target ", ""));
    expect(old).not.toBe(source);
    expect(storyFilterTouchFailures(old, css, scopes)).toEqual(["filter button must use touch-target"]);
    const unscoped = css.replace(/\.touch-target,\s*\.arbor-app \.touch-target/, ".touch-target");
    expect(unscoped).not.toBe(css);
    expect(storyFilterTouchFailures(source, unscoped, scopes)).toEqual([
      "app-scoped touch-target must set min-height",
      "app-scoped touch-target must set min-width",
    ]);
  });

  for (const state of ["selected", "unselected"]) {
    it(state + " count meets AA using its actual styles and inherited ink", () => {
      const pairs = storyFilterCountPairs(source, scopes).filter((pair) =>
        pair.name.includes(": " + state + " StoryTimeline"));
      expect(new Set(pairs.map((pair) => pair.name.split(":")[0])).size).toBe(scopes.length);
      expect(failures(pairs)).toEqual([]);
    });

    it("rejects the pre-fix opacity-60 count in the " + state + " state", () => {
      const old = source.replace("<span>{n}</span>", '<span className="opacity-60">{n}</span>');
      expect(old).not.toBe(source);
      const pairs = storyFilterCountPairs(old, scopes).filter((pair) =>
        pair.name.includes(": " + state + " StoryTimeline"));
      expect(pairs.length).toBeGreaterThanOrEqual(scopes.length);
      expect(failures(pairs)).toHaveLength(pairs.length);
    });
  }

  it("fails closed if the consumer moves or gains an unmodelled text effect", () => {
    expect(() => storyFilterCountPairs(source.replace("{/* Filters */}", ""), scopes)).toThrow();
    const unmodelled = source.replace("<span>{n}</span>", "<span style={{ opacity: 0.6 }}>{n}</span>");
    expect(unmodelled).not.toBe(source);
    expect(() => storyFilterCountPairs(unmodelled, scopes)).toThrow();
  });
});
