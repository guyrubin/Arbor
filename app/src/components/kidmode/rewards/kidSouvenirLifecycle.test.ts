import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as any[], effects: [] as (() => void)[], owner: "a", loaded: true, upsert: vi.fn(async (_item: unknown) => {}) }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useRef(value: unknown) { return (h.slots[h.cursor++] ??= { current: value }); },
  useState(value: unknown) { const i = h.cursor++; h.slots[i] ??= { value }; return [h.slots[i].value, (next: unknown) => { h.slots[i].value = next; }]; },
  useCallback(fn: unknown) { return fn; },
  useEffect(fn: () => void | (() => void), deps: unknown[]) { const i = h.cursor++, old = h.slots[i]; if (old?.deps && deps.every((d,n) => Object.is(d,old.deps[n]))) return; const slot = h.slots[i] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { slot.cleanup?.(); slot.cleanup = fn(); }); },
}));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.owner } }) }));
vi.mock("../../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: h.loaded, isCurrent: () => true, upsert: h.upsert }) }));
vi.mock("../../ui/HeroAvatar", () => ({ HeroAvatar: () => null }));
vi.mock("../../../hooks/useKidTheme", () => ({ useKidTheme: () => "film3d" }));
import { useAwardSouvenir } from "./KidSouvenir";
import { useKidSouvenirs } from "./useKidSouvenirs";
const render = () => { h.cursor = 0; const result = useAwardSouvenir("kid","world","memory",true); for (const effect of h.effects.splice(0)) effect(); return result; };
const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
beforeEach(() => { h.cursor=0;h.slots=[];h.effects=[];h.owner="a";h.loaded=true;h.upsert.mockReset().mockResolvedValue(undefined); });
describe("souvenir lifetime", () => {
  it("announces only after durable upsert accepts the deterministic award", async () => {
    let resolve!: () => void; h.upsert.mockImplementation(() => new Promise<void>(r => { resolve=r; }));
    expect(render()).toBe(false); expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({id:"world:memory"}));
    resolve(); await flush(); expect(render()).toBe(true); h.owner="b"; expect(render()).toBe(false);
  });
  it("late A to B to A owner callback cannot announce in a new session", async () => {
    let resolve!: () => void; h.upsert.mockImplementationOnce(() => new Promise<void>(r => { resolve=r; }));
    render(); h.owner="b"; h.loaded=false; render(); h.owner="a";render(); resolve();await flush();expect(render()).toBe(false);
  });
  it("stale owner closure cannot enqueue", async () => {
    h.cursor=0; const old = useKidSouvenirs("kid");h.owner="b";h.cursor=0;useKidSouvenirs("kid");
    expect(await old.awardOnce("world","memory")).toBe(false);expect(h.upsert).not.toHaveBeenCalled();
  });
  it("failed persistence never claims a new souvenir", async () => { h.upsert.mockRejectedValue(new Error("unavailable"));render();await flush();expect(render()).toBe(false); });
});
