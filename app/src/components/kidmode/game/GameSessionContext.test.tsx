import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GameCompletionProvider, useGameSession } from "./GameSessionContext";

describe("optional V2 game boundary", () => {
  it("leaves the existing practice/default route unmodified", () => {
    let session: unknown;
    function Read() { session = useGameSession(); return null; }
    renderToStaticMarkup(<Read />);
    expect(session).toBeNull();
  });
  it("only the explicit provider enables play-only behavior and forwards actual completion", () => {
    const complete = vi.fn(); let session: ReturnType<typeof useGameSession> = null;
    function Read() { session = useGameSession(); return null; }
    renderToStaticMarkup(<GameCompletionProvider onComplete={complete}><Read /></GameCompletionProvider>);
    expect(session).toEqual({ playOnly: true, onComplete: complete });
    expect(complete).not.toHaveBeenCalled();
    (session as unknown as { onComplete: () => void }).onComplete();
    expect(complete).toHaveBeenCalledOnce();
  });
});
