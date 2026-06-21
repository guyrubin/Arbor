import { describe, it, expect, beforeEach } from "vitest";
import { getScene, setScene, resolveScene, _resetSceneCache } from "./sceneCache";

describe("sceneCache (S3)", () => {
  beforeEach(() => _resetSceneCache());

  it("stores and retrieves a panel by key", () => {
    expect(getScene("k1")).toBeUndefined();
    setScene("k1", "data:image/png;base64,AAA");
    expect(getScene("k1")).toBe("data:image/png;base64,AAA");
  });

  it("resolveScene generates once, then serves from cache (no re-pay)", async () => {
    let calls = 0;
    const gen = () => {
      calls++;
      return Promise.resolve("data:url-1");
    };
    const a = await resolveScene("key", gen);
    const b = await resolveScene("key", gen);
    expect(a).toBe("data:url-1");
    expect(b).toBe("data:url-1");
    expect(calls).toBe(1); // second call hit the cache
  });

  it("dedupes concurrent identical requests into one generation", async () => {
    let calls = 0;
    let release!: (v: string) => void;
    const pending = new Promise<string>((r) => (release = r));
    const gen = () => {
      calls++;
      return pending;
    };
    const p1 = resolveScene("dup", gen);
    const p2 = resolveScene("dup", gen);
    release("data:shared");
    expect(await p1).toBe("data:shared");
    expect(await p2).toBe("data:shared");
    expect(calls).toBe(1); // only one generation despite two concurrent callers
  });
});
