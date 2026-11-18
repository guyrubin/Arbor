import React from "react";

/* The four mini drawings of "How to read this week", from the canvas boards
   N-Week-D/M (viewBox 126x96): decor only, drawn in the page's kind tokens. */

const frame = (children: React.ReactNode) => (
  <svg viewBox="0 0 126 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const DrawWeek = () =>
  frame(
    <>
      <rect x="30" y="8" width="13" height="8" rx="2" fill="var(--wk-date-wash)"/>
      <rect x="69" y="8" width="13" height="8" rx="2" fill="var(--wk-date)"/>
      <rect x="5" y="22" width="19" height="6" rx="2" fill="var(--wk-moment-wash)"/>
      <rect x="5" y="31" width="19" height="6" rx="2" fill="var(--wk-hard-wash)"/>
      <rect x="5" y="40" width="19" height="6" rx="2" fill="var(--wk-step-wash)"/>
      <rect x="30" y="22" width="12" height="44" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="43" y="22" width="12" height="44" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="56" y="22" width="12" height="44" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="69" y="22" width="12" height="44" fill="var(--wk-ahead)" stroke="var(--wk-ahead-line)" strokeWidth="1"/>
      <rect x="82" y="22" width="12" height="44" fill="var(--wk-ahead)" stroke="var(--wk-ahead-line)" strokeWidth="1"/>
      <rect x="95" y="22" width="12" height="44" fill="var(--wk-ahead)" stroke="var(--wk-ahead-line)" strokeWidth="1"/>
      <rect x="108" y="22" width="12" height="44" fill="var(--wk-ahead)" stroke="var(--wk-ahead-line)" strokeWidth="1"/>
      <rect x="56" y="22" width="12" height="44" rx="2" fill="none" stroke="var(--wk-today)" strokeWidth="1.5"/>
      <circle cx="36" cy="31" r="3.6" fill="var(--wk-hard)"/>
      <circle cx="36" cy="40" r="3.6" fill="var(--wk-moment)"/>
      <circle cx="49" cy="50" r="3.6" fill="var(--wk-moment)"/>
      <rect x="30" y="72" width="91" height="16" rx="3" fill="var(--card)" stroke="var(--wk-grid)"/>
      <circle cx="36" cy="80" r="3.6" fill="var(--wk-step)"/>
      <circle cx="49" cy="80" r="3.6" fill="var(--wk-plan)"/>
      <circle cx="62" cy="80" r="3.6" fill="var(--wk-step)"/>
      <path d="M36 34 V75" stroke="var(--ink-soft)" strokeWidth="1.5" fill="none"/>
    </>,
  );

export const DrawHelped = () =>
  frame(
    <>
      <rect x="6" y="26" width="32" height="44" rx="6" fill="var(--wk-hard-wash)"/>
      <circle cx="22" cy="40" r="6" fill="var(--wk-hard)"/>
      <rect x="12" y="54" width="20" height="3" rx="1.5" fill="var(--wk-hard-ink)" opacity=".5"/>
      <rect x="12" y="60" width="14" height="3" rx="1.5" fill="var(--wk-hard-ink)" opacity=".35"/>
      <rect x="47" y="26" width="32" height="44" rx="6" fill="var(--wk-step-wash)"/>
      <circle cx="63" cy="40" r="6" fill="var(--wk-step)"/>
      <rect x="53" y="54" width="20" height="3" rx="1.5" fill="var(--wk-step-ink)" opacity=".5"/>
      <rect x="53" y="60" width="14" height="3" rx="1.5" fill="var(--wk-step-ink)" opacity=".35"/>
      <rect x="88" y="26" width="32" height="44" rx="6" fill="var(--card)" stroke="var(--wk-hard)" strokeWidth="1.5"/>
      <rect x="94" y="36" width="20" height="3" rx="1.5" fill="var(--wk-hard-ink)" opacity=".5"/>
      <rect x="94" y="43" width="16" height="3" rx="1.5" fill="var(--wk-hard-ink)" opacity=".35"/>
      <rect x="94" y="54" width="20" height="9" rx="4.5" fill="none" stroke="var(--ink-soft)"/>
      <path d="M38 48 H46 M79 48 H87" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round"/>
      <path d="M43 44 L47 48 L43 52 M84 44 L88 48 L84 52" stroke="var(--ink-soft)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </>,
  );

export const DrawNext = () =>
  frame(
    <>
      <rect x="5" y="16" width="36" height="64" rx="6" fill="var(--tint-2)" stroke="var(--pencil)" strokeWidth="1.5" strokeDasharray="4 3"/>
      <rect x="11" y="26" width="24" height="4" rx="2" fill="var(--sapphire-deep)" opacity=".5"/>
      <rect x="11" y="34" width="20" height="4" rx="2" fill="var(--sapphire-deep)" opacity=".35"/>
      <rect x="11" y="60" width="24" height="11" rx="5.5" fill="var(--sapphire)"/>
      <rect x="45" y="16" width="36" height="64" rx="6" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="50" y="24" width="26" height="9" rx="4" fill="var(--wk-hard-wash)"/>
      <rect x="50" y="36" width="26" height="9" rx="4" fill="var(--wk-moment-wash)"/>
      <rect x="50" y="48" width="26" height="9" rx="4" fill="var(--wk-moment-wash)"/>
      <rect x="85" y="16" width="36" height="64" rx="6" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="90" y="40" width="26" height="4" rx="2" fill="var(--wk-grid)"/>
      <circle cx="92" cy="42" r="3.5" fill="var(--wk-date)"/>
      <circle cx="114" cy="42" r="3.5" fill="var(--wk-date)"/>
    </>,
  );

export const DrawDay = () =>
  frame(
    <>
      <rect x="6" y="14" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="17" y="14" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="28" y="14" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="39" y="14" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="50" y="14" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="61" y="14" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="72" y="14" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="6" y="31" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="17" y="31" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="28" y="31" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="39" y="31" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="50" y="31" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="61" y="31" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="72" y="31" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="6" y="48" width="10" height="15" rx="2" fill="var(--wk-eve)" stroke="var(--wk-grid)"/>
      <rect x="17" y="48" width="10" height="15" rx="2" fill="var(--wk-eve)" stroke="var(--wk-grid)"/>
      <rect x="28" y="48" width="10" height="15" rx="2" fill="var(--wk-eve)" stroke="var(--wk-grid)"/>
      <rect x="39" y="48" width="10" height="15" rx="2" fill="var(--wk-eve)" stroke="var(--wk-grid)"/>
      <rect x="50" y="48" width="10" height="15" rx="2" fill="var(--wk-eve)" stroke="var(--wk-grid)"/>
      <rect x="61" y="48" width="10" height="15" rx="2" fill="var(--wk-eve)" stroke="var(--wk-grid)"/>
      <rect x="72" y="48" width="10" height="15" rx="2" fill="var(--wk-eve)" stroke="var(--wk-grid)"/>
      <rect x="6" y="65" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="17" y="65" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="28" y="65" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="39" y="65" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="50" y="65" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="61" y="65" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <rect x="72" y="65" width="10" height="15" rx="2" fill="var(--card)" stroke="var(--wk-grid)"/>
      <circle cx="11" cy="69" r="3" fill="var(--wk-moment)"/>
      <circle cx="22" cy="69" r="3" fill="var(--wk-moment)"/>
      <circle cx="55" cy="69" r="3" fill="var(--wk-moment)"/>
      <circle cx="66" cy="69" r="3" fill="var(--wk-hard)"/>
      <circle cx="33" cy="52" r="3" fill="var(--wk-moment)"/>
      <circle cx="44" cy="35" r="3" fill="var(--wk-moment)"/>
      <circle cx="104" cy="52" r="16" fill="var(--card)" stroke="var(--wk-grid)" strokeWidth="3"/>
      <path d="M97 41 A16 16 0 0 1 115 44" stroke="var(--wk-eve)" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <circle cx="104" cy="38" r="3" fill="var(--wk-hard)"/>
    </>,
  );
