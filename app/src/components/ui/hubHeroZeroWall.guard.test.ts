/**
 * RUN-08 "zero wall", held open for every hub — including the ones not written yet.
 *
 * A day-0 parent has done nothing yet, so every hub's stat trio reads
 * "0 · 0 · 0". That is not information; it is a wall of zeroes greeting someone
 * on their first session. HubHero takes a `zeroLine` — a translated teach line
 * shown INSTEAD of the trio while every stat is zero.
 *
 * All six mounts pass it today. That is exactly the shape of guard that has
 * failed this codebase repeatedly: every leak we have found lived just off a
 * list of named files, and a fix that is true of the six files someone checked
 * is not a property of the app. So this walks the tree instead — any future
 * hub that renders a trio without a zeroLine fails here, on the day it is
 * written rather than on a parent's first morning.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");

const listTsx = (dir: string): string[] =>
  fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) return listTsx(full);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
  });

/** Every `<HubHero ... />` or `<HubHero ...>` opening tag in the tree. */
const mounts = listTsx(SRC).flatMap((file) => {
  const src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return [...src.matchAll(/<HubHero\b[\s\S]{0,1200}?\/?>/g)].map((m) => ({
    file: path.relative(SRC, file).split(path.sep).join("/"),
    tag: m[0],
  }));
});

describe("RUN-08 · no hub greets a day-0 parent with a wall of zeroes", () => {
  it("the scan is real and actually finds the hubs (a vacuous scan is not a pass)", () => {
    const files = new Set(mounts.map((m) => m.file));
    expect(mounts.length).toBeGreaterThanOrEqual(6);
    // Named anchors: if the component is renamed or moved, this fails loudly
    // rather than silently scanning nothing and reporting success.
    expect(files.has("components/tabs/DevelopmentTab.tsx")).toBe(true);
    expect(files.has("components/tabs/BehaviorsTab.tsx")).toBe(true);
  });

  it("every hub that renders a stat trio also supplies a zeroLine", () => {
    const offenders = mounts
      .filter(({ tag }) => /\btrio=/.test(tag) && !/\bzeroLine=/.test(tag))
      .map(({ file }) => file);
    expect(
      offenders,
      "a HubHero with a trio and no zeroLine shows a day-0 parent 0 · 0 · 0 — pass the translated teach line",
    ).toEqual([]);
  });

  it("the zeroLine is translated, never a hard-coded English string", () => {
    // A literal would ship English to a Hebrew-reading parent on the one screen
    // that is meant to be welcoming.
    const literals = mounts
      .filter(({ tag }) => /\bzeroLine=["'][^"']/.test(tag))
      .map(({ file }) => file);
    expect(literals, "zeroLine must resolve through t()/an elevation dictionary").toEqual([]);
  });

  it("NEGATIVE CONTROL: the checks fire on a hub written the wrong way", () => {
    const bad = `<HubHero title={x} trio={stats} icon={Icon} />`;
    expect(/\btrio=/.test(bad) && !/\bzeroLine=/.test(bad)).toBe(true);
    const hardCoded = `<HubHero trio={stats} zeroLine="Nothing here yet" />`;
    expect(/\bzeroLine=["'][^"']/.test(hardCoded)).toBe(true);
    // ...and pass on a correctly written one.
    const good = `<HubHero trio={stats} zeroLine={t("elev.growthTruth.hub.zero")} />`;
    expect(/\btrio=/.test(good) && !/\bzeroLine=/.test(good)).toBe(false);
    expect(/\bzeroLine=["'][^"']/.test(good)).toBe(false);
  });
});
