# Whole-app capability and AI code audit — 9 October 2026

Read-only independent review of the working tree during the release, through `1d2ebf44578ab0d42666e4b185c8dca972bea556`. This is code evidence, not a rendered or production certification. Capture and Growth depth have separate audits. Findings below describe the inspected snapshot; release remediation must be verified separately.

## Verdict

The three-place architecture preserves the route manifest and most substantive capabilities. It does **not yet prove complete capability access**: Weekly, Full picture/Copilot and Full record have lost their deliberate parent entrances. Search still finds them, which makes the existing reachability test too permissive to establish the user's requirement. The attached-file conversation also needs a usable consent path and council continuity before it can be called fully functional.

## Complete route inventory

The canonical manifest has 43 IDs. Retired IDs and duplicate registry components are compatibility entries, not independent missing screens. `Shell.tsx` selects the current components; `isCompanionHome` suppresses the old hub pill row on Now, My child and Together. Paths below describe reachable current components, excluding old unmounted Overview/Development/Practice launchers.

| Route | Job and current visible entrance | Assessment |
|---|---|---|
| overview | Now; primary sidebar/mobile navigation | Present |
| coach | Persistent companion launcher on parent screens; old URL opens that companion above Now | Present; no dedicated navigation tab required |
| behaviors | Moment patterns and generative behavior analysis; mobile More → Behaviors; desktop My child → profile → Moments, or Consult → behaviors | Present, unnecessarily buried on desktop |
| milestones | Noticed capabilities and keepsakes; My child record tools | Present |
| plans | Action plans and routine templates; Behaviors pill, profile support chapter, answer → save to plan | Present |
| stories | Story library; Together story card | Present |
| weekly | Weekly reflection/report | **Search-only from the three new homes; missing Now entrance** |
| scholar | Retired to coach; perspectives retained in ToneSheet | Intentional alias |
| language | Language observations/strategies; My child tools and Together Word World | Present |
| handoff | Registry alias of Consult; old links remain valid | Intentional alias |
| safety | Governed immediate help; persistent desktop/mobile safety ring and Care pill | Present |
| profile | Editable child narrative, physical growth and goals; My child identity; mobile More | Present |
| memory | Review/approve/reject/forget child facts; My child tools and Profile pill | Present |
| strengths | Retired to profile strengths/support chapter | Intentional alias |
| screening | Parent development check; My child tools and Growth leaf pills | Present |
| timeline | Rich density of Journal, same record component | Intentional alternate density |
| journal | Saved observations/record shelves; My child recent record → all, tools, mobile More | Present |
| find-pro | Retired to Consult; no fabricated marketplace | Intentional alias |
| care-team | TrustedSharing registry alias; My child care card | Present through shared roster |
| appointments | Family's appointments; Care pill | Present |
| sharing | Permissioned roster and co-parent/share controls; Care pill and Profile | Present |
| reports | Full parent record and five parent exports | **Only direct component links are inside hidden Copilot; effectively search-only** |
| masterclasses | Parent courses; sidebar “For you, the parent”, mobile More → Learn | Present |
| family | Family rituals; Learn pill and Together → all stories | Present |
| comics | Illustrated story library; Stories pill, Together → all stories | Present |
| learn | Curated reading; Now footer, Learn pill, answer → related read | Present |
| speech | Parent speech tools; Language Lab button; Hebrew game fallback; search | Present; English game preview uses Kid Mode |
| mimic | Camera mirror practice; Together game preview enters existing Kid Mode seam; parent standalone route via search/source history | Capability retained; current launcher behavior matches prior studio |
| feelings | Emotion play; Together game preview enters existing Kid Mode seam; parent standalone route via search | Capability retained; current launcher behavior matches prior studio |
| journey | Retired to practice; historical records retained | Intentional retirement predates release |
| adventures | Adventure play; Together game preview enters Kid Mode; parent standalone route via search/source history | Capability retained; current launcher behavior matches prior studio |
| copilot | Full picture and goal synthesis | **Only direct entry is old, unmounted DevelopmentTab; missing My child entrance** |
| development | Whole-child portrait and source trail; primary My child navigation; `?view=program` mounts ProgramPage | Present; depth/source audit separate |
| daily-play | Eligible daily activities; Together → more ideas, Growth leaf pills | Present |
| practice | Together discovery/previews; primary navigation | Present |
| consult | Prepare a visit, professional recommendations/home program, reviewed packet | Sidebar care, Now footer, companion handoff; present |
| attribution | Operator metrics | Settings admin gate; intentional non-parent surface |
| day-windows | Read-only daily rhythm | Settings; retained |
| smart-reminders | Parent reminder preferences | Settings; retained |
| science | Sources and trust explanation | Settings and contextual TrustLink/EvidenceChip; retained |
| school-brief | Curated teacher-facing brief | Care pill and Consult handoff; retained |
| bedtime-stories | Create/preview a day-rooted bedtime story | Together story card; retained |
| routines | Retired to Plans templates | Intentional alias |

Supporting source: `app/src/lib/routes.ts`, `navigation.ts`, `companionPlaces.ts`; `components/layout/Shell.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, `SettingsModal.tsx`; `components/companion/NowView.tsx`, `ChildPortrait.tsx`, `TogetherView.tsx`, `companionChoices.ts`; `components/practice/studioWorlds.ts`.

The current `routeReachability.test.ts` accepts search entries, hash aliases, and navigation literals in **any** component, even an unmounted component. Thus its green result cannot certify visible entrances in this new architecture. A regression check should trace entrances from the current homes or an explicit live capability map.

## AI and cross-screen findings

| Requirement | Observed implementation | Evidence / remaining issue |
|---|---|---|
| One conversation across parent screens | CompanionWorkspace wraps the routed page and retains one CoachTab instance; normal navigation changes page without clearing thread/draft | Present in code; root owns rendered verification |
| Child isolation | Workspace closes/unmounts on child change; composer is child-keyed; context clears chat and aborts in-flight request; `isCurrent` protects response writes | Present in reviewed seams |
| New/history/topic isolation | conversationRevision clears attachments and stops dictation/live voice; history clears text draft; new topic starts a distinct thread | Present in reviewed seams |
| Text/photo/PDF | Shared composer; bounded 3-file, 4 MB each / 6 MB total MIME+signature validation; endpoint checks child ownership/matching ID | Present in code |
| File consent | `/chat` requires `face_processing`; 451 opens profile | **P1: the only grant path found is AvatarCreator/runAvatarGeneration. A PDF parent must enter an unrelated avatar-photo flow. Provide an explicit image/document permission flow beside the pending draft, with truthful language and revocation access. Never auto-grant on upload/send.** |
| File continuation | Original bytes are ephemeral; history keeps allowlisted metadata and fallible interpretation marker; typed/voice prompt gets original-unavailable rule | Deliberate boundary, properly disclosed; not persistent original-file retrieval |
| Council / Go deeper | Every structured report exposes Go deeper; callback uses current `handleCouncilSend()` | **P1: council sends no recentTurns or attachment interpretation. A file-derived report's follow-up loses its grounding. Older report buttons also re-ask the latest user turn rather than their own question. Bind answer/question context and reuse sanitization/unavailable-file policy.** |
| Failure recovery | Ordinary errors restore text and preserve composer attachments; attachment retry deliberately requires composer Send rather than text-only Retry | **P1: 402 branch returns false before catch without restoring cleared chatInput. Text+photo becomes files-only. Restore draft before returning.** |
| Dictation | Editable draft, visible recording/interim text; no auto-send; stop on hide, new/history and unmount | Code lifecycle present; microphone hardware not certified here |
| Realtime/fallback voice | Same thread context builder; cancellable lifetime; stop invalidates pending token, mic/socket and late verdicts; screened response path | Code seams present; real microphone/audio/provider deployment needs actual verification |
| Report completeness | One CoachAnswerCards owns summary, full hypotheses/rationales, all steps, script/watch/avoid and safety; Markdown is fallback only when no contract | Presentation duplication removed in code; runtime/model quality requires live evaluation |
| Advice vs observation | Inline keep routes through explicit review/provenance; model attachments skip automatic memory proposals; memory remains an explicit parent control | Boundary retained in inspected attachment path |
| Immediate danger | Text escalation checked before model call; attachment consent exception only lets the governed urgent response run, not file analysis | Retained; malformed attachment validation still precedes urgent handling |
| Private record access | Server ownership, purpose checks, approved-memory gate; raw behavior notes excluded from bulk companion context; weekly context bounded counts | Retained in relevant inspected seams, not a full security audit |
| Parent/kid seam | Together preview calls useKidModeEntry; Kid Mode hides/unmounts companion, including files/voice | Present in code |
| Together outcome persistence | Offscreen “already tried” awaits saveMoment, catches throw | Capture audit discovered underlying persistence false-success; apply same corrected save seam here. A late error can also become visible after child change unless scoped/reset. |

Together currently carries the family topic title but does not project the parent's selected next action/program. This is an architectural limitation rather than a navigation loss: Now owns the current action; Together remains a discovery collection. If the release claims one chosen action is projected consistently across Now and Together, it needs implementation and proof rather than that claim.

## Release proof still required

1. Resolve and re-read the missing doors, consent path, council continuation and quota draft restoration.
2. Exercise representative useful journeys through Now → My child → source → conversation → selected action; Together preview → correct parent/kid destination; Care → import recommendation → reviewed export; Learn → read → grounded question. Route declaration alone is insufficient.
3. Render HE/EN desktop/mobile including long answers, permission refusal, file retry, keyboard focus and modal transitions; use actual 390 px evidence.
4. Exact final-commit cloud gates and live AI evaluations, followed by matching deployed frontend/API SHA and production smoke validation.

No production files were edited by this auditor. No full suite, local TypeScript, or browser actions were run for this review.
