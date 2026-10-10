/** Synthetic business-date fixture only. Native monotonic clocks and animation
 * APIs must remain untouched: Motion's WAAPI start times share their timeline. */
export function installConfirmedDate(epoch) {
  if (!Number.isFinite(epoch)) throw new Error('CONFIRMED_DATE_INVALID');
  if (window.__arborConfirmedDateClock) throw new Error('CONFIRMED_DATE_ALREADY_INSTALLED');
  const descriptor = Object.getOwnPropertyDescriptor(window, 'Date');
  const NativeDate = window.Date;
  const native = { performance: window.performance, now: window.performance.now,
    setTimeout: window.setTimeout, setInterval: window.setInterval,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
    timeline: window.document?.timeline, animate: window.Element?.prototype.animate };
  const state = { epoch, mode: 'synthetic-Date-only-native-animation-time',
    snapshot: () => ({ mode: state.mode, fixedEpoch: state.epoch,
      nativeTimingPreserved: window.performance === native.performance && window.performance.now === native.now
        && window.setTimeout === native.setTimeout && window.setInterval === native.setInterval
        && window.requestAnimationFrame === native.requestAnimationFrame && window.cancelAnimationFrame === native.cancelAnimationFrame
        && window.document?.timeline === native.timeline && window.Element?.prototype.animate === native.animate }),
    restore: () => Object.defineProperty(window, 'Date', descriptor) };
  const FixtureDate = new Proxy(NativeDate, {
    apply() { return new NativeDate(state.epoch).toString(); },
    construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [state.epoch], newTarget); },
    get(target, property, receiver) { return property === 'now' ? () => state.epoch : Reflect.get(target, property, receiver); },
  });
  Object.defineProperty(window, 'Date', { ...descriptor, value: FixtureDate });
  window.__arborConfirmedDateClock = state;
  return state.snapshot();
}

export function changeConfirmedDate(epoch) {
  if (!Number.isFinite(epoch)) throw new Error('CONFIRMED_DATE_INVALID');
  const state = window.__arborConfirmedDateClock;
  if (!state) throw new Error('CONFIRMED_DATE_NOT_INSTALLED');
  state.epoch = epoch;
  return state.snapshot();
}

export function restoreConfirmedDate() {
  const state = window.__arborConfirmedDateClock;
  if (!state) return null;
  const evidence = state.snapshot();
  state.restore();
  delete window.__arborConfirmedDateClock;
  return evidence;
}
