import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Deterministic hook harness: invoke the component's actual start handler and
// unmount cleanup without a browser, camera, model download or live child data.
const harness = vi.hoisted(() => ({
  cleanups: [] as (() => void)[],
  setters: [] as ReturnType<typeof vi.fn>[],
  getUserMedia: vi.fn(), model: vi.fn(), raf: vi.fn(() => 1), cancel: vi.fn(),
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual,
    useState: (initial: unknown) => { const set = vi.fn(); harness.setters.push(set); return [initial, set]; },
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: (effect: () => void | (() => void)) => { const cleanup = effect(); if (cleanup) harness.cleanups.push(cleanup); },
  };
});
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: () => ({ mimic: { upsert: vi.fn() } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../../lib/faceLandmarker", () => ({ getFaceLandmarker: harness.model }));
vi.mock("../../lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../../lib/kidModeGate", () => ({ noteKidActivity: vi.fn() }));
import MimicMatch from "./MimicMatch";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
function find(node: unknown, type: string): ReactElement<any> | undefined {
  if (Array.isArray(node)) return node.map((child) => find(child, type)).find(Boolean);
  if (!node || typeof node !== "object" || !("props" in node)) return undefined;
  const element = node as ReactElement<any>;
  return element.type === type ? element : find(element.props.children, type);
}
function mount(play = vi.fn().mockResolvedValue(undefined), childId = "synthetic-child") {
  const tree = MimicMatch({ childId, name: "Noa" });
  const video = { srcObject: null as unknown, play, readyState: 0 };
  find(tree, "video")!.props.ref.current = video;
  return { start: find(tree, "button")!.props.onClick as () => Promise<void>, video, close: harness.cleanups.at(-1)! };
}
const stream = () => { const stop = vi.fn(); return { stop, value: { getTracks: () => [{ stop }] } }; };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks(); harness.cleanups = []; harness.setters = [];
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: harness.getUserMedia } });
  vi.stubGlobal("requestAnimationFrame", harness.raf);
  vi.stubGlobal("cancelAnimationFrame", harness.cancel);
  harness.model.mockResolvedValue({ detectForVideo: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("Face Match disclosure lifetime", () => {
  it("releases a stream arriving after close before any model load", async () => {
    const media = deferred<unknown>(); const camera = stream();
    harness.getUserMedia.mockReturnValue(media.promise);
    const view = mount(); const start = view.start();
    view.close(); media.resolve(camera.value); await start;
    expect(camera.stop).toHaveBeenCalledOnce();
    expect(harness.model).not.toHaveBeenCalled();
    expect(harness.raf).not.toHaveBeenCalled();
    expect(harness.setters[0].mock.calls).toEqual([["loading"]]);
  });
  it("closes the acquired stream while the model is pending and never restarts it", async () => {
    const model = deferred<unknown>(); const camera = stream();
    harness.getUserMedia.mockResolvedValue(camera.value); harness.model.mockReturnValue(model.promise);
    const view = mount(); const start = view.start(); await flush();
    view.close(); expect(camera.stop).toHaveBeenCalled();
    model.resolve({ detectForVideo: vi.fn() }); await start;
    expect(view.video.play).not.toHaveBeenCalled();
    expect(harness.raf).not.toHaveBeenCalled();
  });
  it("does not schedule a frame or set live after close during video playback startup", async () => {
    const playback = deferred<void>(); const camera = stream();
    harness.getUserMedia.mockResolvedValue(camera.value);
    const view = mount(vi.fn(() => playback.promise)); const start = view.start(); await flush();
    expect(view.video.play).toHaveBeenCalled();
    view.close(); playback.resolve(); await start;
    expect(camera.stop).toHaveBeenCalled();
    expect(view.video.srcObject).toBeNull();
    expect(harness.raf).not.toHaveBeenCalled();
    expect(harness.setters[0].mock.calls).toEqual([["loading"]]);
  });
  it("a previous child's late permission cannot replace or stop the new child's session", async () => {
    const pending = deferred<unknown>(); const previousCamera = stream(); const currentCamera = stream();
    harness.getUserMedia.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(currentCamera.value);
    const previous = mount(undefined, "previous-child"); const previousStart = previous.start();
    // The parent disclosure keys its session to the child ID: switching
    // unmounts the old instance and the new child needs another explicit Start.
    previous.close();
    const current = mount(undefined, "current-child"); await current.start();
    pending.resolve(previousCamera.value); await previousStart;
    expect(previousCamera.stop).toHaveBeenCalledOnce();
    expect(currentCamera.stop).not.toHaveBeenCalled();
    expect(current.video.srcObject).toBe(currentCamera.value);
    expect(harness.model).toHaveBeenCalledOnce();
    expect(harness.raf).toHaveBeenCalledOnce();
    current.close(); expect(currentCamera.stop).toHaveBeenCalledOnce();
  });
  it("coalesces repeated start taps and a fresh disclosure can still start", async () => {
    const media = deferred<unknown>(); const first = stream();
    harness.getUserMedia.mockReturnValue(media.promise);
    const view = mount(); const start = view.start(); await view.start();
    expect(harness.getUserMedia).toHaveBeenCalledOnce();
    view.close(); media.resolve(first.value); await start;
    const second = stream(); harness.getUserMedia.mockResolvedValue(second.value);
    const reopened = mount(); await reopened.start();
    expect(reopened.video.srcObject).toBe(second.value);
    expect(second.stop).not.toHaveBeenCalled();
    expect(harness.raf).toHaveBeenCalledOnce();
    reopened.close(); expect(second.stop).toHaveBeenCalledOnce();
  });
});
