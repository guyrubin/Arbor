import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { settleOrQueue } from "./firestoreWrite";

const never = () => new Promise<void>(() => { /* the server never answers */ });

describe("settleOrQueue — a capture never waits on the network to be kept", () => {
  it("an acknowledged write resolves as acknowledged", async () => {
    await expect(settleOrQueue(Promise.resolve(), { online: () => true, ackMs: 50 })).resolves.toBe("acknowledged");
  });

  it("a rejection that arrives in time still rejects (the caller keeps its draft)", async () => {
    await expect(settleOrQueue(Promise.reject(new Error("permission-denied")), { online: () => true, ackMs: 50 })).rejects.toThrow("permission-denied");
  });

  it("offline, the write is queued at once instead of hanging on Saving…", async () => {
    await expect(settleOrQueue(never(), { online: () => false, ackMs: 10_000 })).resolves.toBe("queued");
  });

  it("online but unanswered, the write counts as kept after the ack window", async () => {
    vi.useFakeTimers();
    try {
      const outcome = settleOrQueue(never(), { online: () => true, ackMs: 4000 });
      await vi.advanceTimersByTimeAsync(4000);
      await expect(outcome).resolves.toBe("queued");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a late rejection after queueing is logged, never an unhandled rejection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let reject!: (err: Error) => void;
    const write = new Promise<void>((_, r) => { reject = r; });
    await expect(settleOrQueue(write, { online: () => false })).resolves.toBe("queued");
    reject(new Error("late"));
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("remote writes keep queued defaults and require an explicit opt-in for server acknowledgement", () => {
    const hook = readFileSync(fileURLToPath(new URL("../hooks/useChildCollection.ts", import.meta.url)), "utf8");
    const upsert = hook.slice(hook.indexOf("const upsert = useCallback("), hook.indexOf("const remove = useCallback("));
    expect(upsert).toContain("const write = setDoc(");
    expect(upsert).toMatch(/if\s*\(options\?\.awaitServer\)\s*await write;\s*else\s*await settleOrQueue\(write\);/);
    expect(hook).toContain("await settleOrQueue(deleteDoc(");
    expect(hook).not.toMatch(/await setDoc\(|await deleteDoc\(/);
  });
});
