/* Arbor living landing, version 2. The chosen moment drives the example
   answer, the approach picker and the summary; the capability list drives
   the app screens; the stage on screen drives the sculpture. Every example
   is illustrative: nothing chosen here is stored or sent. Only the
   situation id travels to the trial link, and only after a real pick.
   The sculpture loads last and on its own, so the page works without it. */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === 'off';
if (reduced) document.documentElement.classList.add('still');
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* notices: [approach index, what it notices]. The index matches the seven
   approach buttons and the seven pebbles in the sculpture. */
const MOMENTS = {
  bedtime: {
    label: 'bedtime',
    said: 'One more story. One more hug. Bedtime keeps getting later.',
    title: 'Let them choose the last chapter.',
    action: 'Before you begin, agree on two familiar steps: a story, then a goodnight hug. Let your child choose the story.',
    words: '“Which story shall we read before our goodnight hug?”',
    notices: [[0, 'One more hug may be a way of asking for closeness before the day ends.'], [2, 'A choice inside the routine gives them a part of bedtime to own.'], [3, 'Two steps they can picture are easier to follow than “it’s late”.']],
    sum: ['Chose a story before the goodnight hug.', 'A story, then a familiar goodnight.', 'How can we make this routine easier?'],
  },
  feelings: {
    label: 'big feelings',
    said: 'The tower fell down. Now nothing feels okay.',
    title: 'Make room for the feeling first.',
    action: 'Stay nearby if your child wants you there. Acknowledge what happened without rushing to fix it. When they are ready, offer a choice: rebuild or take a break.',
    words: '“You worked on that tower and it fell. I’m here. Shall we rebuild or take a break?”',
    notices: [[0, 'The upset may need company before it needs a solution.'], [1, 'Rebuilding one piece together may be within reach when the whole tower is not.'], [5, 'You do not have to fix it. Staying near is already a response.']],
    sum: ['Asked to rebuild together after the tower fell.', 'Stayed near, then offered a choice.', 'What helps when frustration builds?'],
  },
  play: {
    label: 'time together',
    said: 'We have a few minutes together. What can we do without another screen?',
    title: 'Let them lead a little adventure.',
    action: 'Choose three safe, age-appropriate objects. Invite your child to invent a story with them, then ask them to give you a part to play.',
    words: '“Where are we going on our adventure? Who shall I be?”',
    notices: [[2, 'Leading the game lets them practise deciding.'], [3, 'Real objects in their hands invite the kind of pretend play that suits their age.'], [4, 'A few unhurried minutes fit into the day you already have.']],
    sum: ['Invented a story and gave us each a part.', 'Three objects and a story they led.', 'How can we build on what they enjoy?'],
  },
};

/* ---- the sculpture and its stages (mounted at the end of this file) ---- */
let forms = null;
const stages = $$('[data-stage]').map(el => ({ el, anchor: $('.form-anchor', el) || el, n: +el.dataset.stage }));

/* ---- approaches ---- */
const lensButtons = $$('[data-lens]');
const LENSES = lensButtons.map(b => ({ name: b.textContent.trim(), what: b.parentElement.querySelector('.lens-what').textContent, color: getComputedStyle(b).getPropertyValue('--c').trim() }));
const lensName = $('#lens-name'), lensWhat = $('#lens-what'), lensEg = $('#lens-eg');
let current = 'bedtime', lens = 0;
const swap = node => { if (reduced) return; node.classList.remove('swap'); void node.offsetWidth; node.classList.add('swap'); };
const showLens = (n, animate = true) => {
  lens = n;
  const used = MOMENTS[current].notices.find(([i]) => i === n);
  lensButtons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.lens === n)));
  lensName.textContent = LENSES[n].name; lensName.style.color = LENSES[n].color;
  lensWhat.textContent = LENSES[n].what;
  lensEg.hidden = !used;
  if (used) { lensEg.firstElementChild.textContent = `In the ${MOMENTS[current].label} example`; lensEg.lastElementChild.textContent = used[1]; }
  if (animate) [lensName, lensWhat, lensEg].forEach(swap);
  forms?.setLens(n);
};
lensButtons.forEach(b => b.addEventListener('click', () => showLens(+b.dataset.lens)));

/* ---- the chosen moment ---- */
const said = $('#said'), reply = $('#reply'), sheet = $('#sheet');
let typing = 0;
const typeOut = text => {
  clearInterval(typing);
  if (reduced) { said.textContent = text; return; }
  let i = 0; said.textContent = ''; said.classList.add('typing');
  reply.classList.remove('build');
  typing = setInterval(() => {
    i += 2; said.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(typing); said.classList.remove('typing'); void reply.offsetWidth; reply.classList.add('build'); }
  }, 28);
};
const renderSheet = () => {
  const picked = $$('[data-sum]').filter(i => i.checked).map(i => MOMENTS[current].sum[+i.dataset.sum]);
  sheet.replaceChildren(...(picked.length ? picked : ['Nothing selected. Nothing would be shared.']).map(text => {
    const li = document.createElement('li'); li.textContent = text; if (!picked.length) li.className = 'empty'; return li;
  }));
};
/* the trial links carry a moment only when the parent picked one, here or on the page that sent them */
let picked = null;
const stamp = () => { if (picked) $$('a[href*="entry=landing"]').forEach(a => { const u = new URL(a.href, location.origin); u.searchParams.set('moment', picked); a.href = u.pathname + u.search; }); };
const choose = (key, animate = true) => {
  const m = MOMENTS[key]; if (!m) return;
  current = key;
  const flat = { title: m.title, action: m.action, words: m.words, s0: m.sum[0], s1: m.sum[1], s2: m.sum[2] };
  m.notices.forEach(([i, text], k) => { flat[`n${k}t`] = LENSES[i].name; flat[`n${k}`] = text; });
  $$('[data-copy]').forEach(node => { if (node.dataset.copy in flat) node.textContent = flat[node.dataset.copy]; });
  $$('[data-dot]').forEach(dot => dot.style.setProperty('--c', LENSES[m.notices[+dot.dataset.dot][0]].color));
  if (animate) typeOut(m.said); else said.textContent = m.said;
  $$('[data-moment]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.moment === key)));
  stamp();
  const used = m.notices.map(([i]) => i);
  lensButtons.forEach(b => b.parentElement.classList.toggle('used', used.includes(+b.dataset.lens)));
  forms?.setLit(used);
  showLens(used[0], animate);
  renderSheet();
};
$$('[data-moment]').forEach(b => b.addEventListener('click', () => { picked = b.dataset.moment; choose(picked); }));
$$('[data-sum]').forEach(i => i.addEventListener('change', renderSheet));

/* the page opens on the bedtime example; a moment in the address counts as a pick */
const asked = new URLSearchParams(location.search).get('moment');
if (asked && Object.hasOwn(MOMENTS, asked)) picked = asked;
choose(picked || 'bedtime', false);
/* campaign attribution: reuse the live page's rule, then put a pick made meanwhile back */
import('./arbor-conversion-v12.js').then(({ trialHref }) => {
  $$('a[href*="entry=landing"]').forEach(a => { a.href = trialHref(a.getAttribute('href'), location.search, 'en'); });
  stamp();
}).catch(() => {});

/* the example types itself out the first time it comes into view */
if (!reduced && 'IntersectionObserver' in window) {
  const once = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { once.disconnect(); typeOut(MOMENTS[current].said); } }, { threshold: 0.45 });
  once.observe($('#talk'));
}

/* ---- what is inside: list on wide screens, swipe row on narrow ones ---- */
const feats = $('#feats'), items = $$('.feat-item', feats), count = $('#feat-count');
const wide = matchMedia('(min-width: 1041px)');
const warm = li => { const img = li && $('img', li); if (img) img.loading = 'eager'; };
const showFeat = (li, byUser = false) => {
  items.forEach(x => { const on = x === li; x.classList.toggle('on', on); $('.feat', x).setAttribute('aria-pressed', String(on)); });
  warm(items[(items.indexOf(li) + 1) % items.length]);
  if (byUser) feats.classList.remove('auto');
};
items.forEach(li => $('.feat', li).addEventListener('click', () => { if (wide.matches) showFeat(li, true); }));
/* the list plays through once (it waits while hovered or focused), then rests on the first item */
feats.addEventListener('animationend', e => {
  if (e.animationName !== 'fill' || !wide.matches || !feats.classList.contains('auto')) return;
  const next = (items.findIndex(x => x.classList.contains('on')) + 1) % items.length;
  showFeat(items[next], next === 0);
});
/* in the swipe row every card is open, so its heading is not a control */
const lockList = () => items.forEach(li => { $('.feat', li).tabIndex = wide.matches ? 0 : -1; });
lockList(); wide.addEventListener('change', lockList);
if (reduced) feats.classList.remove('auto');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => entries.forEach(e => feats.classList.toggle('playing', e.isIntersecting)), { threshold: 0.3 }).observe(feats);
  const seen = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting && !wide.matches) count.textContent = `${items.indexOf(e.target) + 1} of ${items.length}`; }), { root: feats, threshold: 0.6 });
  items.forEach(li => seen.observe(li));
} else feats.classList.add('playing');

/* ---- scroll: which stage holds the sculpture, header tone, deck, phone bar ---- */
const header = $('.top'), bands = $$('[data-tone]').filter(el => el !== header), deck = $('.deck'), bar = $('#cta-bar'), hero = $('#top'), close = $('#start'), phone = $('#hero-phone');
let ticking = false;
const measure = () => {
  ticking = false;
  const vh = innerHeight, mid = vh / 2;
  let best = null, most = 0;
  stages.forEach(s => { const r = s.el.getBoundingClientRect(), seen = Math.min(r.bottom, vh) - Math.max(r.top, 0); if (seen > most) { most = seen; best = s; } });
  forms?.setStage(best ? best.anchor : null, best ? best.n : 0);
  const under = bands.find(s => { const r = s.getBoundingClientRect(); return r.top <= 36 && r.bottom > 36; });
  if (under) header.dataset.tone = under.dataset.tone;
  header.classList.toggle('scrolled', scrollY > 30);
  if (deck) { const r = deck.getBoundingClientRect(); deck.style.setProperty('--open', Math.min(1, Math.max(0.15, 1.5 - Math.abs(r.top + r.height / 2 - mid) / (vh * 0.6))).toFixed(3)); }
  bar.classList.toggle('show', hero.getBoundingClientRect().bottom < vh * 0.4 && close.getBoundingClientRect().top > vh * 0.8);
};
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } };
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); measure();

/* pointer tilt: the phone and the game cards lean a little toward the cursor */
if (!reduced && matchMedia('(hover: hover)').matches) {
  const tilt = (el, host, ry, rx) => {
    host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); el.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * ry + 'deg'); el.style.setProperty('--rx', (0.5 - (e.clientY - r.top) / r.height) * rx + 'deg'); });
    host.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
  };
  if (deck) tilt(deck, deck, 16, 10);
  if (phone) tilt(phone, hero, 12, 8);
}

/* ---- hero phone: three screens in turn, each with its two notes ---- */
const HERO = [
  ['Start from a moment like these', '24%', 'Type, talk or add a photo', '65%'],
  ['A moment you saved yesterday', '34%', 'Becomes tonight’s bedtime story', '56%'],
  ['Your week in counts, not scores', '22%', 'What happened, day by day', '57%'],
];
if (phone && !reduced && 'IntersectionObserver' in window) {
  const screens = $$('img', phone), a = $('#call-a'), b = $('#call-b');
  let at = 0, timer = 0, turns = 0, held = false;
  const stage = phone.parentElement;
  stage.addEventListener('pointerenter', () => { held = true; });
  stage.addEventListener('pointerleave', () => { held = false; });
  /* two rounds, waiting while the pointer rests on it, then it stays on the first screen */
  const turn = () => {
    if (held) return;
    at = (at + 1) % screens.length;
    if (++turns >= screens.length * 2) clearInterval(timer);
    screens.forEach((img, i) => { if (i === at) img.loading = 'eager'; img.classList.toggle('on', i === at); img.setAttribute('aria-hidden', String(i !== at)); });
    const [ta, ya, tb, yb] = HERO[at];
    a.lastElementChild.textContent = ta; a.style.top = ya; b.lastElementChild.textContent = tb; b.style.top = yb;
    swap(a.lastElementChild); swap(b.lastElementChild);
  };
  new IntersectionObserver(([e]) => { clearInterval(timer); if (e.isIntersecting && turns < screens.length * 2) timer = setInterval(turn, 5600); }, { threshold: 0.4 }).observe(phone);
}

/* ---- reveals: only blocks still below the fold are opted in ---- */
if (!reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  $$('.kids-facts, .games, .pen, .privacy, .plan-grid, .how, .steps').forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight * 0.9) return;
    [...el.children].forEach((c, i) => c.style.setProperty('--i', i));
    el.classList.add('pre'); io.observe(el);
  });
}

/* ---- the sculpture: loaded last, so a failed download leaves the page whole ---- */
import('./arbor-living-scene-v2.js').then(({ mountLivingForms }) => {
  forms = mountLivingForms($('#forms'), { reduced });
  if (!forms) return;
  forms.setLit(MOMENTS[current].notices.map(([i]) => i)); forms.setLens(lens); measure();
}).catch(() => {}).finally(() => document.documentElement.classList.add(forms ? 'webgl' : 'no-webgl'));
