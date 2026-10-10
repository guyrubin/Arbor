/** Bounded, passive evidence for a failed real control attempt. No user text,
 * request bodies, credentials, storage values or application callbacks. */
export const SINGLE_GOAL_STEP_CODES = Object.freeze([
  'action', 'load-route', 'fonts', 'settled-frame', 'storage-read', 'close-click',
  'escape-key', 'dialog-detached', 'opener-focus', 'open-focus', 'open-enter',
  'choice-click', 'cancel-click', 'confirmation-detached', 'earlier-click',
  'save-click', 'stored-selection', 'child-picker-focus', 'child-picker-enter',
  'child-picker-option', 'child-identity', 'back', 'forward', 'reload', 'keyboard',
]);
export function singleGoalFailureCode(error) {
  const text = typeof error?.message === 'string' ? error.message : '';
  if (/strict mode violation/i.test(text)) return 'LOCATOR_NOT_UNIQUE';
  if (/intercepts pointer events/i.test(text)) return 'POINTER_INTERCEPTED';
  if (/not enabled|element is disabled/i.test(text)) return 'CONTROL_DISABLED';
  if (/not stable/i.test(text)) return 'CONTROL_UNSTABLE';
  if (/not visible/i.test(text)) return 'CONTROL_NOT_VISIBLE';
  if (/not attached|detached/i.test(text)) return 'CONTROL_DETACHED';
  if (/Execution context was destroyed|Target.*closed/i.test(text)) return 'CONTEXT_RETIRED';
  if (/GOAL_SAVE_HISTORY_MISMATCH/.test(text)) return 'GOAL_SAVE_HISTORY_MISMATCH';
  if (/SINGLE_GOAL_/.test(text)) return 'STATE_PRECONDITION_FAILED';
  if (error?.name === 'TypeError' || /\bTypeError:/.test(text)) return 'TYPE_ERROR';
  return error?.name === 'TimeoutError' ? 'WAIT_TIMED_OUT' : 'INTERACTION_ERROR';
}
export function observeSingleGoalControls({ childIds = [], targetSelector = null } = {}) {
  const kind = node => {
    if (!node) return 'none';
    const id = node.getAttribute?.('data-testid') ?? '';
    return /^(goal-(current|confirm|save|cancel|earlier)|(?:profile|portrait|daily-play)-goals-edit)$/.test(id) ? id
      : /^goal-(choice|earlier)-/.test(id) ? 'goal-option' : ['BUTTON', 'SUMMARY', 'BODY', 'DIV'].includes(node.tagName) ? node.tagName : 'other';
  };
  const describe = node => {
    const box = node.getBoundingClientRect(), style = getComputedStyle(node);
    const x = Math.max(0, Math.min(innerWidth - 1, box.x + box.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, box.y + box.height / 2));
    const hit = document.elementFromPoint(x, y);
    return { kind: kind(node), connected: node.isConnected, width: box.width, height: box.height,
      inViewport: box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight,
      inert: !!node.closest('[inert]'), ariaHidden: !!node.closest('[aria-hidden="true"]'), hidden: !!node.closest('[hidden]'),
      disabled: node.matches(':disabled'), opacity: Number(style.opacity), transform: style.transform,
      display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents,
      focused: document.activeElement === node, centerHit: hit === node || node.contains(hit), hitKind: kind(hit) };
  };
  const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
  const targets = targetSelector ? [...document.querySelectorAll(targetSelector)] : [];
  let storedChild = null, storedGoalCount = null, storageReadable = false;
  try {
    const id = localStorage.getItem('arbor.activeChildId');
    storedChild = childIds.indexOf(id);
    const profiles = JSON.parse(localStorage.getItem('arbor.children') ?? 'null');
    const profile = Array.isArray(profiles) && profiles.find(item => item.id === id);
    storedGoalCount = Array.isArray(profile?.activeGoals) ? profile.activeGoals.length : null;
    storageReadable = true;
  } catch { /* receipt records unavailable storage, never raw errors/values */ }
  return { visibility: document.visibilityState, readyState: document.readyState,
    route: ['#/profile', '#/development', '#/daily-play', '#/plans'].includes(location.hash) ? location.hash : 'other',
    dialogCount: dialogs.length, dialogs: dialogs.slice(0, 3).map(describe),
    targetCount: targets.length, targets: targets.slice(0, 4).map(describe), focusKind: kind(document.activeElement),
    focusInert: !!document.activeElement?.closest('[inert]'), storageReadable, storedChild, storedGoalCount,
    mainInert: !!document.querySelector('#main')?.closest('[inert]'),
    confirmationCount: document.querySelectorAll('[data-testid="goal-confirm"]').length,
    choiceCount: document.querySelectorAll('[data-testid^="goal-choice-"]').length,
    earlierOpen: document.querySelector('[data-testid="goal-earlier"]')?.open ?? null };
}
