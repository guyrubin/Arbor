# Growth / My child capability audit

Read-only review, 9 October 2026. Inspected `bd11f040f600a797b6d7e20450a742b0ada8f61c` plus the working tree. Baseline: production `286295344c4c98aec3d809da5e701d0ed8dd0723`. This is a code and prior-decision audit, not a rendering or production certification. No tests, browser interaction, child writes or production code changes were performed by this reviewer.

**Verdict: Growth was moved into My child, not removed by the augmented-input work. The existing canvas is preserved, but “the whole picture” is not yet a defensible claim of complete historical coverage or four-level semantic depth. Fix the concrete source/record defects below before calling the experience complete.**

## What the active application actually mounts

`Shell.tsx:95` imports `companion/ChildPortrait` as `DevelopmentTab`; `Shell.tsx:607–608` mounts it for `#/development`. The old `tabs/DevelopmentTab.tsx` remains on disk but is not the mounted Growth home. The current PR has no diff from the production base in ChildPortrait, portraitModel, useObservations, observations, MilestonesTab, ChildProfile or ProgramPage. Claims based only on old DevelopmentTab files therefore do not prove active capability access.

| Job | Active, reachable path | Status and evidence |
|---|---|---|
| Open the whole-child view | Desktop sidebar / mobile My child → `development` | Preserved. `companionPlaces.ts:4–7`, `Sidebar.tsx:79–89`, `MobileNav.tsx` primary places, `Shell.tsx:608`. |
| Read changes across time | My child → Time → three dated chapters / eight domain rows | Preserved. `ChildPortrait.tsx:168–188`; calendar grouping in `portraitModel.ts:11–28`. Marks represent records, not child ability. |
| Compare settings | My child → Context → recorded setting → source list | Preserved. `ChildPortrait.tsx:191`; explicit context only in `portraitModel.ts:36–44`. Non-moment records are grouped as unspecified, not inferred to be home or school. |
| Browse all eight domains | My child → Domain → selected domain | Preserved. `ChildPortrait.tsx:193–196` iterates canonical `DOMAIN_IDS`. Selection opens a flat source list, not sub-area/capability zoom. |
| See actual photos | Chapter feature and source detail | Preserved for `behaviorLogs.photoAttachment`. `ChildPortrait.tsx:170–176,203`. Profile avatar also uses actual `photoUrl`. No invented family image is generated here. |
| Read original moment | Chapter / domain cell → source detail → original | Exact editor access is preserved for behavior logs (`ChildPortrait.tsx:144–146`). Other source destinations lose exact identity; see finding 3. |
| Browse milestones, record firsts, notices, optional checks | My child footer → Milestones / Development check | Visible doors at `ChildPortrait.tsx:199`, active routes in `Shell.tsx:139,183`. Milestones still includes its shelf map, first-keepsake sheet, date/answer controls, custom milestones and explanations. |
| Record language / words | My child footer → language | Visible door at `ChildPortrait.tsx:199`, active `LanguageLabTab` route. Broad “Talking” domain also contains words but does not replace this editor. |
| Open programs | My child footer → Programs | `ChildPortrait.tsx:199` sets `#/development?view=program`; Shell mounts `ProgramPage` for that query. |
| Edit profile / interests / strengths / measurements | My child identity button → profile | `ChildPortrait.tsx:155`; ChildProfile retains strengths/support, languages, physical measurements and editor. Strengths are not currently surfaced on the portrait introduction; only interests are. |
| Review saved memory | My child footer → What Arbor remembers | Visible door at `ChildPortrait.tsx:199`; active `ChildMemory` route; review/edit/remove remains there. |
| Full chronological record / story density | My child → All moments / footer Journal → density toggle | Visible at `ChildPortrait.tsx:180,199`; `TimelineTab.tsx` mounts Journal/Story from the same `useTimeline` read. This is not complete history past server read limits. |
| Prepare and share with others | My child → care-team; desktop care entrance | Existing care-team route resolves to the shared roster; care section pills provide Consult, school brief, sharing, appointments and safety. Desktop Sidebar also has Consult directly. |
| Legacy full-picture copilot / deep reports | Global search → route by name | Routable and indexed, but no visible door from My child. Old DevelopmentTab's copilot teaser is unmounted. Do not claim a directly discoverable My child entrance merely because search indexes the route. |
| Weekly reflection | Global search; Today section secondary route | Route survives. Now is a companion home and suppresses the old Today pills; old OverviewTab weekly cards are unmounted. No direct weekly reflection link exists in the inspected Now/My child compositions. |
| Day context and general science | Settings → Day windows / Science | Retained explicit Settings doors (`SettingsModal.tsx:276,479`). These are not the same as portrait context comparisons. |
| Talk about selected evidence | Source modal → Explore this with Arbor | Currently opens a new family-question form via `Shell.createTopic`; after saving, its Talk action can open the companion. Only title/intent enter AI context; selected source text is deliberately excluded. See finding 4. |

All non-retired route IDs are intentionally indexed through `searchIndex.ts:155–218`; `useSearchResults.ts:137–140` displays a zero-query route list and its result handlers navigate. That is a real emergency access path, not a substitute for task-specific visible doors.

## Concrete findings

### 1. Generic moments are silently classified as feelings

**P1, existing production defect, exposed by the new portrait.** `domains/registry.ts:254` maps the neutral `Moment` type to `feelings`; `observations.ts:190` additionally defaults unknown/unfiled types to feelings. QuickLog's plain-moment path supplies a shelf only when the caller explicitly supplies one (`QuickLogModal.tsx:441–444`). A photo of a block bridge or neutral birthday note therefore appears in feelings even when the parent never chose that domain.

Fix the read model to preserve neutral/unfiled moments without assigning a developmental meaning. Keep them visible in dated chapters, contexts and all-record detail with an explicit “not linked to an area” treatment. Retain parent-confirmed shelf mappings and the curated mappings for actual hard-moment categories. Do not replace the incorrect default with an inferred text classifier or with `family` as another arbitrary catch-all. `toObservations.push` currently drops `domains.length === 0` at line 165, and the featured icon reads `domains[0]`; both require deliberate handling if an unfiled observation is represented by an empty domain list.

### 2. “Full record” is a bounded recent read, not full history

**P1 for the completeness claim; existing production limitation.** `useObservations.ts:32–41` caps growth/language/goal sources at 200, speech/adventure at 500, practice at 800 and mimic/mission at 300. Inherited Context reads additionally cap moments at 300, play at 200 and action loops at 100 (`ArborContext.tsx:365–391`). `ChildPortrait` range 0 recomputes buckets from only those loaded rows. Its More button (`:204`) merely raises a local display slice by 20. No network pagination occurs. `useObservations` discards each collection's `loaded` flag, so loading can also look like absence of recorded evidence.

Required implementation: expose load state and source coverage from the read model; provide child/account-scoped older-record pagination or an equivalent explicit history loader, retaining record IDs and current source permissions. The portrait must distinguish loading / partial history / fully loaded / empty. Check at least one family with more than the source limit, cross-limit language and moment entries, and child switch during an older-page request. A scope label is an honest immediate mitigation, but is not proof that complete-history functionality is delivered.

### 3. “Open original record” loses identity for most source types

**P2, existing production defect.** `ChildPortrait.tsx:144–148` passes an ID only for behavior logs. Milestones/keepsakes navigate to generic Milestones, words to generic Language, measurements to generic Profile, memory to generic Memory, and several practice/action types to generic Journal. The source list's generic “Practice” / “Check” titles further hide distinctions (`:130–132`).

Journal does include practice/play/actions/mission records through `useTimeline`; the problem is not that those collections are missing. Many are folded by date. Reuse a shared source-destination adapter that retains the exact record, or show the complete original typed record inside portrait and name any separate generic link honestly. Journal already has `requestJournalFocus` (`ArborContext.tsx:290`) and a highlight/scroll seam (`JournalTab.tsx:351–369`). Map observation IDs to actual timeline signal IDs and account for `timelineFold.ts:89` day grouping. Do not fabricate a deep link unsupported by the destination editor.

### 4. Explore-with-Arbor does not discuss the displayed source evidence

**P2 product gap, explicit current limitation.** `ChildPortrait.discuss` passes a generic domain question and IDs to `onDiscuss`; Shell passes `createTopic`, which opens a mandatory saved-question form (`Shell.tsx:229–231,608`). `FamilyTopicSheet.tsx:47,63–73,87` requires saving the question before its dedicated Talk action exists. `familyTopicContext.ts` passes only title, intent and update date, explicitly excluding observation text. The model cannot actually compare the selected moments from this flow.

Current copy partially discloses this restriction, so this is not an undisclosed server data use bug. To fulfill contextual input, allow a direct conversation alongside the evidence with an explicit, reviewable source attachment and retained provenance; treat the selected record as untrusted data through the existing consent/context policy. Saving a persistent family question should remain optional. Do not silently put all private notes into the prompt to make the interface seem smarter.

### 5. Completeness and depth have weaker discovery than the three-home navigation suggests

**P2 discoverability.** Copilot/report export and weekly reflection remain findable in global search, but the My child/Now composition removed the old obvious entrances. Parent strengths, relationships/language context and body routines are mostly behind Profile or secondary pages, while the portrait introduction shows name/photo/interests only. Preserve the cleaner three homes, but provide a compact, visible “Record and understanding” path to weekly reflection, deep report/export and relevant profile details. Do not reinstall all legacy modules simply to count files as preserved.

## Semantic zoom: what was discussed versus selected

ROS `PAI/projects/arbor/reference/design-registers-and-ia.md:60` calls the whole-child → domain/sub-area → observable capability → source mockups static concepts and explicitly not approval. Lines 62 and 69–72 enumerate missing mappings/labels/history loading, estimate 8–12 developer-days for the first connected language slice and 20–30 for all-domain depth, and state that the mockup request did not authorize implementation at that point. `REJECTIONS.md:1238–1248` records rejection of PR110 and no selection of the prior diagram alternatives.

The user later authorized building the broader experience. The implementation-status section at lines 202–204 describes the actual shipped first slice as the eight-domain time/context/domain portrait and explicitly says the broader interpretation graph was not delivered. The active ChildPortrait imports no sub-area or capability model. Therefore:

- No evidence supports claiming that the user selected a particular atlas mock or that a 42-sub-area semantic atlas was delivered and later removed.
- The shipped visual comparison canvas survives unchanged in this PR.
- Four-level semantic zoom remains incomplete against the broader ambition. It should not be certified by the existence of 42 metadata IDs in the registry, or by rendering a menu of those IDs with no governed mapping.
- A useful next implementation uses parent-confirmed mappings and known source metadata, leaves unmapped records explicit, and makes one full domain/capability/source journey real before asserting depth across all domains.

## Verification needed after fixes

Root should render and interact with EN/HE desktop/mobile portrait views, neutral and domain-filed moments, an actual saved photo, an older-than-limit record, exact-source navigation, optional selected-source conversation, profile/memory/program/weekly/report entrances, and child switching with open detail/history requests. Include source loading and empty-state behavior. No rendering pass is claimed by this audit. Decision: preserve the current three-view canvas, repair truthfulness/source access first, and keep the unbuilt semantic-depth scope explicit.
