import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ChildPortraitProps } from "./ChildPortrait";

/* F-INT-1 — dead wiring removed. F-CHILD-1 stopped reading ChildPortrait's
   onSaveQuestion (the Milestones pill has no "save as our question" door; the
   question is saved from Moments' evidence sheet), yet Shell still built and
   passed it. The prop is gone from ChildPortrait's props and from Shell's
   Milestones mount; createTopic keeps its live callers. */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
// Comments may tell the history; only code counts.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("F-INT-1 — ChildPortrait's unread onSaveQuestion is gone", () => {
  it("ChildPortrait declares only the prop it reads", () => {
    const portrait = code(read("./ChildPortrait.tsx"));
    expect(portrait).not.toContain("onSaveQuestion");
    expect(portrait).toMatch(/export interface ChildPortraitProps \{\s*onDiscuss\?: \(prompt: string, childId: string\) => void;\s*\}/);
    expect(portrait).toContain("export default function ChildPortrait({ onDiscuss }: ChildPortraitProps)");
    // Compile-time pin (CI's lint step type-checks tests): the key no longer exists.
    // @ts-expect-error onSaveQuestion is not a ChildPortrait prop
    const stale: ChildPortraitProps = { onSaveQuestion: () => undefined };
    expect(stale).toBeTypeOf("object");
  });

  it("Shell mounts the Milestones pill with onDiscuss only, and createTopic still serves Now and the topic sheet", () => {
    const shell = code(read("../layout/Shell.tsx"));
    expect(shell).not.toContain("onSaveQuestion");
    const start = shell.indexOf("<DevelopmentTab ");
    expect(start).toBeGreaterThan(-1);
    const mount = shell.slice(start, shell.indexOf("/>", start) + 2);
    expect(mount).toContain("onDiscuss={(prompt, childId) =>");
    expect(mount).not.toContain("createTopic");
    expect(shell).toContain("onTopicCreate={createTopic}");
    expect(shell).toMatch(/if \(request\?\.startNew\) createTopic\(/);
  });
});
