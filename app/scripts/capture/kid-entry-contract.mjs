/** Additive, synthetic-only entry verification. No app/browser/network imports. */
export const KID_ENTRY_STATES = Object.freeze([
  'hero-first', 'creator-open', 'creator-cancel', 'step-cancel',
  'same-session-entry', 'lock-escape', 'lock-reload', 'gate-hold', 'gate-wrong',
  'gate-dismiss', 'gate-return', 'same-session-reload-entry',
  'sibling-hero-first', 'sibling-sprout-entry', 'sibling-parent-return',
  'under-three-child-switch', 'child-aba-return', 'current-child-entry',
].map(state => ({ route: 'shell', state })));
export const KID_ENTRY_LIMITATIONS = Object.freeze([
  { state: 'pending-step-child-change', status: 'offline-hook-evidence-only', reason: 'The real hero and creator modals block ordinary child-switch controls. Browser states dismiss first, then use the real switcher, including A-to-B-to-A. No forced clicks, React internals, synthetic app callbacks or claim of pending-modal switch coverage.' },
  { state: 'deferred-hero-save', status: 'offline-hook-evidence-only', reason: 'No image is generated or accepted. The real creator is opened and cancelled only. Delayed successful/failed persistence, obsolete callbacks and lock-transition retirement retain the reviewed actual-hook evidence, not a fabricated browser save.' },
  { state: 'parent-gate', status: 'synthetic-no-pin-only', reason: 'Real hold, wrong-answer, Escape, dismiss and visible arithmetic-answer controls run on invented local profiles with no PIN. No PIN setup, real credential, account, native Back, auth transition or production security claim.' },
  { state: 'media-warmup', status: 'synthetic-refusal', reason: 'Automatic book-narration POSTs for exactly the three invented child IDs receive a labeled local 409 refusal at the API boundary. No successful generation response, model, remote write or media completion is fabricated; all other non-read POSTs are denied.' },
]);

export function kidEntryFixture(bundle, lang) {
  const parsed = JSON.parse(typeof bundle === 'string' ? bundle : JSON.stringify(bundle));
  const body = parsed?.locales?.[lang] ?? parsed;
  if (!['en', 'he'].includes(lang) || parsed?.parent?.demo !== true || body?.child?.demo !== true || !body.collections || !Array.isArray(body.collections.milestones)) throw new Error('SYNTHETIC_KID_ENTRY_FIXTURE_REQUIRED');
  const he = lang === 'he';
  const profile = (id, name, age) => {
    const child = { ...body.child, id, name, age, demo: true };
    for (const key of ['birthDate', 'ageMonths', 'ageMonthsAsOf', 'preterm', 'photoUrl', 'avatar']) delete child[key];
    return child;
  };
  const child = profile('capture-kid-entry-a', he ? 'נועה' : 'Noa', 4);
  const sibling = profile('capture-kid-entry-b', he ? 'מירה' : 'Mira', 3);
  const younger = profile('capture-kid-entry-under-three', he ? 'טל' : 'Tal', 2);
  const collections = Object.fromEntries(Object.keys(body.collections).map(key => [key, []]));
  body.child = child; body.collections = collections;
  body.siblings = [sibling, younger].map(child => ({ child, collections: structuredClone(collections) }));
  return { parsed, child, sibling, younger, childId: child.id, collectionNames: Object.keys(collections), childIds: [child.id, sibling.id, younger.id] };
}

/** Refuse automatic media at a precise local API boundary; never fake success. */
export function kidEntryApiDisposition(method, pathname, childIds) {
  if (method === 'POST' && childIds.some(id => pathname === `/api/children/${encodeURIComponent(id)}/book-narration`)) return 'synthetic-narration-refusal';
  if (method !== 'GET' && !(method === 'POST' && ['/api/todays-focus', '/api/digest'].includes(pathname))) return 'deny';
  return 'read';
}

/** Only passive geometry, destination, focus and persistence facts. */
export function observeKidEntry({ selector, contentSelector = null, childId, outgoing = null, waitUntilReady = false }) {
  const nodes = [...document.querySelectorAll(selector)];
  const visible = node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && !node.closest('[hidden], [inert]') && getComputedStyle(node).visibility !== 'hidden';
  };
  // SurfaceFrame is display:contents: preserve its route identity, but take
  // layout/content evidence from a concrete descendant. For Kid Mode the
  // chosen home header includes its animated view wrapper in this chain.
  const contents = contentSelector ? nodes.flatMap(node => [...node.querySelectorAll(contentSelector)]) : nodes;
  const target = contents.find(visible);
  const bounds = node => { const box = node?.getBoundingClientRect(); return box ? { width: box.width, height: box.height } : null; };
  const ancestors = [];
  for (let node = target; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    ancestors.push({ opacity: Number(style.opacity), transform: style.transform, display: style.display, visibility: style.visibility });
  }
  const active = document.activeElement;
  const state = JSON.parse(localStorage.getItem('arbor.kidmode.active') ?? '{"open":false}');
  const offered = JSON.parse(sessionStorage.getItem('arbor.kidmode.heroStepOffered') ?? '[]');
  const main = document.querySelector('#main');
  const overlay = document.querySelector('[data-kid-mode-layer][role="dialog"]');
  const childIdentities = [...document.querySelectorAll('[data-child-identity]')].filter(visible).map(node => node.getAttribute('data-child-identity'));
  const frame = { sampledAtMs: performance.now(), documentReadyState: document.readyState, childIdentities, outgoingRetired: !outgoing || !outgoing.isConnected, selector, contentSelector, count: nodes.length, contentCount: contents.length, rootBounds: bounds(nodes[0]), contentBounds: bounds(target), contentConnected: !!target?.isConnected, visibleCount: contents.filter(visible).length, text: target?.textContent?.trim() ?? '',
    activeChildId: localStorage.getItem('arbor.activeChildId'), hash: location.hash, state, offered,
    mainInert: !!main?.closest('[inert]'), parentAriaHidden: !!main?.closest('[aria-hidden="true"]'), parentShieldOwner: main?.closest('[inert]')?.classList?.contains('page-shell') ? 'page-shell' : main?.closest('[inert]') ? 'other-ancestor' : 'none', overlayCount: document.querySelectorAll('[data-kid-mode-layer][role="dialog"]').length,
    focus: { tag: active?.tagName ?? null, connected: !!active?.isConnected, insideTarget: !!target?.contains(active), insideKidOverlay: !!overlay?.contains(active), insideInert: !!active?.closest('[inert]') },
    heroStepCount: document.querySelectorAll('[data-testid="hero-step-continue"]').length,
    creatorCount: document.querySelectorAll('[data-testid="avatar-character-princess"]').length,
    challengeCount: document.querySelectorAll('#parent-challenge-title').length,
    viewportWidth: innerWidth, pageWidth: document.documentElement.scrollWidth, ancestors };
  frame.ready = frame.outgoingRetired && frame.activeChildId === childId && frame.count === 1 && frame.contentCount === 1 && frame.contentConnected && frame.visibleCount === 1 && frame.text.length > 0
    && frame.pageWidth <= frame.viewportWidth + 1 && ancestors.length > 0 && ancestors.every(style => style.opacity >= 0.999
      && ['none', 'matrix(1, 0, 0, 1, 0, 0)', 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'].includes(style.transform)
      && style.display !== 'none' && style.visibility !== 'hidden');
  return waitUntilReady && !frame.ready ? false : frame;
}

const common = ['ACTUAL_SETTLED_DESTINATION_BODY', 'PROFILE_IDENTITY_AGE_HERO_AND_OTHER_FIELDS_UNCHANGED', 'VISIT_STAMP_TRANSITIONS_ACCOUNTED', 'CHILD_COLLECTIONS_UNCHANGED', 'NO_GENERATION_OR_MUTATION_DISPATCH', 'SYNTHETIC_ONLINE', 'NO_PROHIBITED_ACTIONS'];
const entered = ['ACTUAL_HOME_GREETING_NAMES_CURRENT_CHILD', 'EXACT_CURRENT_CHILD_HOME_AND_PARENT_SHIELD', 'NO_RETIRED_STEP_OR_CREATOR', 'KEYBOARD_FOCUS_INSIDE_KID_OVERLAY'];
const parent = ['PARENT_BODY_UNLOCKED_WITHOUT_RETIRED_MODAL', 'PARENT_HEADING_NAMES_CURRENT_CHILD'];
const switched = ['ACTUAL_VISIBLE_CHILD_IDENTITY', 'ACTUAL_KEYBOARD_CHILD_PICKER_OPEN'];
export const KID_ENTRY_REQUIRED_ASSERTIONS = Object.freeze({
  'hero-first': [...parent, 'CURRENT_CHILD_HERO_FIRST_BEFORE_ENTRY', 'FOCUS_TRAPPED_IN_PARENT_HERO_MODAL'],
  'creator-open': ['ACTUAL_DESCRIPTOR_CREATOR_WITHOUT_GENERATION'],
  'creator-cancel': ['CREATOR_REMOVED_PARENT_STEP_RESTORED'],
  'step-cancel': [...parent, 'CANCEL_REMOVES_CURRENT_STEP_AND_RESTORES_DOOR_FOCUS'],
  'same-session-entry': [...entered, 'CANCELLED_OFFER_NOT_REPEATED_THIS_SESSION'],
  'lock-escape': entered,
  'lock-reload': [...entered, 'REAL_RELOAD_RETAINS_EXISTING_OPEN_LOCK'],
  'gate-hold': ['REAL_HOLD_OPENS_CHALLENGE_WITHOUT_UNLOCK', 'CHALLENGE_INPUT_HAS_FOCUS', 'ESCAPE_CANNOT_DISMISS_OR_UNLOCK_CHALLENGE'],
  'gate-wrong': ['WRONG_ANSWER_REMAINS_LOCKED_WITH_FOCUSED_RETRY'],
  'gate-dismiss': entered,
  'gate-return': [...parent, 'REAL_HOLD_OPENS_CHALLENGE_WITHOUT_UNLOCK', 'CHALLENGE_INPUT_HAS_FOCUS', 'PARENT_KEYBOARD_FOCUS_REACHABLE_AFTER_GATE'],
  'same-session-reload-entry': [...parent, ...entered],
  'sibling-hero-first': [...parent, ...switched, 'FRESH_ELIGIBLE_SIBLING_GETS_OWN_OFFER'],
  'sibling-sprout-entry': entered,
  'sibling-parent-return': [...parent, ...switched, 'PARENT_KEYBOARD_FOCUS_REACHABLE_AFTER_GATE'],
  'under-three-child-switch': [...parent, ...switched, 'UNDER_THREE_HAS_NO_ENTRY_DOOR_OR_OLD_MODAL', 'INELIGIBLE_CHILD_NOT_MARKED_OFFERED'],
  'child-aba-return': [...parent, ...switched, 'SAME_PERSISTENT_DOOR_AFTER_ELIGIBLE_A_B_A', 'A_UNDER_THREE_A_DOES_NOT_REVIVE_CANCELLED_STEP'],
  'current-child-entry': entered,
});
export function kidEntryRequiredAssertions(state) {
  return Object.hasOwn(KID_ENTRY_REQUIRED_ASSERTIONS, state) ? [...common, ...KID_ENTRY_REQUIRED_ASSERTIONS[state]] : [];
}
export function validKidEntryCell(cell) {
  const ids = kidEntryRequiredAssertions(cell?.state);
  return ids.length > 0 && ids.every(id => cell.assertions?.some(assertion => assertion.id === id && assertion.passed === true))
    && cell.frames?.length > 0 && cell.frames.every(frame => frame.ready === true)
    && cell.networkEvidence?.kidEntryDeniedMutations === 0;
}

/** Passive, bounded hit/focus facts; no text, profile or DOM mutation. */
export function observeKidEntryPicker(picker) {
  const bounds = node => { if (!node) return null; const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; };
  const skip = document.querySelector('[data-testid="skip-to-content"]');
  const box = bounds(picker);
  const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  const visible = node => { const rect = bounds(node); const style = getComputedStyle(node); return rect.width > 0 && rect.height > 0 && !node.closest('[hidden], [inert]') && style.display !== 'none' && style.visibility !== 'hidden'; };
  return { picker: box, skipLink: bounds(skip), skipLinkFocused: document.activeElement === skip,
    pickerFocused: document.activeElement === picker, pickerInert: !!picker.closest('[inert]'), focusedTag: document.activeElement?.tagName ?? null,
    centerHitOwner: !hit ? 'none' : picker === hit || picker.contains(hit) ? 'picker' : skip && (skip === hit || skip.contains(hit)) ? 'skip-link' : 'other',
    expanded: picker.getAttribute('aria-expanded') === 'true', visibleListboxCount: [...document.querySelectorAll('[role="listbox"]')].filter(visible).length };
}


/** Raw storage omits null worldId; parseKidModeState maps absence back to null. */
export function kidEntryHomeFacts(frame) {
  return { open: frame.state?.open === true, home: frame.state?.view === 'home',
    noWorld: !!frame.state && (!Object.hasOwn(frame.state, 'worldId') || frame.state.worldId === null),
    oneOverlay: frame.overlayCount === 1, parentInert: frame.mainInert === true, parentRoute: frame.hash === '#/overview' };
}

/** Compare every synthetic profile field. Only the source-defined useLastVisit
 * transition may differ, and only for actually selected fixture identities.
 * Receipts retain bounded field names + valid visit timestamps, never profiles. */
export function compareKidEntryProfiles({ previous, current, allowedChildIds, visitedChildIds, earliestStampMs, observedAtMs }) {
  const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  const expectedIds = JSON.stringify(allowedChildIds);
  const ids = profiles => Array.isArray(profiles) ? JSON.stringify(profiles.map(profile => profile?.id)) : null;
  const identitiesMatch = ids(previous) === expectedIds && ids(current) === expectedIds;
  const changes = [];
  let fieldsUnchanged = identitiesMatch, visitTransitionsValid = identitiesMatch;
  if (identitiesMatch) for (let index = 0; index < previous.length; index++) {
    const before = previous[index], after = current[index], childId = allowedChildIds[index];
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => stable(before[key]) !== stable(after[key]));
    const visitFields = fields.filter(key => key === 'lastVisitAt' || key === 'lastVisitPreviousAt');
    if (fields.some(key => !visitFields.includes(key))) fieldsUnchanged = false;
    let expectedTransition = 'unchanged', valid = true;
    if (visitFields.length) {
      const oldMs = typeof before.lastVisitAt === 'string' ? Date.parse(before.lastVisitAt) : NaN;
      const nextMs = typeof after.lastVisitAt === 'string' ? Date.parse(after.lastVisitAt) : NaN;
      const gap = nextMs - oldMs;
      expectedTransition = !Number.isFinite(oldMs) ? 'first-visit' : gap >= 30 * 60_000 ? 'rotate-visit' : 'bump-visit';
      const expectedPrevious = expectedTransition === 'rotate-visit' ? before.lastVisitAt : before.lastVisitPreviousAt;
      valid = visitedChildIds.includes(childId) && fields.includes('lastVisitAt') && Number.isFinite(nextMs)
        && after.lastVisitAt === new Date(nextMs).toISOString() && nextMs >= earliestStampMs && nextMs <= observedAtMs
        && (!Number.isFinite(oldMs) || gap >= 60_000)
        && stable(after.lastVisitPreviousAt) === stable(expectedPrevious);
      if (!valid) visitTransitionsValid = false;
    }
    const stamp = value => value === undefined ? null : typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : '[invalid-stamp]';
    if (fields.length) changes.push({ childId, fields: fields.slice(0, 40), totalFields: fields.length, expectedTransition,
      visitTransitionValid: valid, ...(visitFields.length ? { before: { lastVisitAt: stamp(before.lastVisitAt), lastVisitPreviousAt: stamp(before.lastVisitPreviousAt) },
        after: { lastVisitAt: stamp(after.lastVisitAt), lastVisitPreviousAt: stamp(after.lastVisitPreviousAt) } } : {}) });
  }
  return { earliestStampMs, observedAtMs, visitedChildIds: visitedChildIds.filter(id => allowedChildIds.includes(id)), identitiesMatch, fieldsUnchanged, visitTransitionsValid, changes, passed: identitiesMatch && fieldsUnchanged && visitTransitionsValid };
}
