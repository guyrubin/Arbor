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
- [ ] ◻ **IA route rewrite** — new 6-pillar `SECTIONS` (Today/Ask/My Child/Grow/Care/Academy) + `TAB_SECTION_FALLBACK` for retired leaves; add `development`/`daily-play`/`practice`/`consult` to ActiveTab + VALID_TABS + tabRegistry. *Risk:* touches live router — land behind verification, no leaf deleted. Modifies nav/context/Shell.

## Core UI
- [x] ✅ **Today's Rhythm strip** — `RhythmStrip.tsx`: day-bar (tone-colored bands), insight chips (get-a-script / wind-down / calmest), honest "Learning {name}'s day" state. *Done:* verified live (learning state renders; reduced-motion gated; `role=img` summary). New.
- [x] ✅ **Daily Play card** — `DailyPlayCard.tsx`: title, "Builds:" line, household-item chips, collapsible numbered steps, "We did this" + "Coach me on this", stage/concern "why" line. *Done:* verified live (expand, actions, write-back, next-pick rotation). New.
- [x] ✅ **Today host** — `OverviewTab.tsx` now computes rhythm + daily-play from logs and renders both in a responsive `lg:grid-cols-2` section under the hero; "We did this" persists per child/day + toast; "Coach me"/"get a script" deep-link into Ask Arbor with a prefilled prompt. *Done:* tsc clean, 154 tests pass, no console errors. Modifies.
- [ ] ◻ **Development merge** — fold copilot+profile+milestones+journey into one `DevelopmentTab` (Now/Milestones/Profile tabs). Modifies/New.
- [ ] ◻ **Consult flow** — collapse reports+handoff+find-pro into one `ConsultTab`: build packet from `/api/memory` + `lib/reportExport`, parent redaction gate (Safety L3), "export to my pro / send to expert". New.
- [ ] ◻ **Ask a Specialist entry** — CTA on Ask + Care that opens the Consult packet (Phase 1 = export only, no marketplace). New.

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
- [x] ✅ tsc clean · 154 unit tests pass (17 new) · no console errors · live verification (mobile + interaction).
- [ ] ◻ a11y pass on new strings (contrast already on AA tokens); keyboard path through Rhythm chips.
- [ ] ◻ Prod build + deploy (`firebase deploy --only hosting`) — defer until IA route rewrite + Development/Consult land so it ships as one coherent release.
