---
type: execution-plan
project: Arbor
date: 2026-07-23
status: executing
source: 9-agent category assessment + clinical firewall (zero VETOs) — evidence: slate.json / firewall.json / synthesis.json in this folder
goal: PAI/projects/arbor/ARBOR-NEXT-LEVEL-GOAL-2026-07-23.md (ROS repo)
---

# Arbor Next-Level execution plan (2026-07-23)

Execution plan for the Arbor assessment: 68 findings across 9 categories, zero VETOs (all firewall rulings PASS or CONDITIONS — conditions baked verbatim into acceptance criteria). Because four categories reuse 'TODAY-*' ids, findings are disambiguated by category prefix: TODAY-* = Today hub, UND-* = Understand/development, KID-* = Play & kid world, CARE-* = Care/Share/Growth, PLAT-* = Platform; COACH/JRNL/CONT/CODEX ids unchanged. Wave 1 (13 entries) = all P0s plus firewall/bug items: loop-poisoning + Codex honesty bugs on Today, the WeeklyTab/reportExport/digest avg-intensity firewall breach, both mojibake fixes, the two fake controls (remind-me, GDPR delete), token-scope split-brain + dead rail toggle, kid-lock keyboard bypass + session-length dishonesty, senior-page removal from the deploy path, the four P0 HE/EN parity surfaces (screening, coach cards, trusted sharing with fail-closed scope IDs, kid-mode keys with EN fallback), and the recipient shared-view v0 (sequenced after scope IDs). Wave 2 (7 entries) = per-hub design/journey polish grouped by file locality: Today consolidation to one CTA/one headline, Understand corrected-age + derived watch points, Coach single-composer (native re-implementation of the ask-journal-clarity idea with AI-Act disclosure preserved), the full Journal spine pass (bilingual structured timeline, provenance fix, day groups, keeping the validated flat column), kid navigation/streak/art honesty, care pricing/history/roster, and platform reduced-motion + hex-creep guard. Wave 3 (11 entries) = capability/content work executable without Guy: the i18n registry migration sweep, voice/photo confirmed capture, narrative evidence deep-links, packet upgrades (observationStatus + delta + SLP/behavioral presets), the empty fail-closed media seam, coach voice transcripts + wire-or-delete ai/capabilities + real citations, governance hardening (named reviewer + content hash) with selectors and honest metadata, the hard-moment surfaces built dark against publishedHardMomentCards, guided-play schema + top-50 EN authoring + extended-duration content, the HE transcreation packet, and the AR-CAP-04 ADR. Every entry's acceptance includes: 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only. 11 Guy decisions listed (2 design ratifications, the Live-voice safety bundle, senior-page publication, branch deletions, 2 native-HE reviews, media licensing, caregiver-identity sign-off, clinical-reviewer appointment with its review queue, plus one flag-only informational). Branch triage: 6 of 8 codex branches already-merged/superseded and deletable on confirmation, ask-journal-clarity = harvest-idea-only-then-delete, v2-architecture-foundation = discard (never merge, reference only).

## Wave 1

### TODAY hub + capture loop — P0/bug fixes — TODAY-1, CODEX-2, CODEX-3, TODAY-4

Fix the adaptation-loop poisoning and the Codex honesty bugs in one Today-hub pass. Pass hasFocus (or focus?.text) into TodayActionLoop and, when no real focus exists, render an empty state with no accept CTA ('Log one moment to unlock today's step') so the ov.recoEmpty marketing fallback can never be persisted via acceptTodayAction or injected into the next focus prompt. Delete the /transition|screen time|dysregulation/i keyword-override branch (keep the legitimate format-scrub regexes and length clamp, and pin useTodaysFocus's existing verdict-strip with unit cases so the scrub provably still applies to the rendered headline — firewall CONDITION on CODEX-2). Replace the hardcoded 'Good morning' greeting and inline subtitle strings with time-of-day-aware i18n keys (today.greeting.morning/afternoon/evening, EN+HE). Re-encode app/public/assets/today/calm-transition-activity.png (2.6MB) to a <=120KB WebP at ~800px and update the reference. Implement the documented mobile sticky capture bar (order-last + sticky bottom clearing MobileNav with safe-area offset on <md, inline on lg+) — or, if rejected, correct both stale comment blocks in the same commit.

**Files:** Arbor/app/src/components/tabs/OverviewTab.tsx, Arbor/app/src/components/overview/TodayActionLoop.tsx, Arbor/app/src/components/overview/TodayRecommendation.tsx, Arbor/app/src/components/overview/QuickCaptureBar.tsx, Arbor/app/src/hooks/useTodaysFocus.ts, Arbor/app/src/lib/i18n.ts, Arbor/app/public/assets/today/calm-transition-activity.png

**Acceptance:** With zero logs or a failed focus fetch the accept CTA is absent and a unit test asserts acceptTodayAction is unreachable when focus is null; actionLoops entries can only contain AI-generated focus text; focusHeadline always derives from focus.text (no canned override); greeting varies by local hour; Today static payload shrinks by >=2.4MB with the image crisp at 2x in its 180px column; at 390x844 the capture bar stays visible above MobileNav at any scroll without overlapping nav or QuickLogModal, RTL correct. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### JOURNAL spine — clinical firewall breach — JRNL-1

Remove the avg-intensity score from every parent-visible surface per the merged firewall ruling. Replace the WeeklyTab avg-intensity line with counts only ('{n} moments · {wins} resolved' using existing winsThisWeek); drop 'Average intensity X / 5' from reportExport.ts (lines 73/86); ALSO strip avgIntensity + the intensityTrend easing/intensifying verdict class from server/digest.ts parent-visible payload and fallbackDigestNarrative ('Hard moments are easing' at digest.ts:96); orphan/delete wk.avgIntensity and beh.stats.avgIntensity i18n keys; swap WeeklyTab's three hex/rgba literals (#fff, #9a5a2a, rgba(52,178,119,.30)) for --arbor-* tokens. Extend clinicalFirewall.wave3.test.ts to scan WeeklyTab.tsx, lib/reportExport.ts and server/digest.ts for /avg.?intensity|\/5/ rendering and the easing/intensifying verdict class.

**Files:** Arbor/app/src/components/tabs/WeeklyTab.tsx, Arbor/app/src/lib/reportExport.ts, Arbor/app/src/server/digest.ts, Arbor/app/src/lib/i18n.ts, Arbor/app/src/lib/clinicalFirewall.wave3.test.ts

**Acceptance:** Extended wave-3 guard passes on WeeklyTab, reportExport and digest.ts and fails on reintroduction; packet.test.ts still green; no derived score/trend adjective renders on any parent surface; no hex literals remain in WeeklyTab. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### Encoding — mojibake fixes — JRNL-2, CARE-4

Fix the two shipped double-encoded Hebrew literals: JournalTab.tsx:248 compose-card eyebrow becomes 'רגע חדש' and Masterclasses.tsx:156 becomes 'למידה להורים' — both moved into proper i18n keys (journal.*, sec.master.*) rather than re-inlined. Migrate JournalTab's remaining inline HE/EN ternaries (header eyebrow/title/storyCopy, 'This week in the story', 'Timeline', 'moments') to journal.* keys. Sweep the repo for the double-encoding byte signature (grep -rP '\xc3\x97' app/src) and fix any siblings, then add a guard vitest that fails on the mojibake signature so it cannot regress.

**Files:** Arbor/app/src/components/tabs/JournalTab.tsx, Arbor/app/src/components/sections/Masterclasses.tsx, Arbor/app/src/lib/i18n.ts

**Acceptance:** HE Journal and Academy render clean Hebrew end-to-end; repo grep for the mojibake byte pattern returns zero hits; regression guard test in place and red on reintroduction. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### UNDERSTAND — fake 'remind me' done-state — UND-2

Make the Development Check re-check reminder real. Persist recheckDueAt (answeredAt + ~3 weeks) on the saved screening record in the existing 'screenings' child collection (ScreeningFlow already upserts there — no new capture path; screenings is in CHILD_SUBCOLLECTIONS). Surface it in the Development hub's dev-watching-pointer row as 'Re-check due' once due, and show the due date on the ScreeningFlow intro's last-check card. Rewrite the toast to claim only what actually happens ('We'll flag it here when it's time') unless push registration is actually wired.

**Files:** Arbor/app/src/components/sections/Screening.tsx, Arbor/app/src/components/tabs/DevelopmentTab.tsx

**Acceptance:** Tapping the button writes a retrievable due date; the due state is visible on re-entry in both hub and intro; no toast promises an undelivered channel; childData.subcollections guard test stays green. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### CARE — fake 'Delete child data' control — CARE-1

Wire the theatrical GDPR delete button to the real, tested erase seam. Replace window.confirm/alert in TrustedSharing.deleteData with the in-app Modal requiring typed child-name confirmation, call eraseEverything(uid, childProfile.id) (childData.ts:142, backed by POST /privacy/erase), render the returned DeletionReceipt counts (memoryEvents/shares/consents erased + erasedAt) as the done-state, then route away from the deleted child. Erasure runs through the CHILD_SUBCOLLECTIONS allow-list; this fix is merge-blocking for any trust-surface release per the firewall ruling.

**Files:** Arbor/app/src/components/sections/TrustedSharing.tsx, Arbor/app/src/lib/childData.ts, Arbor/app/src/routes/api.ts

**Acceptance:** A network-asserted test proves the click path hits /privacy/erase; DeletionReceipt rendered; zero alert()/window.confirm remaining in the file; copy in EN and HE; childData.subcollections.test.ts green. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### PLATFORM — split-brain token scope + dead rail toggle — PLAT-1, PLAT-3

Unify the theme scope so chrome and content resolve one palette: hoist the .arbor-parent custom-property block to cover the whole parent shell (add the class to the Shell page-grid wrapper, or rename the selector to .arbor-app with .arbor-play re-overriding kid surfaces — kid register separation must stay intact per the firewall ruling). This fixes the undefined --arbor-topbar-band at Topbar's render scope and collapses the two competing inks/clays/shadow systems into one. In the same layout pass, align the AI-rail breakpoints: change the Topbar rail toggle from xl:inline-flex to 2xl:inline-flex (or restore the xl rail with the narrower column) so the toggle is never a silent no-op between 1280-1535px. Note: which single primary hue wins is Guy-gated (GD-1) — this entry only removes the scope split, it does not retint.

**Files:** Arbor/app/src/index.css, Arbor/app/src/components/layout/Shell.tsx, Arbor/app/src/components/layout/Topbar.tsx, Arbor/app/src/components/layout/Sidebar.tsx, Arbor/app/src/components/layout/AiRail.tsx, Arbor/app/src/components/layout/MobileNav.tsx

**Acceptance:** getComputedStyle on Topbar shows background #eef3fb; Sidebar active row, MobileNav active ink, AiRail CTA and content pills resolve the SAME --arbor-clay; a unit test parses layout/*.tsx var() names and asserts each is declared at the applicable scope in index.css; at 1280px the rail toggle is either absent or produces a visible rail with aria-pressed matching layout; sandbox screenshots at 1280 and 390 per the arbor-sandbox recipe; .arbor-play kid scope untouched. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### KID WORLD — lock bypass + session-length dishonesty — KID-2, KID-3(UI)

Close the keyboard bypass on the Kid Mode lock: while isKidModeOpen, set inert + aria-hidden on the app root (Shell mount node) so Tab can never walk focus into invisible parent controls, removing it on close (or add an overlay-scoped Tab trap like ParentChallenge's); add a kidMode test asserting the shell root carries inert while open. Fix session-length honesty in the UI: DailyPlayCard always badges the picked activity's real durationMin (never the chip's range), and SessionLengthChips only renders a chip when its bucket is non-empty for the child's band (computed from PLAY_ACTIVITIES — the extended bucket is currently empty at 0/252). Authoring extended-duration activities is the wave-3 content entry.

**Files:** Arbor/app/src/components/kidmode/KidModeOverlay.tsx, Arbor/app/src/components/kidmode/kidMode.test.ts, Arbor/app/src/components/overview/DailyPlayCard.tsx, Arbor/app/src/components/practice/SessionLengthChips.tsx, Arbor/app/src/playbank/select.ts

**Acceptance:** With Kid Mode open, repeated Tab never leaves the overlay; kidMode.test.ts write-path assertions stay green; a select.test.ts case asserts every offered SessionLength has >=3 in-band activities per band and DailyPlayCard never displays a duration range the picked activity doesn't satisfy. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### CODEX — ungated senior landing page in the deploy path — CODEX-8

Move app/public/marketing/arbor-senior.html out of the hosting deploy path (relocate to docs/third-age/ as a draft asset) before the next deploy — publication as-is would be VETO-class (unvalidated HMO-connection and monitoring claims under the Arbor brand). Add a CI/test guard asserting app/public/marketing contains only an explicit allowlist of approved files. Whether the page ever publishes is Guy's decision (GD-4).

**Files:** Arbor/app/public/marketing/arbor-senior.html, Arbor/docs/third-age/

**Acceptance:** ls app/public/marketing contains no senior/third-age page; guard test fails if a non-allowlisted file appears under app/public/marketing. 1321+ tests stay green, tsc clean.

### UNDERSTAND — Development Check localization (P0 parity) — UND-1

Localize the highest-trust clinical surface end-to-end: move every ScreeningFlow/Screening UI string (answer labels, intro, CTAs, result headlines, next-step buttons, safety note, toasts, SectionCard title), the TrustSafetyBar disclaimer literal (in both ScreeningSheet and Screening), the screening item-bank prompts (lib/screening.ts AGE_BANDS, keyed per item id) and monitoring watch-note templates into app/src/lib/i18n.ts with HE translations, and migrate MilestonesTab's inline Yes/Not-sure/Not-yet button labels + not-sure hint to keys. Firewall CONDITIONS: do NOT port the 'looks on track'/'On track' verdict literals verbatim — rephrase to observational counts (or obtain explicit clinical ratification); extend the wave-3 banned-token scan to the new sec.screen.* keys. HE translations of the clinical item prompts and result framing are queued for the named clinical reviewer (GD-10) — the localization ships now since the EN content is already live.

**Files:** Arbor/app/src/components/sections/Screening.tsx, Arbor/app/src/components/sections/ScreeningSheet.tsx, Arbor/app/src/lib/screening.ts, Arbor/app/src/lib/monitoring.ts, Arbor/app/src/lib/i18n.ts, Arbor/app/src/components/tabs/MilestonesTab.tsx

**Acceptance:** No English literal renders anywhere in the check flow when uiLang=he; no wave-3 banned token ('on-track' class) in the new keys, scan extended and green; RTL intact; clinical-review follow-up note filed. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### COACH — flagship answer surface localization (P0 parity) — COACH-1, COACH-5

Move all CoachAnswerCards panel titles, FRAME_LABELS, action labels ('Save as plan', 'Teacher note', etc.), TrustSafetyBar strings in kit.tsx, and the ~8 CoachTab toasts into i18n.ts keys (HE+EN) and pass lang={uiLang} from CoachTab to CoachAnswerCards so the keyed citation/escalation strings stop defaulting to en. Fold in the COACH-5 hygiene: hoist the BehaviorsTab captureCopy table, the CoachTab memory-disclosure line and 'Fewer options' ternary into i18n keys, and replace the literal box-shadow rgba in BehaviorsTab with var(--shadow-sm). Firewall CONDITIONS: HE TrustSafetyBar/escalation strings preserve escalation semantics, stay clear of graded-risk phrasing, and the wave-3 kit.tsx guard (no 'Risk: <grade>') stays green after keying; HE strings flagged for native review.

**Files:** Arbor/app/src/components/coach/CoachAnswerCards.tsx, Arbor/app/src/components/tabs/CoachTab.tsx, Arbor/app/src/components/tabs/BehaviorsTab.tsx, Arbor/app/src/components/ui/kit.tsx, Arbor/app/src/lib/i18n.ts

**Acceptance:** With uiLang=he a contract answer renders zero English chrome (render test asserts HE strings per panel title); grep for content-string uiLang ternaries in CoachTab/BehaviorsTab returns only icon-direction picks; existing sourcesLabel/escalationTier tests untouched; wave-3 kit guard green. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### CARE — Trusted Sharing localization + stable scope IDs (P0 parity) — CARE-3

Localize the trust screen and decouple enforcement from display: introduce stable scope IDs (story_timeline, weekly_insight, + preset report types) stored on the grant, with localized labels resolved at render; move ALL TrustedSharing literals ('New share', role labels, SCOPE_OPTIONS, DURATIONS, review step, 'Approve & share', TrustSafetyBar note, roster/audit/delete strings) into i18n.ts with HE translations. Firewall CONDITION: the legacy-scope migration fails closed — an unrecognized legacy English scope string maps to NO access, never a broader default; the server enforces the stable IDs; tests cover legacy grants in both directions. Must land before CARE-2 (the recipient viewer consumes these scope IDs).

**Files:** Arbor/app/src/components/sections/TrustedSharing.tsx, Arbor/app/src/sharing/shares.ts, Arbor/app/src/lib/i18n.ts, Arbor/app/src/components/sections/Reports.tsx

**Acceptance:** Zero hardcoded user-facing English in TrustedSharing.tsx (grep check); HE flow fully translated incl. RTL chips; existing English-string grants still render but unknown legacy scopes grant nothing (tested); server tests cover legacy scope strings. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### KID WORLD — i18n keys with EN fallback (P0 parity, HE gated) — KID-1

Move every visible string in KidDashboard, KidModeOverlay, HoldExitButton and ParentChallenge (~35 strings) into a kid.* namespace in i18n.ts with the current EN values and RTL-safe interpolation. HE values stay behind the native transcreation gate (GD-6) with EN fallback — never machine-translated kid register. Firewall CONDITIONS: add a test asserting kid.* keys are never referenced from parent surfaces (register separation) and that no parent clinical framing enters kid keys; add a test asserting no bare string literals render in kidmode/*.tsx.

**Files:** Arbor/app/src/components/kidmode/KidDashboard.tsx, Arbor/app/src/components/kidmode/KidModeOverlay.tsx, Arbor/app/src/components/kidmode/HoldExitButton.tsx, Arbor/app/src/components/kidmode/ParentChallenge.tsx, Arbor/app/src/lib/i18n.ts

**Acceptance:** uiLang=he renders zero hardcoded English in Kid Mode chrome; all kid.* keys exist in both lang maps (HE may be reviewer-pending placeholders behind the lang gate); register-separation test green; tracked HE-copy TODO list produced for GD-6. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### CARE — recipient shared-view v0 (P0 capability) — CARE-2

Close the sharing dead end with a read-only shared-child viewer built entirely inside existing seams (runs after CARE-3 so grants carry stable scope IDs). Server: GET /shared/:grantId/packet validates isShareActive + recipient email, then assembles ONLY the granted scopes by reusing buildConsultPacket/serializePresetPacket ceilings — the consult preset serializer is the ONLY egress, so assertWithinCeiling + the forbidden-token scan run on every payload. Client: clicking an inbound 'Shared with you' card opens a read-only view of exactly those sections. No new capture paths, no write access.

**Files:** Arbor/app/src/routes/api.ts, Arbor/app/src/sharing/shares.ts, Arbor/app/src/components/sections/TrustedSharing.tsx, Arbor/app/src/consult/packet.ts

**Acceptance:** Recipient sees exactly the granted scopes; revoked/expired grant returns 403 (tested) and the card disappears; a test proves no endpoint returns raw subcollection documents to a recipient; scope-filtering tests added; counts-only by construction. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

## Wave 2

### TODAY hub — consolidation to one loop — TODAY-2, CODEX-1, TODAY-7, CODEX-7

Collapse the three stacked Codex cards into one integrated loop: merge TodayActionLoop's pre-accept state into the TodayRecommendation hero — capacity chips (2/5/10 min) + 'Make this today's step' become the hero's action row, 'Begin' (coach seed) becomes secondary; render the standalone TodayActionLoop card ONLY when an accepted/completed action exists. Delete the duplicate 'Recent context' section (ProgressNarrative's evidence cell becomes the single recent-moments surface). Rewrite the stale OverviewTab header comment to the actual render list and re-anchor the DUX-011 comment. Sweep the wave-2 surface literals: bg-white and the 'white' chip literal become var(--arbor-paper-elevated)/var(--arbor-paper), and extend tokens.test.ts to flag bg-white in parent surfaces. Drop the fake static '· high confidence' clause from QuickLogModal's review sheet, keeping only the honest provenance line (firewall: no static confidence wording may return).

**Files:** Arbor/app/src/components/tabs/OverviewTab.tsx, Arbor/app/src/components/overview/TodayRecommendation.tsx, Arbor/app/src/components/overview/TodayActionLoop.tsx, Arbor/app/src/components/overview/ProgressNarrative.tsx, Arbor/app/src/components/overview/QuickCaptureBar.tsx, Arbor/app/src/components/overview/QuickLogModal.tsx, Arbor/app/src/lib/tokens.test.ts

**Acceptance:** Pre-accept Today has exactly one gradient-primary CTA; focusHeadline appears exactly once; recent-moments list appears exactly once; section order = capture → hero(+sizing) → active-action(conditional) → noticed → narrative → play → tools; grep for bg-white|"white" in components/overview returns nothing; no confidence/certainty wording in capture review (EN+HE). 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### UNDERSTAND — journey polish (corrected age, focus, watch points, debris) — UND-3, UND-5, UND-6, UND-8

One pass over the Screening/Milestones/Development file cluster. (UND-5) ScreeningFlow computes comparisonAgeMonths from ageMonthsFromProfile + gestationalWeeks, selects the band months-precisely, and shows the corrected badge + one intro sentence — preemie treated consistently with Milestones; flag the band-selection change to the named clinical reviewer alongside the UND-1 localization (GD-10). (UND-6) weeklyFocus prioritizes: not_sure items in the current corrected band ('watch for it this week') → not_yet/unmarked in-band → nearest earlier band → empty state. (UND-3) Derive the 'Watch points' card from the useMonitoring watch-area derivation — real domain names + counts only, hidden or neutral when nothing is unobserved, never severity/verdict language; new keys pass the wave-3 banned-token scan. (UND-8) Replace window.prompt/confirm with the in-file inline-edit pattern, raise metadata type to >=11px, and make the explain() prompt months-precise for under-24-month children.

**Files:** Arbor/app/src/components/sections/Screening.tsx, Arbor/app/src/lib/screening.ts, Arbor/app/src/lib/milestoneData.ts, Arbor/app/src/components/tabs/DevelopmentTab.tsx, Arbor/app/src/components/tabs/MilestonesTab.tsx, Arbor/app/src/hooks/useMonitoring.ts, Arbor/app/src/lib/i18n.ts

**Acceptance:** Preemie fixture selects the corrected band (unit test), term children unchanged; 48-month fixture never gets an under-1 focus while in-band items exist, not_sure preferred over untouched; watch-points copy provably matches milestone state (all-checked child → no fabricated claim, no code-switching reference unless a language item is actually unobserved); no window.prompt/confirm in MilestonesTab, no text below text-[11px], infant explain-prompt snapshot test. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### COACH — one composer + honest capture bar — COACH-4, COACH-8

Consolidate CoachTab to a single conversation canvas: keep the top hero composer as the only input, delete the mirrored bottom composer (input+send+photo/mic row), keep Council/specialist links as a compact row under the thread, and drop the fixed-height inner scroll (thread flows with the page) or auto-scroll the viewport to the streaming answer on send. Firewall CONDITIONS (CODEX-9 lesson): the coach.aiDisclosure (EU AI-Act Art. 50) line and the photo/voice entry points MUST survive the consolidation, and the thread viewport must not shrink below the current min(70dvh,560px) behavior — this is the native re-implementation of the ask-journal-clarity dedup idea, not a merge of that branch. Separately, make the Behaviors capture bar honest: convert the button styled as a text field into a real single-line input whose typing opens the capture form with the text prefilled into newLogTrigger and focus moved there — prefill of existing form state only, zero new capture paths.

**Files:** Arbor/app/src/components/tabs/CoachTab.tsx, Arbor/app/src/components/tabs/BehaviorsTab.tsx

**Acceptance:** Exactly one visible text input, one mic, one photo entry per viewport; coach.aiDisclosure renders; sending at 390px leaves the streaming bubble on-screen without manual scroll; coach.empty.title appears once; typing in the Behaviors bar opens the form prefilled+focused, keyboard does not obscure the field at 390px. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### JOURNAL spine — bilingual, truthful, day-grouped — JRNL-3, JRNL-4, JRNL-5, JRNL-6, JRNL-7, JRNL-8

One pass over signalTimeline + JournalTab + StoryTimelineTab. (JRNL-3) Keep signalTimeline pure: emit structured fields (kind, refTitle, counts) and label everything at render via new timeline.* i18n keys — kind labels, filter labels, 'Observed:'/'Played:' templates, localized day-group labels via Intl. (JRNL-4) Fix provenance: MANUAL (You) = moment/milestone/play, AUTO (Arbor) = coach/memory/plan, with a unit test locking the kind→provenance table. (JRNL-5) Set milestone at: observationUpdatedAt (and plan.createdAt if present) so first-words/first-steps land in the chronology instead of 'Ongoing'. (JRNL-6) Chip moments via classifyBehaviorDomain, omitting the chip when it returns null — never guess, labels restricted to the developmental-domain vocabulary, no severity/condition names. (JRNL-7) Gate the feed on logsLoaded with skeleton rows and fix the header stat to count dated signals within 7 days (or relabel). (JRNL-8) Keep the flat single column (validated call — do NOT restore the 2-col grid) and render through groupByDay with slim sticky localized day headers, time-only within groups, 'Ongoing' last.

**Files:** Arbor/app/src/lib/signalTimeline.ts, Arbor/app/src/lib/signalTimeline.test.ts, Arbor/app/src/components/tabs/JournalTab.tsx, Arbor/app/src/components/tabs/StoryTimelineTab.tsx, Arbor/app/src/lib/monitoring.ts, Arbor/app/src/lib/i18n.ts

**Acceptance:** With uiLang=he zero English renders in Feed or Story across all six signal kinds; checked milestone shows the 'You' badge and appears in the Today group with its timestamp (undated legacy → Ongoing, both tested); 'Sensory Meltdown' chips as Sensory & motor and unclassifiable rows carry no domain chip; no empty-state flash on reload with data; header number matches its label in EN and HE; day headers RTL start-aligned, 390px no horizontal scroll, Story density untouched; wave-3 scans on signalTimeline stay green. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### KID WORLD — honest navigation, no streaks, coherent art — KID-4, KID-6, KID-7

(KID-4) Rename the kid-dashboard GAMES tiles to the real HeroArcade world names (Sound Lab, Mood Mountain, Mind Vault, Beat Keeper, Hero Pose, Pattern Power, Story Quest, Mimic Studio), reuse each world's icon/color, drop or relabel tiles with no live counterpart (Calm Builder), and pass the worldId through onOpenSurface to pre-select the world — honoring the existing mapping only (per-game deep-link redesign stays Guy-gated). (KID-6) Remove streak remnants per the no-pressure doctrine: replace the two consecutive-day badges in computeAchievements with monotonic daysPracticed equivalents, rewrite the ov.mission.toastDone streak toast (EN+HE) gain-framed, delete MissionsPanel (dead code) or gate it behind an explicit revival decision, and correct the worlds.ts 'missions' entry to match reality. (KID-7) Align the TODAY'S ADVENTURE banner art/prompt with its hero-story copy (game-courage-steps.webp fits) and de-duplicate tile art so no two visible tiles share a file — prefer the accent icon fallback over a wrong recycled image.

**Files:** Arbor/app/src/components/kidmode/KidDashboard.tsx, Arbor/app/src/components/practice/HeroArcade.tsx, Arbor/app/src/components/kidmode/KidModeOverlay.tsx, Arbor/app/src/practice/achievements.ts, Arbor/app/src/components/practice/MissionsTab.tsx, Arbor/app/src/practice/worlds.ts, Arbor/app/src/lib/i18n.ts

**Acceptance:** Every game tile's title string appears verbatim on the surface it opens; grep for loss-framed streak copy in child-adjacent surfaces returns nothing, achievements/epics tests updated and green; no two visible kid-dashboard tiles share an art file and the banner copy/prompt/art depict the same scene. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### CARE/GROWTH — pricing honesty, sharing history, single roster — CARE-5, CARE-6, CARE-8

(CARE-5) Show per-plan, per-cadence prices on PaywallModal and the Settings plan panel via i18n (EN+HE), annual as effective-monthly + 'billed yearly', plus a 'Cancel anytime' line; source figures from one client constant with a test asserting it matches the entitlement config (locked pricing €12.99 Plus / €19.99 Family); fix the checkout-unavailable toast severity from success to info. (CARE-6) Add includeInactive to listByOwner + /api/shares?history=1 and render a real 'Sharing history' section from grant records (created/expired/revoked with dates) replacing the ephemeral session list — grants ARE the audit record, no new event infra. (CARE-8) Merge the duplicated roster into ONE card per grant (InitialsTile visual + revoke folded in).

**Files:** Arbor/app/src/components/billing/PaywallModal.tsx, Arbor/app/src/components/layout/SettingsModal.tsx, Arbor/app/src/hooks/useCheckout.ts, Arbor/app/src/sharing/shares.ts, Arbor/app/src/routes/api.ts, Arbor/app/src/components/sections/TrustedSharing.tsx, Arbor/app/src/lib/i18n.ts

**Acceptance:** Both upgrade surfaces show prices in both languages before any checkout redirect, no overflow at 390px; price-constant/config parity test green; revoking a share moves it to history with its revocation date after full reload, empty-history state written; each grant renders exactly once with revoke reachable; RTL verified. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### PLATFORM — reduced motion + hex-creep guard — PLAT-5, PLAT-6

(PLAT-5) Wrap the app root in <MotionConfig reducedMotion="user"> so all 91 motion/react call sites honor the OS setting (transform/layout animations disabled, opacity retained); existing per-component useReducedMotion logic unaffected. (PLAT-6) Hygiene: delete the dead AskArborButton default variant with its hardcoded sapphire shadow (or restyle with a token and mount it where its comments claim); replace AiRail #1f6f4b with var(--arbor-green-ink) and the two #eef6f1 gradients with var(--arbor-paper-tinted), deleting the stale 'no token yet' comments; add a vitest that globs src/components/**/*.tsx, extracts hex literals outside an explicit allowlist (SVG marks, mascots, confetti, print-CSS, BRAND_HEX) and fails on new entries.

**Files:** Arbor/app/src/App.tsx, Arbor/app/src/components/layout/AskArborButton.tsx, Arbor/app/src/components/layout/AiRail.tsx, Arbor/app/src/components/tabs/BehaviorsTab.tsx, Arbor/app/src/components/tabs/MilestonesTab.tsx, Arbor/app/src/lib/tokens.test.ts

**Acceptance:** With emulated prefers-reduced-motion the tab-switch slide and card entrances no longer translate; hex-creep guard green on the current allowlist and red when a new hex appears in a non-allowlisted component file. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

## Wave 3

### PLATFORM/TODAY — i18n registry migration — TODAY-5, PLAT-4, CODEX-6

One sweep moving every inline he?{...}:{...} copy object into lib/i18n.ts keyed entries (today.action.*, today.narrative.*, ql.review.*/quicklog.review.*, beh.capture.*, plus the OnboardingFlow ob.progress.step aria-label), replacing the objects with t() calls so the i18n parity test actually guards them; replace the remaining BehaviorsTab rgba shadow literal with var(--shadow-xs). Make the focusHeadline cleanup language-aware: add Hebrew equivalents to the English-only artifact-strip patterns (or branch on uiLang) so HE hero text gets the same scrub and clamp — no canned overrides may return (CODEX-2 class). Add a lint-style test failing on new `uiLang === "he" ? {` copy objects in components/.

**Files:** Arbor/app/src/components/overview/TodayActionLoop.tsx, Arbor/app/src/components/overview/ProgressNarrative.tsx, Arbor/app/src/components/overview/QuickLogModal.tsx, Arbor/app/src/components/tabs/OverviewTab.tsx, Arbor/app/src/components/tabs/BehaviorsTab.tsx, Arbor/app/src/components/auth/OnboardingFlow.tsx, Arbor/app/src/lib/i18n.ts

**Acceptance:** Zero uiLang-ternary copy objects remain in components/overview/* (grep clean); i18n parity test covers the migrated strings and stays green; HE rendering byte-identical (translations copied verbatim); HE hero headline passes the same length clamp; anti-regression lint test in place. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### TODAY — confirmed capture for voice/photo — TODAY-3

Extend the confirmed-capture seam beyond text: extract QuickLogModal's review step into a shared ConfirmCaptureReview component (draft rows + factual source line 'parent-entered text / voice transcription / photo' + Edit/Discard/Confirm) and insert it before handleAddLog in BehaviorsTab's submitLog, at minimum for voice-originated (toggleVoice) and pendingCaptureMode handoffs. Firewall CONDITIONS: one shared contract, no forked capture path; no behavior-log write from any Today-originated capture without explicit confirm; the provenance line stays factual with no confidence/verdict wording (pairs with the CODEX-7 removal already landed).

**Files:** Arbor/app/src/components/overview/QuickLogModal.tsx, Arbor/app/src/components/tabs/BehaviorsTab.tsx, Arbor/app/src/components/overview/QuickCaptureBar.tsx

**Acceptance:** No behavior-log write occurs from any Today-originated capture without explicit confirm; existing QuickLogModal tests keep passing; one new test drives the voice path through review; no confidence wording anywhere in review copy (EN+HE). 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### TODAY — narrative earns its card (evidence links + counts delta) — TODAY-6

Make ProgressNarrative meet AR-CAP-03: each evidence row becomes tappable, deep-linking to the specific journal/behavior entry (pass ids through onOpenEvidence(id)) instead of dumping into the whole Journal tab; enrich 'What changed' with one firewall-safe comparative count sentence (this week's logged-moment count vs last week's) derived in OverviewTab where behaviorLogs are in scope. Firewall CONDITIONS: counts only ('N moments this week vs M last week'), zero trend adjectives (easing/rising banned per wave-3); add the template to a wave-3-style banned-token scan; evidence deep-links carry no derived scores. HE/EN via the keys landed in the i18n migration entry.

**Files:** Arbor/app/src/components/overview/ProgressNarrative.tsx, Arbor/app/src/components/tabs/OverviewTab.tsx, Arbor/app/src/lib/i18n.ts

**Acceptance:** Tapping an evidence item lands on that entry; changed-copy remains counts-only with no %/score/trend adjective, template covered by the banned-token scan; HE/EN parity via keys. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### UNDERSTAND/CARE — professional packet upgrades — UND-4, CARE-7(executable tranche)

(UND-4) Preserve the wave-2 uncertainty data end-to-end: extend the report payload to {domain, title, status: observationStatus ?? (checked ? 'yes' : 'not_yet'), observedAt} and render three groups (observed / not sure / not yet) with dates in the provider summary and buildMonitoringReportDoc — counts only, existing fail-closed clinician-ceiling kept. (CARE-7 executable) Persist lastExportedAt per audience and add a computed 'Since last visit' delta section (new logs count, plan changes, newly-noticed milestones — counts only, through assertWithinCeiling); add SLP + behavioral-health presets reusing the clinician ceiling with tests mirroring packet.test.ts. The authored 'questions to ask' banks and audience guidance stay publication-blocked behind the CONT-1-hardened named-clinical-review gate (GD-10), failing closed.

**Files:** Arbor/app/src/components/sections/Reports.tsx, Arbor/app/src/lib/monitoring.ts, Arbor/app/src/context/ArborContext.tsx, Arbor/app/src/consult/packet.ts, Arbor/app/src/consult/packet.test.ts, Arbor/app/src/components/sections/AskSpecialist.tsx

**Acceptance:** A 'not sure' milestone appears as its own category with its date in the exported summary; no percentage or verdict introduced; extended payloads pass assertWithinCeiling + the forbidden-token guard; delta section appears only when a prior export exists; new presets covered by ceiling tests; authored clinical content absent from live output. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### UNDERSTAND — governed milestone-media seam (ships empty) — UND-7

Build the AR-CAP-08/AR-CONT-07 media slot without any media: add optional exampleMedia to Milestone ({kind: 'illustration'|'video', src, alt, credit, rightsRef, reviewer, reviewedAt, locale}) per the governed-schema shape, render it in the milestone drill-in behind a fail-closed check (missing reviewer/rightsRef → never renders, mirroring the AR-CONT-01 pattern), and ship with zero media entries. Licensing/source approval for actual media is Guy-gated (GD-8); prod stays visually unchanged until it lands.

**Files:** Arbor/app/src/types.ts, Arbor/app/src/components/tabs/MilestonesTab.tsx

**Acceptance:** Schema + render + fail-closed test land (missing reviewer/rightsRef never renders, tested); zero media entries; prod visually unchanged. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### COACH — voice transcript, provider policy wiring, real citations — COACH-2, COACH-3, COACH-6

(COACH-2) Persist and caption the browser voice loop: append the dictated user turn via the existing chat-message write seam, accumulate streamVoice deltas into a visible streaming AI bubble (reuse TypewriterMarkdown), keep partial text on abort — firewall CONDITIONS: the captioned/persisted text is the same SAFE-V1-screened output the voice pipeline already gates, writes only via existing conversation persistence, no new capture path. (COACH-3) Wire-or-delete the dead ai/capabilities layer: route tts + structured-text provider selection through selectProvider with a RoutePolicy (EU region, requireNoTraining, retention), register the google-TTS + Gemini/Claude adapters in a CapabilityRegistry in createApp — behavior identical for current config; if the team decides against wiring, delete the module instead. (COACH-6) Return sourceCards {id,title,type} from /chat and /council (keeping sourceCardsUsed), thread through CoachContract, and render title + type chip in the citation drawer with slug fallback.

**Files:** Arbor/app/src/components/tabs/CoachTab.tsx, Arbor/app/src/context/ArborContext.tsx, Arbor/app/src/lib/api.ts, Arbor/app/src/ai/capabilities/policy.ts, Arbor/app/src/ai/capabilities/registry.ts, Arbor/app/src/ai/modelRouter.ts, Arbor/app/src/server/tts.ts, Arbor/app/src/server/createApp.ts, Arbor/app/src/routes/api.ts, Arbor/app/src/contracts/coach.ts, Arbor/app/src/components/coach/CoachAnswerCards.tsx

**Acceptance:** After a voice turn both turns appear in the thread and survive conversation switch, voicePhase chip shows live text, RTL correct in HE; at least one production request path executes selectProvider (misconfigured region throws policy_denied — fail-closed test) and grep shows ai/capabilities imported from non-test code (or the module is deleted); citation drawer shows 'Transcription Bridge · intervention'-style rows, never dash-stripped slugs; coach.test.ts extended, contract zod schema updated with the optional field. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### CONTENT — governance hardening, schema, honest metadata (all fails-closed) — CONT-1, CONT-6, CONT-5, CONT-3, CONT-4

Land CONT-1 first: add required reviewedBy (named person) to GovernedContentRecord, validate reviewedAt as a real date <= now, and stamp a contentHash over title/doNow/sayThis/avoid/observe/escalation (both locales) at approval with isPublishableContent recomputing so any post-approval edit demotes the card; export computeContentHash. (CONT-6) Extend the base with concerns: string[] (controlled vocabulary — use 'separation', never 'separation-anxiety'; no diagnostic-shaped labels) and moment, tag all 25 cards, and add a pure content/selectCards.ts selector (byCategory, byConcern, matchToRecentBehaviors) that never returns draft or retired records (both tested — including the retired-fails-publication gap). (CONT-5) Replace literal names (Dylan/Maya/Ms. Lee) with a {{childName}} token + generic role words matching in both locales, with a renderSayThis(card, childName) helper and a regex test rejecting Latin proper names in HE fields — done BEFORE the named clinical review so the reviewer stamps the shipping text (CODEX-5 condition). (CONT-3a) Honest-narrow ageBands to what each card's register actually serves (most 2-6; homework/screen-ending/losing-game 6-12); older-band variants are gated authoring (GD-10). (CONT-4) Author moment-specific escalation drafts (EN+HE) for the >=8 higher-stakes cards as observable thresholds + who to talk to, counts-not-verdicts, no diagnostic-cutoff timelines — all stay reviewStatus draft, failing closed until GD-10.

**Files:** Arbor/app/src/content/governance.ts, Arbor/app/src/content/governance.test.ts, Arbor/app/src/content/hardMomentCards.ts, Arbor/app/src/content/hardMomentCards.test.ts, Arbor/app/src/content/selectCards.ts

**Acceptance:** Approved card with empty reviewedBy fails; reviewedAt 'TBD' fails; mutating sayThis.en after stamping fails publication; selector never returns a draft or retired record (tested); every card has >=1 ageBand and >=1 concern; no Latin proper names in HE strings (regex test); >=8 cards have unique escalation text in both locales with hitting/public-meltdown/separation !== the shared fallback; publishedHardMomentCards still pins to length 0. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### CONTENT — hard-moment surfaces built dark — CONT-2, CODEX-5(surfaces)

Build the AR-CONT-01 consuming surfaces driven exclusively by publishedHardMomentCards so they render nothing until clinical review lands (governance stays the switch; CONT-1 hardening must already be in). (1) BehaviorsTab: 'Hard moments' section with category chips opening a card sheet with the five labeled sections, escalation rendered VERBATIM from the governed record in a distinct calm safety band — never paraphrased; whole section hidden when the published list is empty. (2) Today: when a card matches recent behavior-log categories (via selectCards.matchToRecentBehaviors), offer its doNow through the existing acceptTodayAction seam — no new capture path. (3) Ask Arbor: a 'Talk this through' button per card calling the existing seedCoach seam with card context, covered by a new evals/coach-hardmoment-seed-v1 suite (ai-eval-harness, version-pinned — rubric: answer stays within card scope, no diagnosis/verdict, escalation boundary preserved verbatim; pass bar 100% on escalation preservation). All chrome labels bilingual via new i18n keys; card copy via LocalizedText; --arbor-green-*/tokens only; verify 390px + RTL.

**Files:** Arbor/app/src/components/tabs/BehaviorsTab.tsx, Arbor/app/src/components/overview/TodayActionLoop.tsx, Arbor/app/src/components/tabs/CoachTab.tsx, Arbor/app/src/content/hardMomentCards.ts, Arbor/app/src/content/selectCards.ts, Arbor/app/src/lib/i18n.ts

**Acceptance:** With an approved fixture card all three surfaces render and are RTL-correct; with the real all-draft pack zero UI appears; tests assert both states; escalation text byte-identical to the governed record; eval suite authored and passing on the fixture; no module with zero external consumers remains. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### PLAY — guided-play schema + content authoring (EN now, HE via gate) — KID-5, KID-3(content)

Extend PlayActivity with optional easierVariation, harderVariation, whatToNotice, outcomePrompt, demoMediaId (media stays empty — demonstration video is Guy-gated production). Author the four text fields for the top-50 activities (ranked by domain coverage x band) in EN — HE authoring routes through the native transcreation packet (KID-8/GD-7), never machine-translated. Render the new fields in DailyPlayCard behind the existing expand affordance. Author extended (20-30min) and additional standard-duration variants for the top activities so the KID-3 session buckets stop being empty. Audit all 252 activities and raise themeableContextSlot coverage to >=60 so the CI-29 interest engine actually fires. Firewall CONDITIONS: whatToNotice/outcomePrompt copy stays observational (notice/describe, never assess/score) and the four new fields join a banned-token scan mirroring clinicalFirewall.wave3.

**Files:** Arbor/app/src/playbank/content.ts, Arbor/app/src/playbank/coverage.ts, Arbor/app/src/playbank/select.ts, Arbor/app/src/components/overview/DailyPlayCard.tsx

**Acceptance:** coverage.test.ts asserts top-50 activities have all four guided fields non-empty (EN now; HE slot tracked); themeableContextSlot count >= 60; extended bucket non-empty so the wave-1 chip logic re-enables it honestly; banned-token scan green on the new fields. 1321+ tests stay green, tsc clean, HE/EN + RTL, tokens only.

### PLAY — HE native-review packet assembly — KID-8(packet)

Assemble the transcreation review packet for Guy's native reviewer (GD-7): export PLAY_ACTIVITIES_HE (title/whatItBuilds/steps) plus the ~40 kid-register micro-copy strings (STORY_ART sfxHe including the non-native 'שלאמפ!'/'גלופ!'/'גראח!' transliterations with proposed fixes like שפריץ, PACK_WORLD labelHe, celebration strings) into one reviewable document. Built from static content.ts strings only — no child data leaves the family. Applying corrections is a later data-only PR once the reviewer stamps.

**Files:** Arbor/app/src/playbank/content.ts, Arbor/app/src/components/tabs/HeroJourneyTab.tsx

**Acceptance:** One complete review document delivered covering all HE playbank + kid SFX copy with proposed fixes flagged; no code change in this entry; after review lands, the first-draft annotation in content.ts is replaced with a reviewer-named date stamp. tsc/tests untouched.

### CARE — AR-CAP-04 caregiver-identity ADR (design only) — CARE-9

Write the gated design doc only — zero app code (firewall CONDITION). The ADR covers: identity model (Firebase multi-auth per adult), fail-closed grant→membership migration for existing email grants (legacy grants never silently widen), the private-adult-history data boundary, audit event schema (extending the CARE-6 grant-history record), DPIA notes, rollout/rollback, and the migration test plan — all seven AR-CAP-04 acceptance bullets named. Delivered for Guy's gate (GD-9).

**Files:** Arbor/docs/, Arbor/docs/arbor-enhancement-backlog-v6.md

**Acceptance:** ADR covers all seven AR-CAP-04 acceptance bullets, names the migration test plan, specifies the private-adult-history boundary and fail-closed migration; zero app code changed; backlog entry updated to point at the ADR.

## Guy decision list

- **GD-1 (PLAT-2)** — Canonical parent primary color: green (per the standing constraint and tokens.ts's own header) vs the UC-2 sapphire #2b7fff now remapped in .arbor-parent. Wave-1 unifies the token SCOPE but does not retint; this decision unlocks the mechanical repoint (green ramp or sapphire restyle of wave-2 cards) plus truthful tokens.ts/AskArborButton docs, recorded in design-qa.md.
- **GD-2 (CODEX-4)** — Ratify or revert PR #80's ungated app-wide re-theme (sage gradient → flat #fbfaf7 paper, retuned shadows, 22px→18px card radius — it also edited the guard test to pass). (a) Ratify and record as superseding UC-2 in the design program docs, or (b) revert index.css token block + cardCls/tokens.test.ts to pre-5205fdae values (git show a6c15684^1). Either way the guard test then encodes the ratified value.
- **GD-3 (COACH-7)** — Live voice bundle: (a) confirm Gemini Live stays provision-gated OFF in prod until the turn-logging sliver ships; (b) approve building the turn-logging endpoint (transcribe/log every Live turn, screenModelOutput on model turns, hard-stop audio on a flagged turn) gated on evals/voice-live-crisis-v1 passing at 100% escalation+hard-stop on crisis cases and 0 unhelpful refusals on the worried-parent set; (c) approve the TTS_PROVIDER=google env flip for the coach voice pump.
- **GD-4 (CODEX-8)** — Third-Age senior landing page (arbor-senior.html): wave 1 moves it out of app/public regardless (publication as-is would be VETO-class — unvalidated HMO-connection claims under the Arbor brand). Decide whether it ever publishes, and only after Third-Age wedge validation per the existing plan-only gate.
- **GD-5 (CODEX-9)** — Confirm deletion of the 6 harvested/superseded codex branches (guided-canvas, production-polish, today-action-copy, today-action-clean, full-app-polish, action-first-ui); confirm ask-journal-clarity is mined-then-deleted (its dedup idea is re-implemented natively in wave 2 COACH-4 — the branch itself deletes the AI-Act disclosure and photo/voice entries, never merge); confirm v2-architecture-foundation stays unmerged reference-only (contradicts the Firebase Hosting canary doctrine).
- **GD-6 (KID-1)** — Commission the native HE transcreation of kid-mode copy (~35 strings). Wave 1 ships kid.* i18n keys with EN fallback; HE values are blocked on the native-human transcreation gate — never machine-translated kid register.
- **GD-7 (KID-8)** — Name the native Hebrew reviewer for the playbank + kid-SFX review packet (assembled in wave 3): 252 HE activity entries self-declared first-draft plus non-native SFX transliterations. Reviewer's stamp replaces the first-draft annotation in content.ts; corrections land as a data-only PR.
- **GD-8 (UND-7)** — Approve licensing/rights + source for illustrated/video milestone examples (CDC Milestone Tracker reference class). The governed exampleMedia seam ships empty and fail-closed in wave 3; nothing renders until rights-approved media with named reviewer + rightsRef is added.
- **GD-9 (CARE-9)** — Approve or reject the AR-CAP-04 caregiver-identity implementation per the wave-3 ADR: Firebase multi-auth per adult, fail-closed grant→membership migration, private adult AI-history boundary, DPIA. Implementation is explicitly blocked until this sign-off.
- **GD-10 (clinical reviewer)** — Appoint the named clinical reviewer (CONT-1 makes the stamp require a named person + content hash — approval is no longer a one-enum flip). Review queue once appointed: the 25-card hard-moment pack incl. the new moment-specific escalation drafts (CONT-4) and any 6-9/10-12 age variants (CONT-3b); consult-packet question banks + audience guidance (CARE-7 authored tranche); HE translations of the screening item prompts and result framing (UND-1); and the corrected-age band-selection change flagged from UND-5. Everything fails closed until stamped.
- **GD-11 (TODAY-3 / TODAY-6 — flag only)** — No action required — informational: both carry clinical-firewall CONDITIONS rulings whose guards are fully baked into wave-3 acceptance (voice/photo captures gain an explicit confirm step with factual provenance wording; the narrative delta is counts-only with a banned-token scan). Flag only if you want to personally review the capture-review copy or the comparative-counts template before they ship.

## Codex branch verdicts

- `codex/arbor-guided-canvas` — **already-merged**: Zero commits ahead of HEAD (git cherry). Safe to delete on GD-5 confirmation.
- `codex/arbor-production-polish` — **already-merged**: Zero commits ahead of HEAD. Safe to delete on GD-5 confirmation.
- `codex/arbor-today-action-copy` — **already-merged**: Zero commits ahead of HEAD. Safe to delete on GD-5 confirmation.
- `codex/arbor-today-action-clean` — **already-merged**: git cherry '-' — patches byte-identical in HEAD via PR #77. Safe to delete on GD-5 confirmation.
- `codex/arbor-full-app-polish` — **already-merged**: git cherry '-' — patches byte-identical in HEAD via PR #80. Safe to delete on GD-5 confirmation.
- `codex/arbor-action-first-ui` — **already-merged**: Earlier iteration of the merged guided-canvas commit (same 18-file set); HEAD is 2310 lines ahead. Superseded — delete on GD-5 confirmation.
- `codex/arbor-ask-journal-clarity` — **harvest**: Mine the composer-dedup idea ONLY, re-implemented natively in wave 2 (COACH-4) with the coach.aiDisclosure AI-Act line, photo/voice entry points, and the >=min(70dvh,560px) thread viewport all preserved — the branch's own diff deletes exactly those, so it must never merge as-is. Delete the branch after mining.
- `codex/arbor-v2-architecture-foundation` — **discard**: Never merge: terraform/GCP Cloud Run/cloudbuild + auth scaffold contradicts the locked Firebase Hosting canary deploy doctrine. Keep as read-only reference until Guy ever gates a separate infra-pivot decision; excluded from the GD-5 deletion batch.
