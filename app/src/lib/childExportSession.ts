import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseEnabled } from "./firebase";
import { isKidModeActive, subscribeKidMode } from "./kidModeGate";

export interface ChildExportSession {
  signal: AbortSignal;
  assertCurrent(): void;
  read<T>(work: () => Promise<T>): Promise<T>;
}

/** Keep one owner/cancellation boundary around an entire export and its final
 * consumer. React's last rendered user is not an authorization boundary.
 * A real account is pinned before any read. Only the explicitly unconfigured
 * local sandbox may export local records without a Firebase user.
 */
export async function withChildExportSession<T>(uid: string | undefined, signal: AbortSignal | undefined, work: (session: ChildExportSession) => Promise<T>): Promise<T> {
  signal?.throwIfAborted();
  const local = !firebaseEnabled && (!uid || uid === "local-sandbox");
  const owner = local ? null : auth?.currentUser;
  const invalid = () => new DOMException("The export session is no longer active", "AbortError");
  if (isKidModeActive() || (!local && (!uid || !owner || owner.uid !== uid))) throw invalid();
  const controller = new AbortController();
  let changed = false;
  let disposed = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  let unsubscribe: () => void = () => undefined;
  const unsubscribeKidMode = subscribeKidMode(active => { if (active) controller.abort(); });
  try {
    if (!local) unsubscribe = onAuthStateChanged(auth!, (current) => {
      if (current !== owner) { changed = true; controller.abort(); }
    });
  } catch (e) {
    signal?.removeEventListener("abort", cancel);
    unsubscribeKidMode();
    controller.abort();
    throw e;
  }
  const assertCurrent = () => {
    if (disposed || changed || controller.signal.aborted || isKidModeActive() || (!local && auth?.currentUser !== owner)) throw invalid();
  };
  const session: ChildExportSession = {
    signal: controller.signal,
    assertCurrent,
    async read(read) {
      assertCurrent();
      let stop: () => void = () => undefined;
      try {
        const value = await Promise.race([
          read(),
          new Promise<never>((_, reject) => {
            stop = () => reject(invalid());
            controller.signal.addEventListener("abort", stop, { once: true });
            if (controller.signal.aborted) stop();
          }),
        ]);
        assertCurrent();
        return value;
      } catch (e) {
        assertCurrent(); // a source failure cannot downgrade session invalidation
        throw e;
      } finally {
        controller.signal.removeEventListener("abort", stop);
      }
    },
  };
  try {
    assertCurrent();
    const result = await work(session);
    assertCurrent();
    return result;
  } finally {
    disposed = true;
    unsubscribe();
    unsubscribeKidMode();
    signal?.removeEventListener("abort", cancel);
    controller.abort();
  }
}
