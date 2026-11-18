/**
 * V77 — the two shell slots a route fills (lib/shellSlots): the breadcrumb's
 * last level and the end of the desktop pill row. The store must only wake the
 * shell when the content changes (a route re-rendering must never loop it), and
 * the row's end must draw each form the boards use.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetShellSlotsForTest, setShellSlots, subscribeShellSlots, useShellSlots } from "./shellSlots";
import { ShellRowEndView } from "../components/layout/ShellRowEnd";

const MON_16_NOV_1740 = new Date(2026, 10, 16, 17, 40);

afterEach(() => resetShellSlotsForTest());

function Probe() {
  const { crumb, rowEnd } = useShellSlots();
  return <i data-crumb={crumb ?? ""} data-end={rowEnd?.suffix ?? ""} />;
}

describe("the store", () => {
  it("a route's crumb and row end are read by the shell", () => {
    setShellSlots({ crumb: "Reads", rowEnd: { suffix: "your record since Thu 8 Oct" } });
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('data-crumb="Reads"');
    expect(html).toContain('data-end="your record since Thu 8 Oct"');
  });

  it("the same content does not wake the shell; new content does (no render loop)", () => {
    const seen = vi.fn();
    const unsubscribe = subscribeShellSlots(seen);
    setShellSlots({ rowEnd: { suffix: "a" } });
    setShellSlots({ rowEnd: { suffix: "a" } });
    setShellSlots({ crumb: null });
    expect(seen).toHaveBeenCalledTimes(1);
    // Negative control: different content does wake it.
    setShellSlots({ rowEnd: { suffix: "b" } });
    expect(seen).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("the end of the pill row", () => {
  const render = (end: Parameters<typeof ShellRowEndView>[0]["end"], lang: "en" | "he" = "en") =>
    renderToStaticMarkup(<ShellRowEndView now={MON_16_NOV_1740} uiLang={lang} end={end} />);

  it("by default: the day and the time", () => {
    expect(render(null)).toContain("Monday 16 November · 17:40");
  });

  it("a suffix replaces the time (My child: your record since …)", () => {
    const html = render({ suffix: "your record since Thu 8 Oct" });
    expect(html).toContain("Monday 16 November · your record since Thu 8 Oct");
    expect(html).not.toContain("17:40");
  });

  it("the day alone (Things said)", () => {
    const html = render({ dateOnly: true });
    expect(html).toContain("Monday 16 November");
    expect(html).not.toContain("17:40");
    expect(html).not.toContain(" · ");
  });

  it("a route's own sentence replaces the day (Weekly report)", () => {
    const html = render({ text: "Today is Monday 16. Tuesday to Friday are still ahead." });
    expect(html).toContain("Today is Monday 16. Tuesday to Friday are still ahead.");
    expect(html).not.toContain("Monday 16 November");
  });

  it("a link alone (Moments: Professional view)", () => {
    const html = render({ link: { label: "Professional view", onClick: () => {} } });
    expect(html).toMatch(/<button[^>]*class="ds-link ds-shellrow-when"[^>]*>Professional view<\/button>/);
    expect(html).not.toContain("Monday 16 November");
  });

  it("an action after the day and time (Visits: Add appointment), a 44 px ghost button", () => {
    const html = render({ action: { label: "Add appointment", onClick: () => {}, icon: "add" } });
    expect(html).toContain("Monday 16 November · 17:40");
    expect(html).toMatch(/<button[^>]*class="btn ghost sm"[^>]*>.*Add appointment<\/button>/);
  });

  it("Hebrew: the shell's day in Hebrew, the route's words as given", () => {
    const html = render({ suffix: "התיעוד שלכם מאז" }, "he");
    expect(html).toContain("16 בנובמבר");
    expect(html).toContain("התיעוד שלכם מאז");
  });
});
