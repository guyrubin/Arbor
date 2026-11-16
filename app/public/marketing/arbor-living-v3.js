/* Arbor living landing, version 3. Everything on the page is readable
   without this file; the script adds the film in the hero phone, the place
   tabs, the tryable answer, the Kids Studio stage and the sculpture.

   The film runs from one clock: render(t) draws any moment of it, so the
   same markup plays on the page, jumps when a chapter is chosen, shows its
   finished state under reduced motion, and can be recorded frame by frame
   (?film=1, see README). */
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const query = new URLSearchParams(location.search);
const filmOnly = html.classList.contains('filmonly');
const reduced = !filmOnly && (matchMedia('(prefers-reduced-motion: reduce)').matches || query.get('motion') === 'off');
if (reduced) html.classList.add('still');
const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = t => 1 - Math.pow(1 - clamp01(t), 4);

const HE = html.lang === 'he';
/* Words the script writes. The Hebrew page sets lang="he" and gets its own. */
const T = HE ? {
  again: 'לצפות שוב בסרטון', play: 'להפעיל את הסרטון', pause: 'לעצור את הסרטון', none: 'עדיין לא נבחר דבר.',
  inEg: l => `בדוגמה של ${l}`, council: n => `המועצה התייעצה · ${n} קולות`,
  status: (l, t, w) => `תשובה לדוגמה על ${l}. לנסות היום: ${t} אפשר להגיד: ${w}`,
  keep: 'ממשיכים להחזיק…', check: 'ואז שאלה למבוגרים: <b>כמה זה 27 ועוד 15?</b> או קוד אישי, אם הגדרתם.',
  retry: 'נסו: לחצו והחזיקו שלוש שניות.', soon: 'עזבתם מוקדם מדי. נגיעה מהירה של ילד לא פותחת את היציאה.',
} : {
  again: 'Play the film again', play: 'Play the film', pause: 'Pause the film', none: 'Nothing chosen yet.',
  inEg: l => `In the ${l} example`, council: n => `The council weighed in · ${n} voices`,
  status: (l, t, w) => `Example answer for ${l}. Try today: ${t} Say this: ${w}`,
  keep: 'Keep holding…', check: 'Then a grown-up check: <b>what is 27 + 15?</b> Or your own PIN, if you set one.',
  retry: 'Try it: press and hold for three seconds.', soon: 'Let go too soon. A child’s quick tap does not open it.',
};
const LENSES_HE = ['קודם כול הקשר', 'צעד אחר צעד', 'עצמאות', 'להסביר את הלמה', 'העולם שסביבם', 'מה שמציאותי בשבילכם', 'איפה הם צומחים'];
const LENSES = [
  ['Connection first', '#e8a18a'], ['Step by step', '#8670ce'], ['Independence', '#3fb7a4'], ['Explain the why', '#f3c969'],
  ['Their wider world', '#5d8df0'], ['Realistic for you', '#e58fb7'], ['Where they are growing', '#9ad7c4'],
];
/* Example answers. notices: [approach index, what it sees]; sum: the three lines of the example summary. */
const MOMENTS = {
  bedtime: { label: 'bedtime', said: 'One more story. One more hug. Bedtime keeps getting later.', title: 'Let them choose the last chapter.', action: 'Before you begin, agree on two familiar steps: a story, then a goodnight hug. Let your child choose the story.', words: '“Which story shall we read before our goodnight hug?”', notices: [[0, 'One more hug may be a way of asking for closeness before the day ends.'], [2, 'A choice inside the routine gives them a part of bedtime to own.'], [3, 'Two steps they can picture are easier to follow than “it’s late”.']], sum: ['Chose a story before the goodnight hug.', 'A story, then a familiar goodnight.', 'How can we make this routine easier?'] },
  feelings: { label: 'big feelings', said: 'The tower fell down. Now nothing feels okay.', title: 'Make room for the feeling first.', action: 'Stay nearby if your child wants you there. Acknowledge what happened without rushing to fix it. When they are ready, offer a choice: rebuild or take a break.', words: '“You worked on that tower and it fell. I’m here. Shall we rebuild or take a break?”', notices: [[0, 'The upset may need company before it needs a solution.'], [1, 'Rebuilding one piece together may be within reach when the whole tower is not.'], [5, 'You do not have to fix it. Staying near is already a response.']], sum: ['Asked to rebuild together after the tower fell.', 'Stayed near, then offered a choice.', 'What helps when frustration builds?'] },
  play: { label: 'time together', said: 'We have a few minutes together. What can we do without another screen?', title: 'Let them lead a little adventure.', action: 'Choose three safe, age-appropriate objects. Invite your child to invent a story with them, then ask them to give you a part to play.', words: '“Where are we going on our adventure? Who shall I be?”', notices: [[2, 'Leading the game lets them practise deciding.'], [3, 'Real objects in their hands invite the kind of pretend play that suits their age.'], [4, 'A few unhurried minutes fit into the day you already have.']], sum: ['Invented a story and gave us each a part.', 'Three objects and a story they led.', 'How can we build on what they enjoy?'] },
};
if (HE) {
  LENSES.forEach((l, k) => { l[0] = LENSES_HE[k]; });
  Object.assign(MOMENTS.bedtime, { label: 'שעת השינה', said: 'עוד סיפור. עוד חיבוק. ושעת השינה שוב מתאחרת.', title: 'תנו להם לבחור את הסיפור האחרון.', action: 'לפני שמתחילים, מסכמים על שני צעדים מוכרים: סיפור, ואז חיבוק לילה טוב. הילד בוחר איזה סיפור לקרוא.', words: '״איזה סיפור נקרא לפני חיבוק הלילה טוב שלנו?״', notices: [[0, 'עוד חיבוק יכול להיות דרך לבקש קרבה לפני שהיום נגמר.'], [2, 'בחירה בתוך השגרה נותנת להם חלק משעת השינה שהוא שלהם.'], [3, 'שני צעדים שאפשר לדמיין קלים יותר לביצוע מאשר ״כבר מאוחר״.']], sum: ['בחרה סיפור לפני חיבוק הלילה טוב.', 'סיפור, ואז לילה טוב מוכר.', 'איך אפשר להקל על השגרה הזאת?'] });
  Object.assign(MOMENTS.feelings, { label: 'רגשות גדולים', said: 'המגדל נפל, ועכשיו שום דבר לא מרגיש בסדר.', title: 'קודם מקום לרגש.', action: 'אם הילד רוצה, הישארו קרובים ותנו שם למה שקרה, בלי למהר לפתור. כשהוא מוכן, הציעו לבחור אם לבנות שוב או לקחת הפסקה.', words: '״עבדת על המגדל הזה והוא נפל. אני כאן. נבנה שוב או ננוח קצת?״', notices: [[0, 'ייתכן שהרגש צריך קודם חברה, ורק אחר כך פתרון.'], [1, 'לבנות מחדש חלק אחד ביחד יכול להיות בהישג יד, גם כשהמגדל כולו לא.'], [5, 'לא חייבים לתקן. להישאר קרוב זו כבר תגובה.']], sum: ['ביקשה לבנות שוב ביחד אחרי שהמגדל נפל.', 'נשארנו קרובים, ואז הצענו בחירה.', 'מה עוזר כשהתסכול מצטבר?'] });
  Object.assign(MOMENTS.play, { label: 'זמן ביחד', said: 'יש לנו כמה דקות ביחד. מה אפשר לעשות בלי עוד מסך?', title: 'תנו לילד להוביל הרפתקה קטנה.', action: 'בחרו שלושה חפצים בטוחים ומתאימים לגיל. הזמינו את הילד להמציא איתם סיפור, ובקשו ממנו לתת לכם תפקיד.', words: '״לאן יוצאים להרפתקה, ואת מי אני משחק?״', notices: [[2, 'כשהם מובילים את המשחק, הם מתרגלים להחליט.'], [3, 'חפצים אמיתיים בידיים מזמינים משחק דמיון שמתאים לגיל.'], [4, 'כמה דקות בלי לחץ נכנסות ביום שכבר יש לכם.']], sum: ['המציאה סיפור ונתנה לכל אחד תפקיד.', 'שלושה חפצים וסיפור שהיא הובילה.', 'איך ממשיכים ממה שהיא אוהבת?'] });
}
let forms = null;
let moment = 'bedtime';
/* The trial link carries a moment only when the visitor chose one, here or in the address. */
let picked = Object.hasOwn(MOMENTS, query.get('moment') ?? '') ? query.get('moment') : null;
if (picked) moment = picked;

/* ---------- trial links ---------- */
const stamp = () => {
  if (!picked) return;
  $$('a[href*="start=trial"]').forEach(a => { const u = new URL(a.href, location.href); u.searchParams.set('moment', picked); a.href = u.pathname + u.search; });
};
import('./arbor-conversion-v12.js').then(({ trialHref }) => {
  $$('a[href*="entry=landing"]').forEach(a => { a.href = trialHref(a.getAttribute('href'), location.search, HE ? 'he' : 'en'); });
  stamp();
}).catch(() => {});
stamp();

/* ---------- header and the phone bar ---------- */
const topBar = $('#top-bar'), bar = $('#cta-bar'), heroCta = $('.hero .btn'), closeSec = $('#start');
const onScroll = () => {
  topBar.classList.toggle('scrolled', scrollY > 12);
  if (bar) bar.classList.toggle('show', heroCta.getBoundingClientRect().bottom < 0 && closeSec.getBoundingClientRect().top > innerHeight * 0.7);
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();

/* ---------- the film ---------- */
const film = $('#film');
const chapterBtns = $$('#chapters li > button:not(.film-ctl)');
const captions = chapterBtns.map(b => $('span', b).textContent);
const cap = $('#film-cap'), ctl = $('#film-ctl');
const scenes = $$('.scene', film).map(el => ({
  el, len: +el.dataset.len,
  ins: $$('[data-at]', el).map(n => ({ n, at: +n.dataset.at, text: n.hasAttribute('data-type') ? n.textContent : null, dur: +(n.dataset.dur || 1), clear: n.dataset.clear ? +n.dataset.clear : Infinity })),
  taps: $$('[data-tap]', el).map(n => ({ n, at: +n.dataset.tap })),
  grows: $$('[data-grow]', el).map(n => ({ n, at: +n.dataset.grow })),
  outs: $$('[data-out]', el).map(n => ({ n, at: +n.dataset.out })),
  counts: $$('[data-count]', el).map(n => ({ n, to: +n.dataset.count, at: +(n.closest('[data-at]')?.dataset.at || 0) })),
}));
const starts = []; let total = 0;
scenes.forEach(s => { starts.push(total); total += s.len; });
const FADE = 0.5;
let firstPass = true, shown = -1;
const render = T => {
  T = Math.max(0, Math.min(total - 0.001, T));
  let i = scenes.length - 1;
  while (i > 0 && T < starts[i]) i--;
  const s = scenes[i], local = T - starts[i], prev = (i + scenes.length - 1) % scenes.length;
  scenes.forEach((sc, k) => {
    let o = 0;
    if (k === i) o = (i === 0 && firstPass) ? 1 : ease(local / FADE);
    else if (k === prev && local < FADE && !(i === 0 && firstPass)) o = 1;
    sc.el.style.opacity = o; sc.el.style.zIndex = k === i ? 2 : 1; sc.el.style.visibility = o > 0 ? 'visible' : 'hidden';
    sc.el.style.transform = k === i && o < 1 ? `translateY(${(1 - o) * 1.4}em)` : '';
  });
  for (const a of s.ins) {
    if (a.text != null) {
      const p = clamp01((local - a.at) / a.dur);
      const gone = local >= a.clear;
      a.n.textContent = gone ? '' : a.text.slice(0, Math.round(a.text.length * p));
      a.n.classList.toggle('cursor', !gone && p > 0 && p < 1);
    } else {
      const p = ease((local - a.at) / 0.55);
      a.n.style.opacity = p; a.n.style.transform = p < 1 ? `translateY(${(1 - p) * 0.8}em)` : '';
    }
  }
  for (const b of s.outs) { const p = clamp01((local - b.at) / 0.2); b.n.style.opacity = 1 - p; b.n.style.visibility = p >= 1 ? 'hidden' : 'visible'; }
  for (const c of s.counts) c.n.textContent = Math.round(c.to * ease((local - c.at) / 0.9));
  /* a tap: the button gives a little, and a ring opens out from it */
  for (const k of s.taps) {
    const p = (local - k.at) / 0.5, on = p >= 0 && p <= 1;
    k.n.style.opacity = on ? ((1 - p) * 0.9).toFixed(3) : 0;
    k.n.style.transform = on ? `scale(${(0.3 + 1.1 * p).toFixed(3)})` : '';
    k.n.parentElement.style.scale = p >= 0 && p < 0.35 ? '.94' : '';
  }
  for (const g of s.grows) g.n.style.setProperty('--g', ease((local - g.at) / 0.7).toFixed(3));
  if (i !== shown) {
    shown = i;
    chapterBtns.forEach((b, k) => { b.setAttribute('aria-current', String(k === i)); if (k !== i) b.style.setProperty('--p', 0); });
    if (cap) cap.textContent = captions[i];
  }
  chapterBtns[i].style.setProperty('--p', (local / s.len).toFixed(3));
  return i;
};

const PLAYS = 2;
const state = { t: 0, playing: false, paused: false, plays: 0, onScreen: false, last: 0, raf: 0 };
const setCtl = () => {
  if (!ctl) return;
  const done = state.plays >= PLAYS, idle = state.paused || done;
  $('span', ctl).textContent = done ? T.again : state.paused ? T.play : T.pause;
  if (forms && forms.setPaused) forms.setPaused(state.paused);
  const ic = $('.ms', ctl); ic.textContent = idle ? 'play_arrow' : ''; ic.classList.toggle('pz', !idle);
};
const tick = now => {
  state.raf = 0;
  if (!state.playing || state.paused || document.hidden) return;
  state.t += Math.min(0.05, (now - state.last) / 1000); state.last = now;
  if (state.t >= total) {
    state.plays++; firstPass = false;
    if (state.plays >= PLAYS) { render(total); state.playing = false; setCtl(); return; }
    state.t = 0;
  }
  render(state.t);
  state.raf = requestAnimationFrame(tick);
};
/* the film only runs while it is on screen, and never restarts by itself after its two passes */
const play = () => { if (state.raf || reduced || filmOnly || !state.onScreen || state.plays >= PLAYS) return; state.playing = true; state.last = performance.now(); state.raf = requestAnimationFrame(tick); };
const showScene = k => { state.t = starts[k] + scenes[k].len - 0.02; firstPass = true; render(state.t); };

film.classList.add('live');
if (reduced) showScene(0);
else render(0);
chapterBtns.forEach((b, k) => b.addEventListener('click', () => {
  if (reduced) { showScene(k); return; }
  firstPass = false; state.t = starts[k]; state.plays = Math.min(state.plays, PLAYS - 1); state.paused = false; setCtl(); render(state.t); play();
}));
if (ctl) ctl.addEventListener('click', () => {
  if (state.plays >= PLAYS) { state.plays = 0; state.t = 0; firstPass = false; state.paused = false; }
  else state.paused = !state.paused;
  setCtl(); play();
});
if (!reduced && !filmOnly) {
  new IntersectionObserver(es => es.forEach(e => { state.onScreen = e.isIntersecting; state.playing = state.onScreen && state.plays < PLAYS; if (state.playing) play(); }), { threshold: 0.35 }).observe(film);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
  setCtl();
}

/* ---------- the guide: six places ---------- */
const tabs = (list, btns, panels, onShow) => {
  list.setAttribute('role', 'tablist');
  btns.forEach((b, k) => { b.setAttribute('role', 'tab'); b.id = b.id || `${list.id}-tab-${k}`; b.setAttribute('aria-controls', panels[k].id); panels[k].setAttribute('role', 'tabpanel'); panels[k].setAttribute('aria-labelledby', b.id); });
  const show = (k, focus) => {
    btns.forEach((b, n) => { const on = n === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    onShow(k);
    if (focus) btns[k].focus();
  };
  btns.forEach((b, k) => {
    b.addEventListener('click', () => show(k));
    b.addEventListener('keydown', e => {
      const fwd = HE ? 'ArrowLeft' : 'ArrowRight', back = HE ? 'ArrowRight' : 'ArrowLeft';
      const d = e.key === fwd || e.key === 'ArrowDown' ? 1 : e.key === back || e.key === 'ArrowUp' ? -1 : 0;
      if (d) { e.preventDefault(); show((k + d + btns.length) % btns.length, true); }
    });
  });
  return show;
};
const placeBtns = $$('#places button'), places = placeBtns.map(b => $('#place-' + b.dataset.place));
const showPlace = tabs($('#places'), placeBtns, places, k => {
  places.forEach((p, n) => {
    const was = p.hidden; p.hidden = n !== k;
    if (n === k && was && !reduced) p.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
  });
  /* bring the tabs to the top, so the tabs and the chosen screen share the window */
  const top = $('#places').getBoundingClientRect().top;
  if (top < 80 || top > innerHeight * 0.3) scrollTo({ top: scrollY + top - 88, behavior: reduced ? 'auto' : 'smooth' });
});
const fromHash = () => { const k = places.findIndex(p => '#' + p.id === location.hash); if (k >= 0) { places.forEach((p, n) => { p.hidden = n !== k; }); placeBtns.forEach((b, n) => { b.setAttribute('aria-selected', String(n === k)); b.tabIndex = n === k ? 0 : -1; }); } return k >= 0; };
if (!fromHash()) { places.forEach((p, n) => { p.hidden = n !== 0; }); placeBtns.forEach((b, n) => { b.tabIndex = n === 0 ? 0 : -1; }); }
addEventListener('hashchange', fromHash);

/* a row and the screen part it explains light up together */
places.forEach(place => {
  const link = (el, on) => { const pin = el.dataset.pin; $$(`[data-pin="${pin}"]`, place).forEach(n => n.classList.toggle('hot', on)); };
  $$('[data-pin]', place).forEach(el => {
    el.addEventListener('pointerenter', () => link(el, true));
    el.addEventListener('pointerleave', () => link(el, false));
    el.addEventListener('focusin', () => link(el, true));
    el.addEventListener('focusout', () => link(el, false));
  });
  /* on a touch screen a tap on a row lights its part of the screen */
  $$('.caps > li[data-pin]', place).forEach(li => li.addEventListener('click', () => { $$('.hot', place).forEach(n => n.classList.remove('hot')); link(li, true); }));
});
/* while reading, the row at the middle of the window lights its part of the screen */
if ('IntersectionObserver' in window) {
  const reading = new IntersectionObserver(es => es.forEach(e => {
    const place = e.target.closest('.place'), pin = e.target.dataset.pin;
    if (!e.isIntersecting || place.matches(':hover')) return;
    $$('.hot', place).forEach(n => n.classList.remove('hot'));
    $$(`[data-pin="${pin}"]`, place).forEach(n => n.classList.add('hot'));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('.caps > li[data-pin]').forEach(li => reading.observe(li));
}

/* ---------- Talk: a tryable answer ---------- */
const said = $('#t-said'), why = $('#t-why'), sheet = $('#sheet'), careForm = $('#care-form');
const lensBtns = $$('#lens-list button');
let lens = 0, typing = 0;
const paintSheet = () => {
  const lines = $$('input', careForm).filter(i => i.checked).map(i => MOMENTS[moment].sum[+i.dataset.line]);
  sheet.replaceChildren(...(lines.length ? lines : [T.none]).map(t => Object.assign(document.createElement('li'), { textContent: t })));
};
const lensCard = $('.lens-card');
const paintLens = fade => {
  if (fade && !reduced && lensCard) lensCard.animate([{ opacity: 0.35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
  const [name, color] = LENSES[lens], m = MOMENTS[moment], hit = m.notices.find(n => n[0] === lens);
  lensBtns.forEach((b, n) => b.setAttribute('aria-pressed', String(n === lens)));
  $('#lens-name').textContent = name; $('#lens-dot').style.setProperty('--c', color);
  $('#lens-what').textContent = lensBtns[lens].nextElementSibling.textContent;
  $('#lens-eg').hidden = !hit;
  if (hit) { $('#lens-in').textContent = T.inEg(m.label); $('#lens-eg span').textContent = hit[1]; }
  if (forms) { forms.setLens(lens); forms.setLit(m.notices.map(n => n[0])); }
};
const paintMoment = animate => {
  const m = MOMENTS[moment];
  $$('#picks button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.moment === moment)));
  $('#t-title').textContent = m.title; $('#t-action').textContent = m.action; $('#t-words').textContent = m.words;
  why.replaceChildren(...m.notices.map(([n]) => { const c = document.createElement('span'); c.className = 'u-chip'; const d = document.createElement('i'); d.style.setProperty('--c', LENSES[n][1]); c.append(d, LENSES[n][0]); return c; }));
  $('#t-council').textContent = T.council(m.notices.length);
  paintSheet(); paintLens();
  const run = ++typing;
  if (animate) $('#t-status').textContent = T.status(m.label, m.title, m.words);
  if (!animate || reduced) { said.textContent = m.said; said.classList.remove('cursor'); return; }
  const blocks = $$('#place-talk [data-build]'), t0 = performance.now(), dur = 1100;
  blocks.forEach((b, k) => b.animate([{ opacity: 0, transform: 'translateY(.8em)' }, { opacity: 0, transform: 'translateY(.8em)', offset: 0.6 + k * 0.1 }, { opacity: 1, transform: 'none' }], { duration: 2000 + k * 300, easing: 'cubic-bezier(.16,1,.3,1)' }));
  said.classList.add('cursor');
  const step = now => {
    if (run !== typing) return;
    const p = clamp01((now - t0) / dur);
    said.textContent = m.said.slice(0, Math.round(m.said.length * p));
    if (p < 1) requestAnimationFrame(step); else said.classList.remove('cursor');
  };
  requestAnimationFrame(step);
};
$$('#picks button').forEach(b => b.addEventListener('click', () => { moment = picked = b.dataset.moment; stamp(); paintMoment(true); }));
careForm.addEventListener('change', paintSheet);
careForm.addEventListener('submit', e => e.preventDefault());
lensBtns.forEach((b, n) => b.addEventListener('click', () => { lens = n; paintLens(true); }));
paintMoment(false);

/* ---------- Kids Studio ---------- */
const worldBtns = $$('#k-tabs button'), worlds = worldBtns.map(b => $('#kw-' + b.dataset.world));
const kFrame = $('.k-frame');
/* the props float for a few seconds each time a world comes in, then rest */
const stir = () => { kFrame.classList.remove('live'); void kFrame.offsetWidth; kFrame.classList.add('live'); };
const showWorld = tabs($('#k-tabs'), worldBtns, worlds, k => { worlds.forEach((w, n) => { w.classList.toggle('on', n === k); w.inert = n !== k; }); if (!reduced) stir(); });
worlds.forEach((w, n) => { w.inert = n !== 0; });
worldBtns.forEach((b, n) => { b.tabIndex = n === 0 ? 0 : -1; });
if (!reduced && !filmOnly) new IntersectionObserver((es, io) => es.forEach(e => {
  if (!e.isIntersecting) return;
  io.disconnect(); stir();
}), { threshold: 0.5 }).observe($('#k-stage'));

/* leaving Kids Studio: a three-second hold, then a grown-up check */
const hold = $('#hold'), holdSay = $('#hold-say');
if (hold) {
  let timer = 0, reset = 0;
  const start = () => {
    if (timer || hold.classList.contains('passed')) return;
    hold.classList.add('holding'); holdSay.textContent = T.keep;
    timer = setTimeout(() => {
      timer = 0; hold.classList.replace('holding', 'passed'); $('.ms', hold).textContent = 'check';
      holdSay.innerHTML = T.check;
      reset = setTimeout(() => { hold.classList.remove('passed'); $('.ms', hold).textContent = 'door_open'; holdSay.textContent = T.retry; }, 9000);
    }, 3000);
  };
  const stop = () => { if (!timer) return; clearTimeout(timer); timer = 0; hold.classList.remove('holding'); holdSay.textContent = T.soon; };
  hold.addEventListener('pointerdown', e => { hold.setPointerCapture?.(e.pointerId); start(); });
  ['pointerup', 'pointercancel', 'blur'].forEach(t => hold.addEventListener(t, stop));
  hold.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
  hold.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  hold.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('pagehide', () => { clearTimeout(timer); clearTimeout(reset); });
}

/* ---------- entrances: only blocks still below the fold opt in ---------- */
if (!reduced && !filmOnly && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('[data-rise]').forEach(el => {
    if (el.getBoundingClientRect().top <= innerHeight * 0.92) return;
    if (el.dataset.rise === 'stagger') { el.classList.add('stagger'); [...el.children].forEach((c, k) => c.style.setProperty('--i', Math.min(k, 8))); }
    el.classList.add('rise'); io.observe(el);
  });
}

/* ---------- the sculpture, last and on its own ---------- */
const canvas = $('#forms');
/* Data saver, a 2G link or a very small device get the still artwork. Everyone else gets the
   sculpture once the page is idle, so building it never holds up the first screen. */
const conn = navigator.connection;
const lowEnd = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 2);
const mountForms = () => import('./arbor-living-scene-v3.js').then(({ mountLivingForms }) => {
  forms = mountLivingForms(canvas, { reduced, manual: filmOnly });
  if (!forms) return;
  forms.setPaused(state.paused);
  const seen = new Map();
  const choose = () => {
    let best = null, most = 0;
    for (const [el, h] of seen) if (h > most) { most = h; best = el; }
    forms.setStage(best ? $('.form-anchor', best) : null, best ? +best.dataset.stage : 0);
  };
  const io = new IntersectionObserver(es => { es.forEach(e => seen.set(e.target, e.isIntersecting ? e.intersectionRect.height : 0)); choose(); }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
  $$('[data-stage]').forEach(el => io.observe(el));
  paintLens();
}).catch(() => {}).finally(() => html.classList.add(forms ? 'webgl' : 'no-webgl'));
if (filmOnly) mountForms();
else if (lowEnd) html.classList.add('no-webgl');
else if ('requestIdleCallback' in window) requestIdleCallback(mountForms, { timeout: 1500 });
else setTimeout(mountForms, 300);

/* ---------- recording hook (?film=1) ---------- */
if (filmOnly) window.__film = { total, starts, render: t => { firstPass = t < starts[1]; render(t); if (forms && forms.renderAt) forms.renderAt(t); }, ready: () => document.fonts.ready.then(() => !!forms || html.classList.contains('no-webgl')) };

/* ---------- language menu: closes on a click outside it, or on Escape ---------- */
const langMenu = document.querySelector('.lang-menu');
if (langMenu) {
  document.addEventListener('click', e => { if (langMenu.open && !langMenu.contains(e.target)) langMenu.open = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && langMenu.open) { langMenu.open = false; langMenu.querySelector('summary').focus(); } });
}
