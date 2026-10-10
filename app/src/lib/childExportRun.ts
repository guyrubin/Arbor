/** Synchronous duplicate-click guard and latest-owner/child lifecycle token. */
export function createChildExportRun() {
  let active: { scope: string; controller: AbortController } | null = null;
  return {
    begin(scope: string) {
      if (active) return null;
      active = { scope, controller: new AbortController() };
      return active;
    },
    current(run: { scope: string; controller: AbortController }, scope: string) {
      return active === run && run.scope === scope && !run.controller.signal.aborted;
    },
    finish(run: { controller: AbortController }) { if (active === run) active = null; },
    cancel() { active?.controller.abort(); active = null; },
  };
}
