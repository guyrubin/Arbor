# Arbor IA Redesign + Additions — TASKS

Brief: `PAI/projects/parenting-os-plugin/arbor-ia-redesign-2026-06-14.md` (+ feature defs + redesign definition, same folder).
Aesthetic: calm clinical-humanist. Fraunces display + Nunito body, `--arbor-*` tokens, green/clay + semantic ramp, WCAG AA, `prefers-reduced-motion` gated. Identity-preservation wins (committed brand colors).
Method: brief-to-tasks (vertical slices, each independently buildable + verifiable; ordered foundation → prominence → risk). Status: ✅ done · ◻ staged.

## Component inventory (reuse / modify / new)
- **Reuse as-is:** `kit.tsx` (PASTEL, cardCls), `ProgressRing`, `Skeleton`, `useToast`, `useArbor` (behaviorLogs/childProfile/setChatInput/setActiveTab), `motion/react`, lucide icons, `practice/signals.ts` pure-engine pattern.
- **Modify:** `OverviewTab.tsx` (→ Today host), `navigation.ts` (SECTIONS), `ArborContext` (ActiveTab union + VALID_TABS), `Shell.tsx` (tabRegistry), `MobileNav.tsx` (short labels), `lib/i18n.ts` (new labels).
- **New:** `rhythm/predict.ts`, `playbank/content.ts`+`select.ts`, `RhythmStrip.tsx`, `DailyPlayCard.tsx`, a merged `DevelopmentTab`, a `ConsultTab`, an `AskSpecialist` entry.

---

## Foundation
- [x] ✅ **Rhythm engine** — pure `rhythm/predict.ts`: trailing-window hour histogram → friction/calm/wind-down bands + confidence/days-needed. *Done:* 8 unit tests green; excludes not-yet-happened events; honest sparse-data read. New.
- [x] ✅ **Daily Play engine** — `playbank/content.ts` (12 expert-reviewable household-item activities, banded + skill-tagged) + pure `select.ts` (band × concern-domain × novelty ranking, deterministic by daySeed). *Done:* 9 unit tests green; concern-match beats age-only; no cold-start failure. New.
- [x] ✅ **IA route rewrite** — new 6-pillar `SECTIONS` (Today/Ask/My Child/Grow/Care/Academy) + `TAB_SECTION_FALLBACK` for all demoted leaves; added `development`/`daily-play`/`practice`/`consult` to ActiveTab + VALID_TABS + tabRegistry; i18n labels (en+he) for new section/tab ids; MobileNav + Sidebar generic so they picked it up. *Done:* nothing deleted (deep links resolve via fallback); navigation.test rewritten for 6 pillars (12 assertions); tsc clean; verified live — all 6 pillars + sub-navs render, deep links `#/development|practice|consult` highlight the right pillar. Modifies nav/context/Shell/i18n.

## Core UI
- [x] ✅ **Today's Rhythm strip** — `RhythmStrip.tsx`: day-bar (tone-colored bands), insight chips (get-a-script / wind-down / calmest), honest "Learning {name}'s day" state. *Done:* verified live (learning state renders; reduced-motion gated; `role=img` summary). New.
- [x] ✅ **Daily Play card** — `DailyPlayCard.tsx`: title, "Builds:" line, household-item chips, collapsible numbered steps, "We did this" + "Coach me on this", stage/concern "why" line. *Done:* verified live (expand, actions, write-back, next-pick rotation). New.
- [x] ✅ **Today host** — `OverviewTab.tsx` now computes rhythm + daily-play from logs and renders both in a responsive `lg:grid-cols-2` section under the hero; "We did this" persists per child/day + toast; "Coach me"/"get a script" deep-link into Ask Arbor with a prefilled prompt. *Done:* tsc clean, 154 tests pass, no console errors. Modifies.
- [x] ✅ **Development merge** — `DevelopmentTab` via reusable `HubTabs`: Now (copilot) / Milestones / Profile / Journey, each the existing tab as a panel. Verified live. New.
- [x] ✅ **Practice hub** — `PracticeHubTab`: Speech / Mimic / Feelings / Adventures under one Grow ▸ Practice entry. Verified live. New.
- [x] ✅ **Daily Play library** — `DailyPlayTab` (Grow ▸ Daily Play): top picks for the band+concerns as `DailyPlayCard`s, done/coach wired. New.
- [x] ✅ **Consult merge (Phase 1)** — `ConsultTab`: Build a handoff (Reports) + Find a professional, one verb. Verified live. New.
- [x] ✅ **Ask a Specialist + real packet flow** — pure `consult/packet.ts` (`buildConsultPacket` assembles About/Patterns/Development/Tried/Memory from the record; `serializePacket` + `countIncluded` with redaction; 8 tests) + `sections/AskSpecialist.tsx`: per-line redaction toggles (Safety L3 — nothing leaves the device until export), Copy + Download (.md) export, "Send to an Arbor specialist" stubbed honestly as Phase 2. Led the Consult hub. *Done:* verified live (4 sections from Dylan's record, 15→14 toggle works, strikethrough, export bar). New.

## Interactions & States
- [x] ✅ Rhythm sparse-data state (days-needed copy) — verified.
- [x] ✅ Daily Play done → persist + rotate to next idea — verified live.
- [ ] ◻ Rhythm "predicting" state with seeded logs — engine unit-tested; needs a live data seed to screenshot the colored bands.
- [ ] ◻ Consult redaction + GDPR consent gate states.

## Responsive & Polish
- [x] ✅ Today section stacks 1-col on narrow, `lg:` 2-col — code + mobile screenshot verified.
- [ ] ◻ Rhythm strip RTL (Hebrew) audit + translate new strings in `i18n.ts`.
- [ ] ◻ Pillar label + sub-nav copy pass once IA route rewrite lands.

## Review
- [x] ✅ tsc clean · **162 unit tests pass (25 new)** · no console errors · live verification of all 6 pillars + hubs + the 3 additions.
- [ ] ◻ a11y pass on new strings (contrast already on AA tokens); keyboard path through Rhythm chips + redaction toggles.
- [ ] ◻ Hebrew/RTL pass on the new Rhythm/Daily Play/Consult copy (English shows via fallback today).
- [ ] ◻ **Commit + prod build + deploy** (`firebase deploy --only hosting`) — all the above is verified on the working tree, undeployed, ready to ship as one coherent release.

## Status: feature-complete on the working tree
All three competitor-beating additions (Rhythm, Daily Play, Ask-a-Specialist) + the 6-pillar IA redesign are built and verified live. Remaining = polish (a11y/RTL) + the deploy. Phase-2 backlog (not in scope): Daily Play Courses, AI-generated activities, send-to-Arbor-expert marketplace.
