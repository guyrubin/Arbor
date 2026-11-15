/* Arbor living landing: scroll drives the sculpture, the chosen moment drives
   the copy. Every example is illustrative; nothing typed or chosen here is
   stored or sent. Only the situation id travels to the trial link. */
import { mountLivingForms } from './arbor-living-scene-v1.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === 'off';
if (reduced) document.documentElement.classList.add('still');
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

const MOMENTS = {
  bedtime: {
    said: '“One more story. One more hug. Bedtime keeps getting later.”',
    title: 'Let them choose the last chapter.',
    action: 'Before you begin, agree on two familiar steps: a story, then a goodnight hug. Let your child choose the story.',
    words: '“Which story shall we read before our goodnight hug?”',
    notices: [['Connection first', 'One more hug may be a way of asking for closeness before the day ends.'], ['Independence', 'A choice inside the routine gives them a part of bedtime to own.'], ['Stage fit', 'Two steps they can picture are easier to follow than “it’s late”.']],
    story: 'The Lantern Path', theme: 'An original Arbor story about naming fear and choosing trusted company.', question: '“Who helps you feel steady?”',
    obs: '“Chose the story and asked for a goodnight hug.”',
    sum: ['Chose a story before the goodnight hug.', 'A story, then a familiar goodnight.', 'How can we make this routine easier?'],
  },
  feelings: {
    said: '“The tower fell down. Now nothing feels okay.”',
    title: 'Make room for the feeling first.',
    action: 'Stay nearby if your child wants you there. Acknowledge what happened without rushing to fix it. When they are ready, offer a choice: rebuild or take a break.',
    words: '“You worked on that tower and it fell. I’m here. Shall we rebuild or take a break?”',
    notices: [['Connection first', 'The upset may need company before it needs a solution.'], ['Next small challenge', 'Rebuilding one piece together may be within reach when the whole tower is not.'], ['Good enough', 'You do not have to fix it. Staying near is already a response.']],
    story: 'The Little Bridge Builders', theme: 'An original Arbor story about rebuilding one useful piece at a time.', question: '“What helped when the job felt too big?”',
    obs: '“Asked to rebuild together after the tower fell.”',
    sum: ['Asked to rebuild together after the tower fell.', 'Stayed near, then offered a choice.', 'What helps when frustration builds?'],
  },
  play: {
    said: '“We have a few minutes together. What can we do without another screen?”',
    title: 'Let them lead a little adventure.',
    action: 'Choose three safe, age-appropriate objects. Invite your child to invent a story with them, then ask them to give you a part to play.',
    words: '“Where are we going on our adventure? Who shall I be?”',
    notices: [['Independence', 'Leading the game lets them practise deciding.'], ['Stage fit', 'Real objects in their hands invite the kind of pretend play that suits their age.'], ['Their wider world', 'A few unhurried minutes fit into the day you already have.']],
    story: 'The Cloud Orchestra', theme: 'An original Arbor story about listening, taking turns and making room for each voice.', question: '“What happened when everyone played at once?”',
    obs: '“Invented a rhythm and invited us to take turns.”',
    sum: ['Invented a rhythm and invited us to take turns.', 'Three objects and a story they led.', 'How can we build on what they enjoy?'],
  },
};

const canvas = $('#forms');
const forms = mountLivingForms(canvas, { reduced });
if (!forms) document.documentElement.classList.add('no-webgl');

/* ---- the chosen moment ---- */
const sheet = $('#sheet'), keep = $('#keep'), keepStatus = $('#keep-status');
let current = 'bedtime';
const renderSheet = () => {
  const picked = $$('[data-sum]').filter(i => i.checked).map(i => MOMENTS[current].sum[+i.dataset.sum]);
  sheet.replaceChildren(...(picked.length ? picked : ['Nothing selected. Nothing would be shared.']).map(text => {
    const li = document.createElement('li'); li.textContent = text; if (!picked.length) li.className = 'empty'; return li;
  }));
};
const setKept = on => {
  keep.setAttribute('aria-pressed', String(on));
  keep.textContent = on ? 'Kept, with your approval' : 'Keep this';
  keepStatus.textContent = on ? 'One observation kept. You can remove it at any time.' : 'Try it. Nothing here is saved.';
  forms?.setKept(on);
};
const choose = (key, animate = true) => {
  const m = MOMENTS[key]; if (!m) return;
  current = key;
  const flat = { ...m, n0t: m.notices[0][0], n0: m.notices[0][1], n1t: m.notices[1][0], n1: m.notices[1][1], n2t: m.notices[2][0], n2: m.notices[2][1], s0: m.sum[0], s1: m.sum[1], s2: m.sum[2] };
  $$('[data-copy]').forEach(node => {
    node.textContent = flat[node.dataset.copy];
    if (animate && !reduced) { node.classList.remove('swap'); void node.offsetWidth; node.classList.add('swap'); }
  });
  $$('[data-moment]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.moment === key)));
  $$('a[href*="entry=landing"]').forEach(a => { const u = new URL(a.href, location.origin); u.searchParams.set('moment', key); a.href = u.pathname + u.search; });
  setKept(false); renderSheet();
};
$$('[data-moment]').forEach(b => b.addEventListener('click', () => choose(b.dataset.moment)));
$$('[data-sum]').forEach(i => i.addEventListener('change', renderSheet));
keep.addEventListener('click', () => setKept(keep.getAttribute('aria-pressed') !== 'true'));

/* campaign attribution: reuse the live page's rule, then stamp the moment */
import('./arbor-conversion-v12.js').then(({ trialHref }) => {
  $$('a[href*="entry=landing"]').forEach(a => { a.href = trialHref(a.getAttribute('href'), location.search, 'en'); });
}).catch(() => {}).finally(() => choose(new URLSearchParams(location.search).get('moment') in MOMENTS ? new URLSearchParams(location.search).get('moment') : 'bedtime', false));

/* ---- perspectives ---- */
$$('[data-lens]').forEach(b => {
  const n = +b.dataset.lens;
  if (forms) b.style.setProperty('--c', forms.lensColors[n]);
  const on = () => forms?.setLens(n), off = () => forms?.setLens(-1);
  b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', off); b.addEventListener('focus', on); b.addEventListener('blur', off);
});

/* ---- scroll: scene progress, growth rings, header tone, deck ---- */
const scenes = $$('[data-scene]'), header = $('.top'), growth = $('#growth'), ringRows = $$('.rings li'), deck = $('.deck');
let ticking = false;
const measure = () => {
  ticking = false;
  const vh = innerHeight, mid = vh / 2;
  const centers = scenes.map(s => { const r = s.getBoundingClientRect(); return s === growth ? Math.min(Math.max(r.top + vh / 2, mid), r.bottom - vh / 2) : r.top + r.height / 2; });
  let p = 0;
  if (mid <= centers[0]) p = 0; else if (mid >= centers.at(-1)) p = scenes.length - 1;
  else for (let i = 0; i < centers.length - 1; i++) if (mid >= centers[i] && mid < centers[i + 1]) { p = i + (mid - centers[i]) / (centers[i + 1] - centers[i]); break; }
  const g = growth.getBoundingClientRect(), local = Math.min(1, Math.max(0, -g.top / Math.max(1, g.height - vh)));
  forms?.setProgress(p, local);
  const lit = innerWidth <= 860 ? ringRows.length : 1 + Math.floor(local * 3.999);
  ringRows.forEach((li, i) => li.classList.toggle('on', i < lit));
  const under = scenes.find(s => { const r = s.getBoundingClientRect(); return r.top <= 40 && r.bottom > 40; });
  if (under) {
    const top = under.getBoundingClientRect().top;
    const night = under.classList.contains('dawn') ? top > -innerHeight * 0.36 : under.classList.contains('dusk') ? top < -innerHeight * 0.12 : under.classList.contains('night');
    header.dataset.tone = night ? 'night' : 'day';
  }
  header.classList.toggle('scrolled', scrollY > 30);
  if (deck) { const r = deck.getBoundingClientRect(); deck.style.setProperty('--open', Math.min(1, Math.max(0.15, 1.5 - Math.abs(r.top + r.height / 2 - mid) / (vh * 0.6))).toFixed(3)); }
};
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } };
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); measure();

if (deck && !reduced && matchMedia('(hover: hover)').matches) {
  deck.addEventListener('pointermove', e => { const r = deck.getBoundingClientRect(); deck.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * 16 + 'deg'); deck.style.setProperty('--rx', (0.5 - (e.clientY - r.top) / r.height) * 10 + 'deg'); });
  deck.addEventListener('pointerleave', () => { deck.style.setProperty('--ry', '0deg'); deck.style.setProperty('--rx', '0deg'); });
}

/* ---- reveals: only elements still below the fold are opted in ---- */
if (!reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal]').forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight * 0.9) return;
    [...el.children].forEach((c, i) => c.style.setProperty('--i', i));
    el.classList.add('pre'); io.observe(el);
  });
}
