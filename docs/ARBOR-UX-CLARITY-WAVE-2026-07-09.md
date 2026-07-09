# Arbor Elevation Wave — clarity by raising everything, not by hiding anything

**Version:** 2.0 (v1 "spotlight 3 hubs" approach REJECTED by Guy — too basic; nothing gets demoted) · **Date:** 2026-07-09 · **Status:** PLAN
**Source:** Maytal Doron feedback ×2 (own review + blind test, 2026-07-09) · **Builds on:** ARBOR-IA-WIREFRAME-MASTERPLAN-2026-07-03.md (live at `f068133`) + the 6ddac523 prototype block grammar.

## 1. Diagnosis (unchanged) and the corrected philosophy

Two independent reviewers: the IA is navigable, but a first-time parent can't tell **what Arbor gives her, what to do first, what to do daily** — and both, unprompted, named the same three things they'd share: child-as-hero comics · memories over years · helps the parent without addicting the child.

**v1's mistake:** treating overload with *demotion* (spotlight 3 hubs, quiet 5). **v2's stance:** overload comes from surfaces that present as features instead of meaning. A tired parent isn't overwhelmed by eight *meaningful* doors; she's overwhelmed by eight *unexplained* ones. So we elevate all eight to the same grade:

> **The Three Elevation Laws**
> **L-A · Every surface knows its job** — states it in one outcome sentence, offers ONE primary action.
> **L-B · Every surface is alive** — shows this child's real state (counts/activity, never verdicts), so it's instantly worth opening.
> **L-C · Every surface is connected** — shows what feeds it and what it feeds (the spine), so 8 hubs read as one system, not a catalog.

IA masterplan laws L1–L5 remain untouched; clinical firewall (counts, never %/verdicts) applies to every "living" element below; truthful-claims rule: evidence framing = research-anchored (CDC/AAP-2022, Zubler, ASHA, named scholar methods) — never "built with psychologists".

## 2. The Elevation Program — 12 workstreams

### E0 — First-minute wow (the front door) *(F7, F10, F13)*
New-family flow chains existing built capabilities: add child → photo → comic avatar (consent-gated) → **first hero-comic page starring the child on screen inside 2 minutes** → parent-mediated share prompt. Sprout-fallback path when no photo/consent so the wow never 404s. `[M]`

### E1 — The living sidebar (all 8 hubs, equal citizens) *(F1, F7)*
Every hub row gains a one-line **live pulse** under its label, computed from existing state, firewall-safe:
- Today — "חלון רגוע עד 17:30" (Day Windows) · Journal — "3 רגעים השבוע" · Behaviors — "שבוע רגוע · 2 אירועים" · Growth — "2 אבני דרך חדשות" · Academy — "הפרק הבא: 4 דק׳" · Ask Arbor — continuation of last conversation · Care Network — "שותף לאחרונה: גן" · Profile — "האלבום גדל: 14 רגעים".
The sidebar stops being a menu and becomes a live map of the child. Nothing dimmed; everything instantly meaningful. Mobile: same pulses in the More sheet. `[M]`

### E2 — Hub hero grammar (the prototype block kit, everywhere) *(F1, F3, F7)*
Every hub opens with the same premium module (from the dc.html grammar): uppercase eyebrow · **job sentence in outcome language** ("כאן הופכים רגעים קטנים לסיפור ההתפתחות") · ONE primary CTA · living stat-trio (counts). Eight consistent heroes = the app *feels* designed by one hand, and no screen ever needs explaining. This is the anti-catalog move: instead of fewer doors, every door tells you what's behind it before you ask. `[L — 8 hubs × one shared HubHero primitive]`

### E3 — The spine, made visible *(F7, F13)*
The one-directional "feeds into" ribbons (prototype's tinted cross-link block) rendered on every surface: Journal entry saved → "יתווסף לסיפור השבועי"; behavior logged → "מעדכן את מפת ההתפתחות"; skill noticed → "האקדמיה תתאים קורסים"; quest done in Kid Mode → appears in the parent's Today feed within the minute. Every action shows its ripple — the compounding-memory moat becomes something a parent *sees daily*, which is exactly what both reviewers said they'd tell friends about. `[M]`

### E4 — Today as conductor (not a card dump) *(F3)*
Today keeps ALL its content but becomes choreographed: top = **one time-aware hero action** picked by the existing rhythm engine (morning/calm window → today's quest with the child; evening/wind-down → 1-tap capture); middle = coach; then **live mini-cards of every other hub** (the E1 pulses as tappable previews). The parent scans one screen and sees the whole system alive — the daily answer is obvious, and the breadth is a feature again instead of noise. `[M]`

### E5 — Copy elevation, whole app *(F9)*
Outcome language everywhere; AI/tech framing out of parent surfaces ("ארבור זוכרת בשבילך", never "מנוע AI"). Every hub gets a job-sentence subtitle (feeds E2). Full EN+HE transcreation, no aphoristic slogan cadence. `[M — strings only]`

### E6 — Personal everywhere *(F5)*
- Avatar presence on parent surfaces through the ONE shared HeroAvatar engine: Profile child card, milestone celebrations, weekly report header.
- **Age-band chip on every content card** ("מותאם לגיל 5") — selection is already band-matched; render the fact.
- Child-name weaving in headers and empty states; "מציג תוכן לגיל {age}" under the child switcher. `[M]`

### E7 — Motion & celebration pass *(premium feel)*
One motion grammar app-wide (the prototype's rise-fade `scrIn`), consistent hover/press states, and **milestone celebration moments** (avatar-rendered, parent-side, share-promptable ≤1/session) — all `prefers-reduced-motion`-gated, kid dark-pattern ban untouched. `[M]`

### E8 — Trust woven in, not bolted on *(F6, F12)*
- Evidence chip ("מבוסס מחקר · CDC/AAP") on Development Map, coach answers, Academy → links `#/science`; research-anchored copy ONLY.
- Science moment inside onboarding (one screen of the E0 flow).
- **Free-vs-paid clarity:** Free/Plus/Family compare visible from Profile › Arbor Plus before any paywall; "חינם" badges during the first month. Live purchase CTA waits for the billing e2e gate (Guy). `[S+S+M]`

### E9 — Journal that starts itself *(F4)*
- 3 rotating age-band prompt chips above the capture triad ("איזו מילה מצחיקה נאמרה היום?") — tap pre-seeds a voice/text capture. Authored bank ~30/band, EN+HE, deterministic rotation.
- Ambient capture as the lead affordance: "ספרו בקול, ארבור תסדר" (the `/extract-log` flow, already built).
- Empty states across the app become invitations with one concrete CTA into the loop that fills them. `[S+S+S]`

### E10 — Kid gate: harden + say it out loud *(F2)*
- Parent challenge on kid-mode exit: 2-digit math question or optional 4-digit PIN (localStorage, zero child data) — the 3s hold stays as fallback when unset.
- Then the parent-side launcher earns the line: "נעול להורים — הילד לא יכול לצאת או למחוק". (Claim ships only with/after the gate.) `[S+S]`

### E11 — First-steps rail *(F8)*
Dismissible 4-step path for new accounts: הוסיפו ילד → הכירו את המאמן → תעדו רגע → צרו קומיקס. Deep links into existing surfaces; localStorage; gone once done. `[S]`

### E12 — Social proof (→ MKT) *(F11)*
Real-parent stories module on the marketing landings, seeded with Maytal's + blind-tester's lines (with permission). App-side hook = share artifacts already carrying referral codes. `[MKT backlog]`

## 3. Sequencing — foundation first, then everything rises together

| Batch | Contents | Why this order |
|---|---|---|
| **W1 — Foundations** | `HubHero` primitive + pulse-data hooks (E1/E2 substrate) · E9 prompts · E11 rail · E8 evidence chip · E10 gate | The shared kit everything else mounts on + the 5 cheap wins |
| **W2 — The eight rise** | E2 heroes on all 8 hubs · E1 living sidebar · E4 Today-as-conductor | One pass, all hubs — no half-elevated state |
| **W3 — The connective tissue** | E3 spine ribbons · E5 copy sweep · E6 personal layer | Meaning + personality on the new bones |
| **W4 — The polish** | E7 motion/celebrations · E8 pricing clarity (post billing-gate) · E0 wow onboarding | E0 last so the front door opens into the finished house |
| MKT | E12 | permission for quotes |

Each batch = green branch → full gate (firewall + cosmetics + nav guards, 1222-test floor) → EN+HE/RTL browser verify → merge = prod-promote. Every pulse/stat added in E1/E2/E4 goes through the firewall checklist: counts and activity only, no %/verdict/trend-delta.

## 4. Measures (existing attribution analytics, no new child data)
- First-minute: % new accounts seeing their first comic (E0) · rail completion (E11).
- Daily: Today hero-action tap-through (E4) · sessions with ≥1 capture (E9) · hub-pulse tap-through (E1 — does a living sidebar drive breadth of use?).
- Spine: % actions followed by a ripple-link tap (E3).
- Share: parent-mediated shares per family per week.
- Guard: masterplan's 6 acceptance audits stay green.
