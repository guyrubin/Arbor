import { describe, expect, it, vi } from "vitest";
import { createAccountDeletionLeases } from "./accountDeletionLease";

describe("account deletion pending leases", () => {
  it("deduplicates one UID while allowing independent accounts", () => {
    const leases = createAccountDeletionLeases();
    const a = leases.acquire("a"), b = leases.acquire("b");
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(leases.acquire("a")).toBeNull();
    a!.release(); expect(leases.isPending("a")).toBe(false); expect(leases.isPending("b")).toBe(true);
    b!.release();
  });
  it("a new subscriber observes the existing request and its settlement", () => {
    const leases = createAccountDeletionLeases();
    const first = leases.acquire("a")!;
    const snapshots: boolean[] = [leases.isPending("a")];
    const stop = leases.subscribe("a", () => snapshots.push(leases.isPending("a")));
    first.release(); const second = leases.acquire("a")!;
    first.release(); // stale release cannot retire the next request
    expect(leases.isPending("a")).toBe(true);
    second.release(); expect(snapshots).toEqual([true, false, true, false]);
    stop();
  });
  it("unsubscription is idempotent and cannot remove a replacement subscriber", () => {
    const leases = createAccountDeletionLeases(), old = vi.fn(), current = vi.fn(), other = vi.fn();
    const stopOld = leases.subscribe("a", old); stopOld();
    const stopCurrent = leases.subscribe("a", current), stopOther = leases.subscribe("b", other);
    stopOld(); const lease = leases.acquire("a")!;
    expect(old).not.toHaveBeenCalled(); expect(current).toHaveBeenCalledOnce(); expect(other).not.toHaveBeenCalled();
    stopCurrent(); lease.release(); expect(current).toHaveBeenCalledOnce(); stopOther();
  });
});
