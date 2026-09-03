/** One voice attempt owns its cancellation signal and any adopted Live session.
 * Invalidate BEFORE abort/stop: synchronous teardown callbacks must see stale
 * ownership and cannot clear, restart or append to the next attempt. */
export type VoiceResource = { stop(): void };
export type VoiceAttempt = {
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  adopt(resource: VoiceResource): boolean;
  end(): boolean;
};
export function createVoiceLifetime() {
  let current: VoiceAttempt | null = null;
  let release: (() => void) | null = null;
  const cancel = () => {
    const dispose = release;
    current = null;
    release = null;
    dispose?.();
  };
  return {
    get current() { return current; },
    cancel,
    begin(): VoiceAttempt {
      cancel();
      const abort = new AbortController();
      let resource: VoiceResource | null = null;
      const attempt: VoiceAttempt = {
        signal: abort.signal,
        isCurrent: () => current === attempt && !abort.signal.aborted,
        adopt(next) {
          if (!attempt.isCurrent()) { next.stop(); return false; }
          resource = next;
          return true;
        },
        end() {
          if (!attempt.isCurrent()) return false;
          cancel();
          return true;
        },
      };
      current = attempt;
      release = () => {
        abort.abort();
        resource?.stop();
        resource = null;
      };
      return attempt;
    },
  };
}
