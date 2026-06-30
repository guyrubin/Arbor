# UC-4 Consolidation Map — Fold ~42 routes into 8 clean hubs

**Branch:** `claude/uc4-consolidate` · **Scope:** `C:\Users\dguyr\arbor-uc1\app` · **Status:** PLANNING ONLY (no app-code change in this doc).

**Goal:** kill the "messy, old+new duplicated" feel. The current app exposes 45 top-level `ActiveTab` routes and an 18-item Sidebar TOOLS drawer that duplicates the eight categories (e.g. *Behaviors* category = *Behavior Logs* tool = *Log a Moment* tool — all route to `behaviors`). The wireframe (`.design-source/Arbor-Web-App.dc.html`) presents exactly **8 sidebar categories** with capability folded *inside* the hubs, a **short CATFEAT sub-tab row** per hub, and a **9-item TOOLS drawer of genuinely-global quick actions**. This map folds every route into one of the 8 hubs, removes the duplications, and lists the screens that still need reskinning so there is no old/new split.

**Wireframe ground truth (verified):**
- `STATE_NAV` = 8 categories: `today · behaviors · growth · journal · academy · ask · care · profile`.
- `CATFEAT` (the only hubs that render a sub-tab row): `today:[Log a Moment, Reminders]`, `growth:[Weekly, Windows, Routines, Science]`, `academy:[Hero Stories]`, `profile:[Arbor Plus]`. All other hubs render NO pill row (single primary view).
- `TOOLS` drawer (wireframe, 9 items): Log a Moment, Day Windows, Routines, Weekly Report, Behavior Logs, Bedtime Stories, Reminders, The Science, Arbor Plus.

**Constraints honored throughout:** parent-only (kidmode/playkit/mascot/`.arbor-play` untouched); clinical firewall (no scores/verdicts/deficits — bars are milestone counts only); RTL/i18n (all labels via `t()`, `inset-inline-*`, `dir`); **no feature deleted** — consolidation = reorganize + keep reachable.

---

## 1) FOLD MAP — every route → exactly one hub

45 routes (the full `ActiveTab` union in `src/context/ArborContext.tsx`). Each appears **once**. "Surface" column: **PRIMARY** = the hub's main view (opened by the sidebar row); **SUB-TAB** = a curated pill in that hub's CATFEAT row; **DRAWER** = reached from the global TOOLS drawer; **DEEP-LINK** = valid `#/route` + programmatic nav, resolves to the hub for sidebar highlight but is not its own sidebar destination; **IN-HUB** = surfaced as a card / quick-action / internal section inside another view.

| # | Route | Hub | Surface | How it shows up inside the hub |
|---|-------|-----|---------|-------------------------------|
| 1 | `overview` | **Today** | PRIMARY | Today dashboard (guidance hero + dev-ring + Mia's activity + coach card). |
| 2 | `day-windows` | **Today** | DRAWER | "Day Windows" tool; also reachable as a card from the Today dashboard. |
| 3 | `smart-reminders` | **Today** | DRAWER | "Reminders" tool. (Wireframe puts Reminders in `today` CATFEAT — see hub design note.) |
| 4 | `behaviors` | **Behaviors** | PRIMARY | Behaviors hub (events feed + log-a-moment composer + patterns). Single canonical route — the old "Log a Moment" / "Behavior Logs" duplicates collapse onto this. |
| 5 | `development` | **Growth** | PRIMARY | Development Map (7-domain ring + per-domain skill marking). |
| 6 | `milestones` | **Growth** | SUB-TAB | "Milestones" pill. |
| 7 | `language` | **Growth** | SUB-TAB | "Language & Communication" pill. |
| 8 | `daily-play` | **Growth** | DRAWER | "Routines" tool (nearest existing route to wireframe "Routines"). |
| 9 | `practice` | **Growth** | DRAWER | "Practice" tool → Practice hub over speech/mimic/feelings/adventures. |
| 10 | `plans` | **Growth** | DRAWER | "Growth Plans" tool. |
| 11 | `copilot` | **Growth** | DEEP-LINK | Folded into Development; `#/copilot` resolves to Growth. |
| 12 | `journey` | **Growth** | DEEP-LINK | Practice-suite journey; resolves to Growth via Practice. |
| 13 | `screening` | **Growth** | DEEP-LINK | Development Check (non-diagnostic); entered from Development, resolves to Growth. |
| 14 | `strengths` | **Growth** | DEEP-LINK | Folded into Development Profile spine; resolves to Growth. |
| 15 | `speech` | **Growth** | IN-HUB | Practice-hub drill (tile inside Practice). |
| 16 | `mimic` | **Growth** | IN-HUB | Practice-hub drill. |
| 17 | `feelings` | **Growth** | IN-HUB | Practice-hub drill. |
| 18 | `adventures` | **Growth** | IN-HUB | Practice-hub drill. |
| 19 | `journal` | **Journal** | PRIMARY | Journal compose + flat moment feed. |
| 20 | `timeline` | **Journal** | SUB-TAB | "Story" pill (unified signal timeline). |
| 21 | `masterclasses` | **Academy** | PRIMARY | Parent Masterclasses (Learning Map + courses). |
| 22 | `stories` | **Academy** | SUB-TAB | "Story Journeys / Hero Stories" pill. |
| 23 | `bedtime-stories` | **Academy** | DRAWER | "Bedtime Stories" tool. |
| 24 | `comics` | **Academy** | IN-HUB | "Hero Comics" — quick-action/tile from the Story Journeys surface (batch studio). |
| 25 | `family` | **Academy** | IN-HUB | "Family Formation" — section reached from the Academy hub. |
| 26 | `coach` | **Ask Arbor** | PRIMARY | Ask Arbor chat (AI coach + human-expert handoff). |
| 27 | `scholar` | **Ask Arbor** | IN-HUB | Scholar/expert lens inside Ask Arbor; `#/scholar` resolves to Ask. |
| 28 | `consult` | **Care Network** | PRIMARY | Consult flow (build summary → share with verified pro). Absorbs reports/handoff/find-pro. |
| 29 | `safety` | **Care Network** | SUB-TAB | "Safety & Escalation" pill (load-bearing escalation surface). |
| 30 | `school-brief` | **Care Network** | DRAWER | "School Brief" tool (parent-controlled, teacher-facing). |
| 31 | `care-team` | **Care Network** | DRAWER | "My Care Team" tool. |
| 32 | `sharing` | **Care Network** | DRAWER | "Trusted Sharing" tool. |
| 33 | `appointments` | **Care Network** | DRAWER | "Appointments" tool. |
| 34 | `reports` | **Care Network** | DEEP-LINK | Folded into Consult export menu; `#/reports` resolves to Care. |
| 35 | `handoff` | **Care Network** | DEEP-LINK | Retired standalone door → Consult; `#/handoff` resolves to Care. |
| 36 | `find-pro` | **Care Network** | DEEP-LINK | Inside Consult; resolves to Care. |
| 37 | `attribution` | **Care Network** | DEEP-LINK | Admin-only; deep link `#/attribution` + admin Settings entry. Resolves to Care for highlight; never in parent sidebar. |
| 38 | `profile` | **Profile** | PRIMARY | Development Profile (child + family + settings entry). |
| 39 | `memory` | **Profile** | DRAWER | "Child Memory" tool. |
| 40 | `weekly` | **Profile** | DEEP-LINK + DRAWER | Weekly snapshot. Surfaces as "Weekly Report" in TOOLS; resolves to Profile for highlight. |
| 41 | `science` | **Profile** | DRAWER | "The Science" tool (trust page). *(See §3 — moved from Care fallback to Profile.)* |
| 42 | `bedtime-stories` | — | — | *(already row 23)* |
| 43 | `smart-reminders` | — | — | *(already row 3)* |

> **Net:** 45 distinct routes. The two `bedtime-stories`/`smart-reminders` lines above are de-dup reminders, not extra routes. Every route lands in exactly one hub and is reachable.

**Per-hub folded route counts** (every route owned, incl. deep-link/in-hub):
- **Today** — 3 (overview, day-windows, smart-reminders)
- **Behaviors** — 1 (behaviors)
- **Growth** — 13 (development, milestones, language, daily-play, practice, plans, copilot, journey, screening, strengths, speech, mimic, feelings, adventures) → *14 listed; `development` is the hub.* **Count = 14.**
- **Journal** — 2 (journal, timeline)
- **Academy** — 5 (masterclasses, stories, bedtime-stories, comics, family)
- **Ask Arbor** — 2 (coach, scholar)
- **Care Network** — 10 (consult, safety, school-brief, care-team, sharing, appointments, reports, handoff, find-pro, attribution)
- **Profile** — 4 (profile, memory, weekly, science)

Total = 3 + 1 + 14 + 2 + 5 + 2 + 10 + 4 = **41 leaf routes + 4 hubs that are themselves routes** … precisely **45 routes** (overview/behaviors/development/journal/masterclasses/coach/consult/profile are both hubs and routes). The `navigation.test.ts` 45-route floor is preserved.

---

## 2) PER-HUB SUB-NAV DESIGN

Rule: a hub renders a sub-tab pill row **only** when `primaryTabs.length > 1` (Shell already guards on this). Keep rows to **hub + ≤2 leaves** (the test caps `primaryTabs.length <= 3`). Everything else is DRAWER / IN-HUB. Growth and Care are the heaviest — designed below so neither becomes a new 8-pill mess.

| Hub | Primary view | Sub-tab pill row (ordered) | Everything else (where it lives) |
|-----|--------------|----------------------------|-----------------------------------|
| **Today** | `overview` | *(none — single surface)* | Day Windows + Reminders as dashboard cards **and** TOOLS entries. |
| **Behaviors** | `behaviors` | *(none)* | Log composer + patterns are sections *inside* the one view. |
| **Growth** | `development` | **Development · Milestones · Language** (3) | Practice, Routines (daily-play), Growth Plans → TOOLS. copilot/journey/screening/strengths/speech/mimic/feelings/adventures → IN-HUB / deep-link. |
| **Journal** | `journal` | **Journal · Story** (2) | — |
| **Academy** | `masterclasses` | **Masterclasses · Story Journeys** (2) | Bedtime Stories → TOOLS. Hero Comics + Family Formation → IN-HUB tiles. |
| **Ask Arbor** | `coach` | *(none)* | Scholar lens inside the chat. |
| **Care Network** | `consult` | **Consult · Safety** (2) | School Brief, Care Team, Trusted Sharing, Appointments → TOOLS. reports/handoff/find-pro/attribution → deep-link into Consult. |
| **Profile** | `profile` | *(none)* | Child Memory, The Science, Arbor Plus, Weekly Report → TOOLS / Settings. |

**Growth — heaviest hub, anti-pill-mess design:** 14 routes, but only **3 pills**. The Development Map (`development`) is the spine; `milestones` and `language` are the two clinical sub-views worth a pill. The *play/practice* family (daily-play, practice, speech, mimic, feelings, adventures) collapses into **one Practice hub tile-grid** reached from a single "Practice" TOOLS entry — not six pills. `copilot`/`journey`/`screening`/`strengths` are entered *from within* Development (drill-downs), keeping the pill row at three.

**Care Network — second heaviest, anti-pill-mess design:** 10 routes, **2 pills**. `consult` is the spine and *absorbs* reports/handoff/find-pro as export/flow steps (they stay deep-linkable). `safety` earns a pill (escalation must be one tap away). The four people/logistics surfaces (School Brief, Care Team, Trusted Sharing, Appointments) are **TOOLS entries** — they are real but secondary, so they do not crowd the pill row.

---

## 3) NO-DUPLICATE NAV

**Sidebar = the 8 categories ONLY.** Each category row opens its `primaryTabOf` view. No category appears twice; no category is also a TOOLS entry under a different label.

**Recommendation: DROP the bloated 18-item TOOLS drawer; replace with the wireframe's lean 9 + a small tail of genuinely-orphaned leaves — OR (preferred) eliminate the drawer's category-duplicating entries entirely.** Concretely:

**Duplications to REMOVE from the current `TOOLS` list (`src/lib/navigation.ts`):**
1. **`behaviors` "Log a Moment"** — duplicate of the Behaviors category row. **Remove from drawer.** Move "Log a Moment" to a **topbar quick-action** (the wireframe's primary capture affordance) and as the in-hub composer inside Behaviors.
2. **`behaviors` "Behavior Logs"** — second duplicate of the same route. **Remove.** It *is* the Behaviors hub.
3. **`profile` "Arbor Plus"** — keep as a single entry, but home it under **Profile › Settings › Arbor Plus** (billing), not as a free-floating tool. (Wireframe lists it under `profile` CATFEAT.)
4. **`science` "The Science"** — currently falls back to **Care**; it is a trust/editorial page about the product, not a care surface. **Re-home its fallback to `profile`** (Profile › The Science) so the drawer entry and the highlight agree.

**Resulting lean TOOLS drawer (recommended) — only genuinely-global secondary actions, none of which is a category or a pill:**
`Day Windows` · `Routines` (daily-play) · `Weekly Report` · `Bedtime Stories` · `Reminders` (smart-reminders) · `Practice` · `Growth Plans` · `School Brief` · `My Care Team` · `Trusted Sharing` · `Appointments` · `Child Memory` · `The Science`.

(Drop `Log a Moment`, `Behavior Logs`, and the redundant `Arbor Plus`/`Hero Comics`/`Family Formation` — those are category-owned, in-hub tiles, or topbar/Settings actions.)

> If the team prefers the wireframe's literal 9-item drawer, use exactly: Day Windows, Routines, Weekly Report, Bedtime Stories, Reminders, The Science + (Practice, Growth Plans, School Brief, Care Team, Trusted Sharing, Appointments, Child Memory) folded behind a "More in <hub>" disclosure so the drawer never shows two routes that point at the same view. Either way, **Log a Moment / Behavior Logs must not both point at `behaviors`.**

**Topbar (no duplication):** the topbar carries the 4 global actions only — **Ask Arbor** (opens `coach`), **Search**, **Kid Mode**, **Settings** — plus the new **Log a Moment** quick-action and notifications + child switcher. None duplicates a sidebar category.

---

## 4) RESKIN-NEEDED LIST (old design → new design)

"New design" = imports the shared `<Icon>` (Material Symbols) and uses the sage card layout. Of the registry leaf components, **15 already import `ui/Icon`** (on the new path): OverviewTab, BehaviorsTab, MilestonesTab, DevelopmentTab, JournalTab, CoachTab, ScholarTab, ChildProfile, Strengths, Masterclasses, FamilyFormation, CareTeam, FindProfessional, Appointments, TrustedSharing.

**Still OLD design — lucide icons / old layout, must be brought to Material Symbols `<Icon>` + sage card layout** (these are the source of the old/new split; ~26 components):

| Route(s) | Component | Why it must be reskinned |
|----------|-----------|--------------------------|
| `plans` | `tabs/PlansTab.tsx` | lucide only |
| `stories` | `tabs/HeroJourneyTab.tsx` | lucide only |
| `weekly` | `tabs/WeeklyTab.tsx` | lucide only |
| `language` | `tabs/LanguageLabTab.tsx` (+ `LanguageLabVocabView.tsx`) | lucide only |
| `handoff` | `tabs/HandoffTab.tsx` | lucide only (route now → Consult) |
| `safety` | `tabs/SafetyTab.tsx` | lucide only |
| `timeline` | `tabs/StoryTimelineTab.tsx` | lucide only |
| `comics` | `tabs/HeroComicsTab.tsx` | lucide only |
| `daily-play` | `tabs/DailyPlayTab.tsx` | lucide only |
| `bedtime-stories` | `tabs/BedtimeStoriesTab.tsx` | lucide only |
| `science` | `tabs/SciencePage.tsx` | lucide only |
| `attribution` | `tabs/AttributionTab.tsx` | lucide only (admin — lower priority) |
| `memory` | `sections/ChildMemory.tsx` | lucide only |
| `screening` | `sections/Screening.tsx` (+ `ScreeningSheet.tsx`) | lucide only |
| `reports` | `sections/Reports.tsx` | lucide only |
| `school-brief` | `sections/SchoolBrief.tsx` | lucide only |
| `day-windows` | `sections/DayWindowsPanel.tsx` | lucide only |
| `smart-reminders` | `sections/SmartRemindersPanel.tsx` | lucide only |
| `practice` | `practice/PracticeHubTab.tsx` | lucide only |
| `consult` | `tabs/ConsultTab.tsx` | lucide only (Care PRIMARY — high priority) |
| `speech` | `practice/SpeechCoachTab.tsx` | lucide only |
| `mimic` | `practice/MimicStudioTab.tsx` | lucide only |
| `feelings` | `practice/FeelingsLabTab.tsx` | lucide only |
| `journey` | `practice/JourneyTab.tsx` | lucide only |
| `adventures` | `practice/AdventuresTab.tsx` | lucide only |
| `copilot` | `practice/DevelopmentCopilot.tsx` | lucide only |

**Reskin-needed count: ~26 leaf components** (+ their lucide-only sub-children: LanguageLabVocabView, ScreeningSheet, PhysicalGrowthCard, and the practice worlds WordWorld/PatternPower/HeroPose/BeatKeeper/Missions/EarlyReading/MemoryMatch/MimicMatch — these are parent-side practice surfaces and follow their hub's reskin slice). **Priority order:** Consult (Care PRIMARY) → Practice hub + its drills (Growth, most-visible old block) → language/plans/weekly/stories/timeline → the rest.

---

## 5) ICON FINISH (lucide → shared Material Symbols `<Icon>`)

Move every remaining lucide glyph to `<Icon name="…" />` (`src/components/ui/Icon.tsx`), matching the wireframe's Material Symbols ligatures.

**Shell / chrome (must finish first — always-visible):** `Shell.tsx` topbar still imports lucide `Sparkles, AlertTriangle, LogOut, Search, ShieldCheck, Settings`. Replace:
- Search button `Search` → `<Icon name="search" />`
- "How Arbor helps" `ShieldCheck` → `<Icon name="verified_user" />` (or `shield`)
- mobile Settings `Settings` → `<Icon name="settings" />`
- mobile sign-out `LogOut` → `<Icon name="logout" />`
- sandbox banner `AlertTriangle` → `<Icon name="warning" />`
- `Sparkles` → `<Icon name="auto_awesome" />`

**Shell topbar buttons** (their own components, lucide today): `layout/AskArborButton.tsx`, `layout/KidModeButton.tsx`, `search/TopbarSearch.tsx` + `search/SearchModal.tsx`, `layout/TopbarBell.tsx`, `layout/TopbarKidSwitcher.tsx`, `layout/SettingsModal.tsx`, `layout/AiRail.tsx` → Icon.

**DailyPlayCard:** `overview/DailyPlayCard.tsx` (lucide) → Icon. (Called out explicitly in the brief.)

**Other always-near-shell overview cards still on lucide** (finish in the Today slice): TrendsChart, StreakChip, RhythmStrip, RemindersCard, QuickCaptureBar, PrideMomentCard, GoalsCard, DevScoreStrip, DailyPlanCard, DailyCheckinCard, CourseCard.

**`navigation.ts` icon note:** the `NavItem.icon: LucideIcon` field stays as a structural fallback, but the **Sidebar already renders `msIcon` via `<Icon>`** for both category rows and TOOLS — so no lucide reaches the rail. Ensure every TOOLS entry has an `msIcon` (current list does). The lucide imports in `navigation.ts` can remain (typed fallback) or be dropped once no consumer reads `.icon`.

---

## 6) ZERO-REGRESSION GUARANTEE

**Every route stays reachable.** Reachability after consolidation:
- 8 hub PRIMARY views → sidebar rows (`primaryTabOf`).
- SUB-TAB leaves → pill row (`subTabsForSection` → `primaryTabs`).
- DRAWER leaves → TOOLS list.
- IN-HUB leaves → tiles/quick-actions inside their hub view.
- DEEP-LINK leaves → `#/route` hash routing (VALID_TABS) + programmatic `setActiveTab`; `sectionForTab` highlights the owning category.

**`navigation.ts` changes needed:**
- **`TAB_SECTION_FALLBACK`:** move `science` from `"care"` → `"profile"` (matches §3). Keep all existing fallbacks: copilot/journey/screening/strengths/speech/mimic/feelings/adventures → `growth`; weekly → `profile`; scholar → `ask`; reports/handoff/find-pro/attribution → `care`.
- **`TOOLS`:** remove the two `behaviors` duplicates ("Log a Moment", "Behavior Logs"); ensure no remaining TOOLS tab equals a category's `primaryTabOf`. (Test `every directly-owned ActiveTab is reachable…` still passes because every section item is covered by a primaryTab or a remaining TOOLS entry.)
- **`SECTIONS` / `primaryTabs`:** unchanged shape (8 sections, ids in fixed order, Growth items order `[development, milestones, language, daily-play, practice, plans]`, Journal `[journal, timeline]`, Care leads `consult` + has `safety`, Ask leads `coach`).
- **`sectionForTab` / `primaryTabOf` / `subTabsForSection`:** signatures unchanged.

**Guard-test updates (`navigation.test.ts`):**
- All 17 existing assertions stay green with the above (the structural shape is unchanged). 
- **Add** an assertion that **no TOOLS tab equals any section's `primaryTabOf`** (locks out the re-introduction of a category-duplicating drawer entry — the bug this whole UC fixes).
- **Add** an assertion that `sectionForTab("science").id === "profile"` (the fallback move) and update the existing `demoted leaves still resolve` block accordingly.
- Keep the 45-route floor (`sectionForTab resolves for EVERY ActiveTab`) and the `primaryTabs.length <= 3` cap — both already enforce the "no new pill mess" rule.

**Shell:** no change to the sub-tab render guard (`subTabsForSection(section).length > 1`) — Today/Behaviors/Ask/Profile correctly render no row.

---

## 7) EXECUTION SLICES

**Shared foundation slice (do first — touches the wiring, disjoint from hub bodies):**
- `src/lib/navigation.ts` — TOOLS de-dup + `science`→`profile` fallback.
- `src/lib/navigation.test.ts` — add the two new guards above.
- `src/components/layout/Shell.tsx` — finish shell topbar icons (Search/ShieldCheck/Settings/LogOut/AlertTriangle/Sparkles → `<Icon>`); add the **Log a Moment** topbar quick-action (opens `behaviors`).
- `src/components/layout/Sidebar.tsx` — render the lean TOOLS list (already `<Icon>`-driven; just the trimmed array).
- Shell topbar button components: AskArborButton, KidModeButton, TopbarSearch/SearchModal, TopbarBell, TopbarKidSwitcher, SettingsModal, AiRail → `<Icon>`.
- `overview/DailyPlayCard.tsx` → `<Icon>`.

Each hub slice below is **disjoint by file** (its own leaf components), so they can be built in parallel after the foundation lands:

- **Slice A — Today:** OverviewTab (Icon ✓, verify), DayWindowsPanel, SmartRemindersPanel reskin; Today overview cards (TrendsChart, StreakChip, RhythmStrip, RemindersCard, QuickCaptureBar, PrideMomentCard, GoalsCard, DevScoreStrip, DailyPlanCard, DailyCheckinCard, CourseCard) → Icon.
- **Slice B — Behaviors:** BehaviorsTab (Icon ✓) — confirm composer + patterns are in-hub; remove drawer duplicates already handled in foundation.
- **Slice C — Growth (largest):** ConsultTab is Care, not here. Reskin PracticeHubTab + the 6 practice drills (speech/mimic/feelings/journey/adventures + DevelopmentCopilot) and practice worlds; LanguageLabTab(+Vocab), PlansTab, DailyPlayTab, Screening(+Sheet), DevelopmentCopilot. DevelopmentTab/MilestonesTab/Strengths already on Icon — verify. **Internal sub-design:** Practice = one tile grid (no per-drill pill).
- **Slice D — Journal:** JournalTab (Icon ✓), StoryTimelineTab reskin.
- **Slice E — Academy:** Masterclasses (Icon ✓), HeroJourneyTab(stories), HeroComicsTab(comics), BedtimeStoriesTab reskin; wire Comics + Family as in-hub tiles. FamilyFormation already Icon.
- **Slice F — Ask Arbor:** CoachTab (Icon ✓) — confirm Scholar lens is in-hub; ScholarTab/ScholarHubCard reskin.
- **Slice G — Care Network:** ConsultTab reskin (PRIMARY, high priority) + absorb reports/handoff/find-pro export steps; SchoolBrief, Reports, HandoffTab reskin. CareTeam/FindProfessional/Appointments/TrustedSharing already Icon — verify sage layout.
- **Slice H — Profile:** ChildProfile (Icon ✓), ChildMemory, WeeklyTab, SciencePage reskin; Arbor Plus under Settings; AttributionTab (admin, last).

**Dependency:** foundation slice before all hub slices (so nav wiring + tests are green). Hub slices A–H are mutually independent (disjoint files) and can be parallelized.

---

### Appendix — duplications this UC removes (summary)
1. `behaviors` reachable 3 ways (category + "Log a Moment" + "Behavior Logs") → **1 way** (category) + a topbar quick-action.
2. `profile` reachable as category + "Arbor Plus" drawer entry → category; Arbor Plus under Settings.
3. `science` drawer entry highlighted Care but is a Profile/trust page → fallback re-homed to Profile.
4. 18-item drawer (with category echoes) → ≤13 genuinely-secondary entries, none equal to a hub primary.
