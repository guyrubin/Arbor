/**
 * B-SHELL-22 — Android back closes the open sheet/dialog before it changes
 * the tab. The Capacitor App listener is mocked and driven directly; the
 * dialog stack's real `closeTop` contract is exercised in dialogStack.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  backHandler: null as null | ((e: { canGoBack: boolean }) => void),
  exitApp: vi.fn(),
  closeTop: vi.fn(() => false),
  kidMode: false,
  historyBack: vi.fn(),
  historyLength: 3,
}));

vi.mock("./runtime", () => ({ isNativePlatform: true, nativePlatform: "android" }));
vi.mock("./kidModeGate", () => ({ isKidModeActive: () => h.kidMode }));
vi.mock("./dialogStack", () => ({ closeTop: h.closeTop }));
vi.mock("./nativeBilling", () => ({ configureNativeBilling: async () => undefined }));
vi.mock("@capacitor/status-bar", () => ({ StatusBar: { setStyle: async () => undefined, setBackgroundColor: async () => undefined }, Style: { Dark: "DARK" } }));
vi.mock("@capacitor/keyboard", () => ({ Keyboard: { setResizeMode: async () => undefined }, KeyboardResize: { Native: "native" } }));
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: { hide: async () => undefined } }));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (name: string, fn: (e: { canGoBack: boolean }) => void) => { if (name === "backButton") h.backHandler = fn; },
    exitApp: h.exitApp,
  },
}));

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: { dataset: {}, classList: { add: () => undefined } } };
g.window = { history: { get length() { return h.historyLength; }, back: h.historyBack } };

async function boot() {
  const { initNativeShell } = await import("./native");
  await initNativeShell();
  expect(h.backHandler, "the backButton listener was registered").toBeTypeOf("function");
  return h.backHandler!;
}

beforeEach(() => {
  h.exitApp.mockClear(); h.historyBack.mockClear(); h.closeTop.mockReset();
  h.closeTop.mockImplementation(() => false);
  h.kidMode = false; h.historyLength = 3;
});

describe("B-SHELL-22 · Android back", () => {
  it("with More (a sheet) open, back closes the sheet and keeps the tab", async () => {
    const back = await boot();
    h.closeTop.mockImplementation(() => true);
    back({ canGoBack: true });
    expect(h.closeTop).toHaveBeenCalledTimes(1);
    expect(h.historyBack).not.toHaveBeenCalled();
    expect(h.exitApp).not.toHaveBeenCalled();
  });

  it("with nothing open, back goes to the previous tab (history) — the Learn reader's popstate path", async () => {
    const back = await boot();
    back({ canGoBack: true });
    expect(h.closeTop).toHaveBeenCalledTimes(1);
    expect(h.historyBack).toHaveBeenCalledTimes(1);
    expect(h.exitApp).not.toHaveBeenCalled();
  });

  it("at the root with nothing open, back exits the app", async () => {
    const back = await boot();
    h.historyLength = 1;
    back({ canGoBack: false });
    expect(h.exitApp).toHaveBeenCalledTimes(1);
    expect(h.historyBack).not.toHaveBeenCalled();
  });

  it("Kid Mode: back does nothing at all (the parent gate is the only way out)", async () => {
    const back = await boot();
    h.kidMode = true;
    h.closeTop.mockImplementation(() => true);
    back({ canGoBack: true });
    expect(h.closeTop).not.toHaveBeenCalled();
    expect(h.historyBack).not.toHaveBeenCalled();
    expect(h.exitApp).not.toHaveBeenCalled();
  });
});
