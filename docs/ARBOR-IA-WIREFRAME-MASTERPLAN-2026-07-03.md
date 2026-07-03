# Arbor IA & Wireframe Master Plan

**Date:** 2026-07-03 · **Status:** CANONICAL — supersedes the IA portions of all prior design docs; carries (does not replace) their locked constraints.
**Inputs:** 3-agent analysis — live-app IA audit (44 routes) · Claude Design prototype extraction (`Arbor-Web-App.dc.html`, project 6ddac523) · redesign-canon constraint map (UC-1 plans, KID-MODE plan, PROD-RECONCILE plan, IA docs 06-07/06-14, PRODUCT-REDESIGN-STRATEGY via memory — the strategy file itself is MISSING on disk and needs recovery).

---

## 1. Diagnosis — why it feels "all over the place"

The problem is not missing capability. It is **capability without one visible, non-circular home**:

1. **44 valid routes, 18 visible.** 13+ screens (Screening, Memory Review, Weekly Report, Reports, Find-a-Pro, Day Windows, Smart Reminders, The Science…) are deep-link-only. Parents cannot see they exist.
2. **Hub recursion.** Development, Practice, and Consult are hubs whose sub-screens are *also* routes that silently redirect back into the hub. A capability exists in two places, one invisible. `#/handoff` silently renders Consult. `#/milestones` silently renders inside Development.
3. **Duplication without contract.** 3 story surfaces (Story Journeys / Bedtime Story / Hero Comics), 4 assessment surfaces (Milestones / Screening / Behaviors / Memory), 2 timeline feeds (Story vs the new Journal), a Development summary card rendered in multiple homes.
4. **Three IAs live at once.** Prod `main` = 5 sections/18 items · `claude/uc1-design-impl` = 8 sections/33 items (unmerged) · the design prototype = 8 flat items + sub-tab pills. Plus 3 competing mobile-overflow mechanisms across docs.
5. **Naming drift.** Route ≠ label ≠ component (`#/behaviors` labeled "Moments"; `#/timeline` labeled "Story").

## 2. Hard walls (carried, non-negotiable)

- **Clinical firewall.** No %, no verdict tags, no trend deltas, no deficit pointers on child-data parent surfaces. Bars = **milestone counts (checked/total)**. No intensity time-series. Binary checked/unchecked (no tri-state). The prototype is %-first everywhere — **every wireframe below transposes % → counts.** Growth signal framing (ring, band chips, weekly trend) requires clinical-board sign-off before build.
- **UC-1 locked forks.** Layout/IA only (keep Fraunces/Nunito, lucide, tokens — never Material Symbols, never raw hex) · parent-only (kidmode/playkit untouched; Overlay outside `.arbor-parent`) · zero regression (all ~45 routes stay valid; design mocks are thinner than prod — never naive-replace richer surfaces) · all screens one pass.
- **Two registers.** Parent kit tones (`mint|coral|lav|yellow|pink|sky`) vs PlayKit tones (`clay|lav|sky|yellow|pink|peach`) never cross. Kid theming via `data-world` on `.arbor-play` root only.
- **RTL/a11y/i18n.** Every string `t()` en+he, logical properties, 44px targets, reduced-motion gates, AA contrast (sapphire `#2b7fff` fails AA for body text — UI components only).
- **Kid dark-pattern ban.** No streaks/🔥/countdowns/leaderboards/loot-boxes/child-facing share. `cosmetics.ts` streak-title fix stays P0-blocking.
- **Peterson = never branded.** **Prod-promote = Guy's Level-3 gate.** **`:root` palette locked**; green-vs-sapphire flip is a held Guy decision — this plan is accent-agnostic (all specs in tokens).

## 3. The canonical IA — "One tree, two levels, zero shadows"

**Structural laws** (these answer the no-recursion / all-surfaced requirement):

- **L1 — Flat nav.** 8 top-level categories (the prototype's model). No section-with-items accordion.
- **L2 — Max two levels.** Category → sub-tab pill row (prototype's `Overview + feature pills` pattern). Nothing navigable lives deeper. Within a screen, capabilities appear as **visible cards** — never a third tab layer.
- **L3 — One home per capability.** Every route has exactly one visible pill or card. Old routes stay valid as redirects (zero regression) but each redirect target displays the capability visibly.
- **L4 — No circular nav.** Cross-links are one-directional "feeds into" notes (prototype's tinted cross-link block). Coach inline affordances deep-link INTO Ask Arbor; Ask Arbor never re-hosts other screens.
- **L5 — Route = label = component.** Naming drift fixed in one sweep (`behaviors` label "Behaviors", `timeline` label "Story", etc).

### Desktop sidebar (top → bottom, prototype order)

| # | Category | Icon (lucide) | Sub-tab pills (first = Overview) |
|---|---|---|---|
| 1 | **Today** | Home | Overview · Day Windows · Reminders |
| 2 | **Journal** | PenLine | Feed (Overview) · Story · Weekly Report · Memory Review |
| 3 | **Behaviors** | Activity | Overview (log + recent + patterns) |
| 4 | **Growth** | Sprout | Development Map (Overview) · Milestones · Quick Check (screening) · Language · Practice · Daily Play · Plans |
| 5 | **Academy** | GraduationCap | Learning Map (Overview) · Masterclasses · Story Journeys · Bedtime Story · Hero Comics · Family Formation |
| 6 | **Ask Arbor** | MessageCircle (badge: unread) | Chat (Overview) — scholar lens = visible control inside chat |
| 7 | **Care Network** | HeartHandshake | Share with a Pro (Overview, = Consult + Reports + Find-a-Pro visible) · School Brief · Care Team · Sharing · Appointments · Safety · The Science |
| 8 | **Profile** | UserCircle | Child (Overview) · Family Circle · Arbor Plus · Settings |

**Sidebar footer:** Kid Mode launcher — gradient card "Kid Mode / {child}'s world" (prototype pattern) + parent row (avatar · plan · settings gear). Kid Mode stays an overlay outside `.arbor-parent`, entered here and from the topbar toggle.

**Topbar:** page title+subtitle · search · notifications · **child switcher**. Ask Arbor moves from topbar pill → nav row #6 (prototype). The Today coach card and future `<AskArborInline>` embeds remain as *entry points into* the one coach destination (L4 keeps this non-recursive).

**Mobile:** 5-slot bottom bar — **Today · Growth · Ask Arbor · Journal · More**. "More" opens a sheet listing Behaviors · Academy · Care Network · Profile · Kid Mode. This retires both the `MoreHubTab` tab concept and the old 5-section mapping; one overflow mechanism only.

### Full capability → home matrix (all 44 routes; L3 audit table)

| Route | New home | Visibility |
|---|---|---|
| overview | Today › Overview | nav |
| day-windows | Today › pill | pill |
| smart-reminders | Today › pill | pill |
| journal | Journal › Feed | nav |
| timeline | Journal › Story pill | pill |
| weekly | Journal › Weekly Report pill | pill |
| memory | Journal › Memory Review pill | pill |
| behaviors | Behaviors › Overview | nav |
| development | Growth › Development Map | nav |
| milestones | Growth › Milestones pill | pill |
| screening | Growth › Quick Check pill | pill |
| language | Growth › Language pill | pill |
| practice | Growth › Practice pill → 4 visible drill cards | pill + cards |
| speech / mimic / feelings / adventures | cards on Practice (routes valid, render with drill open) | card |
| daily-play | Growth › Daily Play pill | pill |
| plans | Growth › Plans pill | pill |
| copilot | "Now" strip on Development Map Overview | card |
| journey | merged into Journal › Story (route redirects) | redirect |
| strengths | section on Profile › Child | card |
| masterclasses | Academy › pill | pill |
| stories | Academy › Story Journeys pill | pill |
| bedtime-stories | Academy › Bedtime Story pill | pill |
| comics | Academy › Hero Comics pill (viral studio) | pill |
| family | Academy › Family Formation pill | pill |
| coach | Ask Arbor › Chat | nav |
| scholar | lens picker control inside Chat | control |
| consult | Care › Share with a Pro (Overview) | nav |
| reports | visible export cards on Share with a Pro | card |
| find-pro | visible pro list on Share with a Pro | card |
| handoff | redirect → Share with a Pro (kept, L3-visible there) | redirect |
| school-brief | Care › pill | pill |
| care-team | Care › pill | pill |
| sharing | Care › pill | pill |
| appointments | Care › pill | pill |
| safety | Care › pill | pill |
| science | Care › The Science pill (+ Settings footer link) | pill |
| profile | Profile › Child | nav |
| attribution | Settings › admin-gated row (documented exception — the ONLY non-surfaced route, by design) | gated |
| Kid Mode (not a route) | sidebar footer launcher + topbar toggle | nav |

**Guard test (extend the existing nav guard):** every `ActiveTab` must resolve to a visible pill/card/nav entry or be on the documented exception list (`attribution`). CI fails on any new shadow route.

## 4. Screen wireframes (prototype grammar, firewall-transposed)

Shared grammar from the prototype: white 22px-radius cards on cool canvas · hero module (gradient header, uppercase eyebrow, ghost icon, footer CTA strip) · ring gauge · stat trio · two-line list rows · pill sub-tabs · tinted cross-link notes · one primary CTA per screen. All colors via tokens; all % displays transposed to counts.

1. **Today** — Row 1: [Guidance hero: eyebrow "TODAY'S GUIDANCE", one action, "Begin" CTA] | [Development Map card: ring showing **X of Y milestones** (count, not %), stat trio Focus·Domains·Week]. Row 2: [{Child}'s activity live feed (kid-world sync rows)] | [Coach card → Ask Arbor]. One guidance, one action per day.
2. **Journal › Feed** — composer card ("Log a moment" — Voice/Photo/Text triad, no forms) above the unified feed; auto-entries carry the ARBOR badge. **Story pill** = the narrative spine (compiled arcs, memory-review card, weekly digest entry). Contract that kills the redundancy risk: **Feed = capture & raw stream · Story = compiled narrative**; both read `buildTimeline`, neither duplicates the other's controls.
3. **Behaviors** — [warm hero: THIS WEEK + stat trio (flat counts — no intensity series)] | [Log card: same Voice/Photo/Text triad, shared component with Journal]. Below: Recent events (expandable rows → trigger chips + co-regulation script quote) | Detected patterns + navy cross-link "Feeds the Development Map".
4. **Growth › Development Map** — left: big ring (**counts**) + "Now" copilot strip. Right: 7 domain rows (icon · name · **N of M noticed** · chevron) → drilldown: skill checklist, **binary** checked/unchecked, sync note "Marking a skill feeds the Map, Academy & Care Network". Practice pill = 4 large drill cards (Speech/Mimic/Feelings/Adventures) — visible, not tabbed.
5. **Academy** — left: Learning Map card (course-progress ring — course progress is parent-effort data, % allowed here; domain mini-bars) · right: course grid matched to Development-Map gaps (non-deficit framing, board-cleared copy). Stories pills host the 3 narrative surfaces with distinct jobs: **Journeys = beat-by-beat personalized comic · Bedtime = tonight's story · Hero Comics = batch studio & share artifacts (the viral surface)**.
6. **Ask Arbor** — centered chat column, quick-reply chips, scholar-lens picker as a visible control row, per-answer ShareButton preserved. Badged nav row; ambient entries from Today card and (wave-4) inline embeds.
7. **Care Network › Share with a Pro** — left: "Your summary" packet (redaction controls preserved — richer than prototype, never simplified away) + GDPR trust note; right: verified pros list + "Request consult". Reports export cards visible on this screen. Other pills per matrix.
8. **Profile** — child card (avatar via shared HeroAvatar engine) + strengths section · Family Circle roles · Arbor Plus (Free/Plus comparison) · Settings (language, notifications, admin-gated attribution, Science footer link).
9. **Kid Mode overlay** — per KID-MODE plan (unchanged by this doc): greeting + star meter (monotonic, no streaks) · Today's Quest (1/day, terminal state) · rooms · games · stories; parent-gated hold-to-exit.

## 5. Arbitrations of the open questions

| # | Question | Decision |
|---|---|---|
| D1 | 6 vs 8 sections, mobile 5 | **8 flat (prototype) desktop · 5+More sheet mobile** |
| D2 | Journal vs Story vs Behaviors | Journal=capture/feed · Story=narrative pill inside Journal · Behaviors=patterns+scripts (own category) |
| D3 | Kid Mode entry | Sidebar-footer gradient launcher (prototype) + topbar toggle |
| D4 | Academy vs Growth | Peers. Growth=child skill-building · Academy=parent learning + story studio; courses matched to Map gaps via shared 7-domain taxonomy |
| D5 | My Child dissolution | Leaves re-homed per matrix (Development/Milestones/Language→Growth · Story/Weekly/Memory→Journal · Strengths→Profile) |
| D6 | Mobile overflow | Top-5 + More **sheet**; `MoreHubTab` retired |
| D7 | Ask Arbor nature | Destination (nav row, badged) + ambient entry points; inline embeds are entries, never hosts (L4) |
| D8 | Where the record lives | **Development Map = the record's home**; Profile shows identity, Story shows narrative; `useChildRecord` centralization stands (wave-8) |
| D9 | Dev summary card home | Today card + Growth Overview ring only; nowhere else |
| D10 | Branch merge order | **W0 token-unify → rel/kidmode/prod → uc1-design-impl (rebased to this IA)** — each merge Guy-gated |
| D11 | Growth signal framing | IA space reserved; build blocked on clinical-board sign-off (unchanged) |
| D12 | Canonical design target | The local handoff export (`Arbor-Web-App.dc.html`) for layout/IA; remote claude.ai/design kit for visual tokens — conflict resolved by the layout-only fork |

## 6. The viral layer (woven into the IA, not bolted on)

| Mechanic | IA home |
|---|---|
| Avatar-everywhere (shared HeroAvatar engine) | Kid tiles + Profile child card + milestone celebrations |
| Hero Comics batch studio (THE share artifact) | Academy › Hero Comics pill — one tap → catalog as shareable pages |
| Parent-mediated share (child never shares) | Post-gate celebration + parent share queue; ≤1 prompt/session; provenance-carrying path |
| Collectible worlds (`kidThemes.ts`) | Kid Mode; each unlocked world card = a ready parent-share artifact |
| Daily quest (bounded, 1/day) | Kid quest hero ← parent "assign activity" on Growth |
| Weekly Report / Hero Card compounding | Journal › Weekly Report pill; auto-log feeds it |
| Coach answer cards + referral InviteCard | Ask Arbor rows; Settings |
| Streak dark-pattern fix | P0, blocks kid-dashboard merge (unchanged) |

Simplicity is the viral feature on the parent side: one guidance/day, capture-in-a-breath, one share affordance per artifact.

## 7. Sequencing

1. **P0 (unblock):** streak fix (already on kidmode branch) · recover/re-derive PRODUCT-REDESIGN-STRATEGY.md into docs/ · commit this plan.
2. **M1 — Token keystone:** merge `claude/redesign-wave5-token-unify` (W0) — Guy gate.
3. **M2 — Kid Mode:** merge `rel/kidmode/prod` (no IA changes) — Guy gate.
4. **M3 — IA reshape:** rebase `claude/uc1-design-impl` onto main; conform its 8-section tree to §3 exactly (pills, matrix, naming sweep L5, guard test); wave order per UC1-EXEC (serial foundation → parallel screens → verify).
5. **M4 — Surfacing pass:** pill rows + visible cards for all former shadow routes; redirects for retired doors; extend nav guard test.
6. **M5 — Mobile:** 5+More sheet.
7. **M6 — Embedded AI (wave-4):** `<AskArborInline>` entries.
Each merge = green branch + STOP; prod-promote is Guy's Level-3 gate.

## 8. Acceptance (definition of "clear structure")

- Nav guard test: 0 shadow routes (exception list = `attribution` only).
- Depth audit: no navigable surface deeper than category→pill.
- One-home audit: grep for duplicate mounts of Dev summary / story surfaces / timeline feeds = 1 each.
- Firewall audit: 0 `%`/verdict/trend strings on child-data surfaces (existing arbor-sec gate).
- Naming audit: route == label slug == component prefix for all nav entries.
- RTL + a11y: existing Wave-1 gates re-run on every reshaped screen.
