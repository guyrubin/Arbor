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
  const frame = { childIdentities, outgoingRetired: !outgoing || !outgoing.isConnected, selector, contentSelector, count: nodes.length, contentCount: contents.length, rootBounds: bounds(nodes[0]), contentBounds: bounds(target), contentConnected: !!target?.isConnected, visibleCount: contents.filter(visible).length, text: target?.textContent?.trim() ?? '',
    activeChildId: localStorage.getItem('arbor.activeChildId'), hash: location.hash, state, offered,
    mainInert: !!main?.closest('[inert]'), overlayCount: document.querySelectorAll('[data-kid-mode-layer][role="dialog"]').length,
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

const common = ['ACTUAL_SETTLED_DESTINATION_BODY', 'INVENTED_PROFILES_UNCHANGED', 'CHILD_COLLECTIONS_UNCHANGED', 'NO_GENERATION_OR_MUTATION_DISPATCH', 'SYNTHETIC_ONLINE', 'NO_PROHIBITED_ACTIONS'];
const entered = ['ACTUAL_HOME_GREETING_NAMES_CURRENT_CHILD', 'EXACT_CURRENT_CHILD_HOME_AND_PARENT_SHIELD', 'NO_RETIRED_STEP_OR_CREATOR', 'KEYBOARD_FOCUS_INSIDE_KID_OVERLAY'];
const parent = ['PARENT_BODY_UNLOCKED_WITHOUT_RETIRED_MODAL', 'PARENT_HEADING_NAMES_CURRENT_CHILD'];
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
  'sibling-hero-first': [...parent, 'ACTUAL_VISIBLE_CHILD_IDENTITY', 'FRESH_ELIGIBLE_SIBLING_GETS_OWN_OFFER'],
  'sibling-sprout-entry': entered,
  'sibling-parent-return': [...parent, 'ACTUAL_VISIBLE_CHILD_IDENTITY', 'PARENT_KEYBOARD_FOCUS_REACHABLE_AFTER_GATE'],
  'under-three-child-switch': [...parent, 'ACTUAL_VISIBLE_CHILD_IDENTITY', 'UNDER_THREE_HAS_NO_ENTRY_DOOR_OR_OLD_MODAL', 'INELIGIBLE_CHILD_NOT_MARKED_OFFERED'],
  'child-aba-return': [...parent, 'ACTUAL_VISIBLE_CHILD_IDENTITY', 'SAME_PERSISTENT_DOOR_AFTER_ELIGIBLE_A_B_A', 'A_UNDER_THREE_A_DOES_NOT_REVIVE_CANCELLED_STEP'],
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
