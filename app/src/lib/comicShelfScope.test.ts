import { describe, expect, it } from "vitest";
import { comicShelfReadIsCurrent, type ComicShelfReadToken } from "./comicShelfScope";

describe("parent comic shelf async scope", () => {
  it("drops a pending saved-book read after the active child changes", async () => {
    let release!: (pages: string[]) => void;
    const pending = new Promise<string[]>((resolve) => { release = resolve; });
    const started: ComicShelfReadToken = { scope: "account|child-a|books-a", request: 4 };
    let current = started;
    let committed: string[] | undefined;
    const completion = pending.then((pages) => {
      if (comicShelfReadIsCurrent(started, current)) committed = pages;
    });

    current = { scope: "account|child-b|books-b", request: 5 };
    release(["child-a-page"]);
    await completion;

    expect(committed).toBeUndefined();
  });

  it("accepts the result only while both scope and request remain current", () => {
    const started = { scope: "account|child-a|books-a", request: 4 };
    expect(comicShelfReadIsCurrent(started, started)).toBe(true);
    expect(comicShelfReadIsCurrent(started, { ...started, request: 5 })).toBe(false);
  });
});

