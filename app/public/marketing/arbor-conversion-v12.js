/* Navigation carries campaign attribution, never the example a family explored. */
export function trialHref(href, search, lang) {
  const target = new URL(href, 'https://arborparentingapp.com');
  const incoming = new URLSearchParams(search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'referral']) {
    const value = incoming.get(key);
    if (value && value.length <= 120) target.searchParams.set(key, value);
  }
  if ((incoming.has('ref') || incoming.has('referral')) && !incoming.has('utm_source')) target.searchParams.delete('utm_source');
  target.searchParams.set('lang', lang === 'he' ? 'he' : 'en');
  return target.pathname + target.search;
}

if (typeof document !== 'undefined') {
  const he = document.documentElement.lang === 'he';
  document.querySelectorAll('a[href*="entry=landing"]').forEach(link => {
    link.href = trialHref(link.getAttribute('href'), location.search, he ? 'he' : 'en');
  });

  // A short, optional product example. The full positioning remains readable
  // without motion; manual chapters also work when autoplay/media is unavailable.
  const video = document.getElementById('family-film');
  const toggle = document.getElementById('film-toggle');
  if (video && toggle) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const constrained = () => connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
    const chapters = [...document.querySelectorAll('[data-film-step]')];
    const captions = he ? [
      ['01 · שאלה מהחיים', '״שעת השינה שוב מתאחרת.״', 'מתחילים במה שקורה במשפחה שלכם, עם ההקשר שחשוב לכם.'],
      ['02 · רעיון שאפשר לנסות', 'סיפור שבוחרים יחד. ואז חיבוק.', 'מוצאים צעד קטן להערב. בסטודיו הילדים אפשר לגלות סיפורים מקוריים ולפנות מקום לדמיון.'],
      ['03 · תצפית בשליטתכם', '״בחר סיפור וביקש חיבוק.״', 'בוחרים אם לשמור את התצפית. בהתפתחות, תצפיות ושגרות עוזרות לראות תמונה רחבה יותר.']
    ] : [
      ['01 · A REAL-LIFE QUESTION', '“Bedtime keeps getting later.”', 'Start with what is happening in your family, and the context that matters to you.'],
      ['02 · AN IDEA TO TRY', 'A story they choose. Then a hug.', 'Find a manageable step for tonight. Kids Studio adds original stories and room for their imagination.'],
      ['03 · AN OBSERVATION YOU CONTROL', '“Chose a story and asked for a hug.”', 'Choose whether to keep it. In Growth, observations and routines help build a fuller picture.']
    ];
    const starts = [0, 4.8, 9.3];
    const targets = ['film-caption-label','film-caption-title','film-caption-body'].map(id => document.getElementById(id));
    let manuallyPaused = false, visible = false, explicitlyPlaying = false, failed = false, current = -1;
    const select = index => {
      if (index === current) return;
      current = index;
      targets.forEach((target,i) => { target.textContent = captions[index][i]; });
      chapters.forEach((chapter,i) => chapter.setAttribute('aria-pressed',String(i===index)));
    };
    const label = () => {
      toggle.textContent = video.ended ? (he ? 'הפעלה מחדש' : 'Replay walkthrough') : video.paused
        ? (he ? 'הפעלת ההדגמה' : 'Play walkthrough')
        : (he ? 'השהיה' : 'Pause walkthrough');
    };
    const play = () => {
      if (failed) return;
      video.muted = true;
      video.play().catch(() => { label(); });
    };
    const sync = () => {
      if (!visible || document.hidden || manuallyPaused || video.ended || ((reduced.matches || constrained()) && !explicitlyPlaying)) video.pause();
      else play();
    };
    chapters.forEach((chapter,index) => {
      chapter.disabled = false;
      chapter.addEventListener('click',() => {
        manuallyPaused = true; explicitlyPlaying = false; video.pause();
        if (!failed) video.currentTime = starts[index];
        select(index); label();
      });
    });
    toggle.hidden = false;
    video.controls = false;
    toggle.addEventListener('click',() => {
      if (video.paused) {
        manuallyPaused = false; explicitlyPlaying = true;
        if (video.ended) { video.currentTime=0; select(0); }
        play();
      } else { manuallyPaused=true; explicitlyPlaying=false; video.pause(); }
    });
    video.addEventListener('timeupdate',() => { if (!failed) select(video.currentTime >= starts[2] ? 2 : video.currentTime >= starts[1] ? 1 : 0); });
    video.addEventListener('play',label); video.addEventListener('pause',label); video.addEventListener('ended',label);
    const mediaFailed = () => {
      failed=true; video.pause(); toggle.hidden=true;
      document.getElementById('film-error').hidden=false;
    };
    video.addEventListener('error',mediaFailed);
    if (video.error) mediaFailed();
    document.addEventListener('visibilitychange',sync);
    reduced.addEventListener('change',() => { explicitlyPlaying=false; sync(); });
    connection?.addEventListener?.('change',() => { explicitlyPlaying=false; sync(); });
    // Do not wait for window.load: a delayed unrelated asset must not block playback.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { visible=entries[0].isIntersecting; sync(); },{threshold:.3}).observe(video);
    } else { visible=true; sync(); }
    select(0); label();
  }

  document.querySelectorAll('[data-experience-step]').forEach(link => link.addEventListener('click',() => {
    document.querySelector(`[data-journey-step="${link.dataset.experienceStep}"]`)?.click();
  }));

  const choices = document.getElementById('share-example');
  const lines = document.getElementById('share-preview-lines');
  if (choices) choices.disabled = false;
  if (choices && lines) choices.addEventListener('change', () => {
    const selected = [...choices.querySelectorAll('input:checked')];
    lines.replaceChildren(...selected.map(input => {
      const li = document.createElement('li');
      li.textContent = input.closest('label').querySelector('small').textContent;
      return li;
    }));
    document.getElementById('share-preview-empty').hidden = selected.length > 0;
  });
}
