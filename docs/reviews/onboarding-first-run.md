# B-SHELL-36: authored first run

Status: implementation with explicit content gates. B-SHELL-08 is SUPERSEDED → B-SHELL-36. No clinical approval or rendered acceptance is claimed by this change.

## What changed

The current three-place companion shell (Now / My child / Together) is preserved. A signed-in new parent now has three steps: About your child, one worry, an authored card. A required month/year field starts empty; home languages and controller consent remain explicit. A month is stored as `birthMonth: YYYY-MM`, never as an invented day-01 birthday. Exact existing dates retain precedence; explicit later age edits clear both stale date/month fields.

The worry screen is derived from the eight registry IDs and existing My child glyphs, plus A hard moment / Nothing in particular. Typed words win for `challenges[0]`; an area name is the fallback. Nothing in particular with no text clears the field.

The card accepts through the same `acceptTodayAction` persistence seam as existing direct actions. It uses the existing child-scoped actionLoops collection and an opaque, stable acceptance key. It waits for that child's collection to load, saves the action before profile completion, and does not claim completion after a rejected write. Retry, repeated taps, Back and resumed profiles do not create duplicate children or repeated identical actions. Draft data lives on the existing child document and is cleared on completion. Existing export/erase paths cover it. No new collection, provider, model prompt or model request is introduced.

Now waits for its action snapshot before mounting a focus request. The accepted first-run step is its lead, with “Tomorrow we'll ask how it went.” on the day it was accepted. Urgent wording instead leads to the existing immediate human-support copy and dial targets; it does not use the delayed try-today promise.

FirstStepsRail was already unmounted from the accepted Now shell and absent from its module-budget inputs. Regression guards preserve that. Automatic comic prewarming and journey writes are removed. WowOnboarding stays mounted in Shell but returns null, including for legacy pending flags. Stored journey keys and helpers are retained. Books, games and their Together doors were not changed; their sessions should treat the automatic first-run comic as retired.

AddChildModal previously imported the old fields directly. Its existing entitlement/two-step contract is preserved in AddChildFields.tsx; this ticket does not silently redesign adding another child.

## Clinical activation gate

Hard moments reuse the existing authored guide and `hardMomentPublication` policy. Pilot status is disclosed honestly: editorial pilot, **not individually clinically reviewed**. Digest, withdrawal, locale and age rules apply at preview and acceptance. At `2026-12-03T00:00:00.000Z`, unreviewed pilot guides fall back to the Feelings notice path. No expiry is extended and no release digest is altered.

Each area's proposed first notice reuses an existing Journal question verbatim. Existing publication is not proof of clinical approval for this new first-run placement. `content/onboardingNoticeRelease.ts` therefore has an **empty, closed** review manifest. Before activation, a named reviewer must approve the exact bilingual line with a review date, due date and matching content digest. No environment variable or parent record can bypass this. While closed, the existing neutral day-0 question “What happened with {name} today?” / “מה קרה עם {name} היום?” is rendered and accepted instead. The Feelings expiry fallback passes through the same gate. This is a deliberate remaining clinical-acceptance gate, not a completed eight-area content release.

Talking can additionally use the existing P2 `sayBackFor` templates after the parent explicitly types a child's words. Those templates and their language rules are reused, not rewritten. All other areas remain notice-only. Safety wording is reused from `elev.safety.crisis.danger` and `screen.safetyNote`; no new crisis advice is authored.

## Review sheet

All interface copy in `lib/i18nElevation/onboarding.ts` is a new EN/HE draft and requires native-language/product review. Registry area names remain the existing D1 vocabulary. The precise notice lines below remain **DRAFT / NOT ACTIVATED** on this surface. Review both the selection by age and the wording; do not infer clinical approval from an offline test or this report.


| Area | Bank | Key | English draft | Hebrew draft |
|---|---|---|---|---|
| talking | infant | elev.prompt.infant.7 | What brand-new sound came out today? | איזה צליל חדש לגמרי נשמע היום? |
| moving | infant | elev.prompt.infant.9 | What set off excited kicking today? | מה גרם היום לבעיטות של התרגשות? |
| hands | infant | elev.prompt.infant.3 | What did those little hands discover today? | מה הידיים הקטנות גילו היום? |
| thinking | infant | elev.prompt.infant.4 | What held their gaze the longest today? | מה ריתק את המבט הכי הרבה זמן היום? |
| playing | infant | elev.prompt.infant.5 | Whose face got studied up close today? | איזה פרצוף נחקר היום מקרוב? |
| feelings | infant | elev.prompt.infant.6 | What was the softest moment of the day? | מה היה הרגע הכי רך של היום? |
| body | infant | elev.prompt.infant.8 | How did they let you know it was time to eat? | איך נודע לכם היום שהגיע זמן האוכל? |
| family | infant | elev.prompt.infant.20 | What did good morning look like today? | איך נראתה ברכת הבוקר היום? |
| talking | toddler | elev.prompt.toddler.1 | What funny word was said today? | איזו מילה מצחיקה נאמרה היום? |
| moving | toddler | elev.prompt.toddler.15 | What sent them running with joy today? | מה גרם היום לריצה מאושרת? |
| hands | toddler | elev.prompt.toddler.28 | What 'I did it myself!' moment happened today? | איזה רגע של 'עשיתי לבד!' היה היום? |
| thinking | toddler | elev.prompt.toddler.19 | What got built — or knocked down — today? | מה נבנה — או הופל — היום? |
| playing | toddler | elev.prompt.toddler.24 | What got shared today — even for a second? | מה שותף היום — אפילו לשנייה אחת? |
| feelings | toddler | elev.prompt.toddler.10 | What was today's big 'NO' about? | על מה היה היום ה'לא!' הגדול? |
| body | toddler | elev.prompt.toddler.13 | What surprised you at the table today? | מה הפתיע אתכם היום ליד השולחן? |
| family | toddler | elev.prompt.toddler.9 | What did they copy you doing today? | מה מהדברים שאתם עושים זכה היום לחיקוי? |
| talking | preschool | elev.prompt.preschool.1 | What 'why' question came up today? | איזו שאלת 'למה' עלתה היום? |
| moving | preschool | elev.prompt.preschool.11 | What got noticed on the way today? | מה התגלה היום בדרך? |
| hands | preschool | elev.prompt.preschool.5 | What got drawn or made today? | מה צויר או נוצר היום? |
| thinking | preschool | elev.prompt.preschool.17 | What are they curious about this week? | מה מסקרן השבוע? |
| playing | preschool | elev.prompt.preschool.3 | Who did they play with today — and what did they play? | עם מי שיחקו היום — ובמה? |
| feelings | preschool | elev.prompt.preschool.10 | What was hard today — and how did it end? | מה היה קשה היום — ואיך זה נגמר? |
| body | preschool | elev.prompt.preschool.28 | What was the bedtime conversation about tonight? | על מה הייתה שיחת הלילה-טוב הערב? |
| family | preschool | elev.prompt.preschool.14 | What did they tell you about preschool today? | מה סופר היום על הגן? |
| talking | early-school | elev.prompt.early-school.15 | Which new phrase got picked up this week? | איזה ביטוי חדש נקלט השבוע? |
| moving | early-school | elev.prompt.early-school.19 | Which game or sport won the afternoon? | איזה משחק או ספורט ניצח היום אחר הצהריים? |
| hands | early-school | elev.prompt.early-school.13 | What got created today? | מה נוצר היום? |
| thinking | early-school | elev.prompt.early-school.4 | What did they figure out on their own today? | מה הובן היום לבד, בלי עזרה? |
| playing | early-school | elev.prompt.early-school.5 | Which friend came up in conversation today? | איזה חבר או חברה עלו היום בשיחה? |
| feelings | early-school | elev.prompt.early-school.12 | What was hard today — and how did they handle it? | מה היה קשה היום — ואיך הסתדרו איתו? |
| body | early-school | elev.prompt.early-school.23 | What was the dinner-table conversation about? | על מה דיברתם בארוחת הערב? |
| family | early-school | elev.prompt.early-school.17 | What did you two talk about on the way today? | על מה דיברתם היום בדרך? |

### New interface copy (draft)

| Key | English | Hebrew |
|---|---|---|
| ob.first.about | About your child | קצת על הילד או הילדה |
| ob.first.birthMonth | Birth month and year | חודש ושנת לידה |
| ob.first.birthHint | Choose a month. You don't need to share the day. | בחרו חודש. אין צורך לשתף את היום. |
| ob.first.languages | Languages at home | השפות בבית |
| ob.first.worry | What's on your mind about {name}? | מה מעסיק אתכם לגבי {name}? |
| ob.first.optional | One line, if you'd like | שורה אחת, אם תרצו |
| ob.first.hard-moment | A hard moment | רגע קשה |
| ob.first.nothing | Nothing in particular | שום דבר מסוים |
| ob.first.pickMoment | Which moment? | איזה רגע? |
| ob.first.card | One thing for today | דבר אחד להיום |
| ob.first.try | I'll try it today | ננסה את זה היום |
| ob.first.tomorrow | Tomorrow we'll ask how it went. | מחר נשאל איך היה. |
| ob.first.details | Read the full guide | לקרוא את המדריך המלא |
| ob.first.quote | Something your child said (optional) | משהו שהילד או הילדה אמרו (לא חובה) |
| ob.first.whyQuote | Use their own words to see something you can say back. | כתבו את המילים שלהם כדי לראות מה אפשר לומר בחזרה. |
| ob.first.loadError | Your child profiles couldn’t be loaded. Please try again. | לא הצלחנו לטעון את פרטי הילדים. נסו שוב. |

## Acceptance evidence and outstanding work

- Offline unit/component tests cover required month, all ten choices in EN/HE, zero fetch/model calls for the first-run state machine, single acceptance, backward navigation, interrupted/repeated writes, profile-write rejection, sibling isolation, exact birthday precedence and month rollover.
- Acceptance-seam parity is tested against `planAcceptedAction` for every action source, including topic/plan metadata, earlier-day carry-over, completed rows and write failures.
- No browser was used. 375px EN/HE first-run and day-0 screenshots, 1280px day-0 screenshot, focus/scroll behavior and real Back/Forward acceptance remain for the release owner’s permitted browser session. CSS constrains the shell to the viewport with a sticky primary footer; this is implementation, not rendered proof that every full guide fits without scrolling.
- Native Hebrew and named clinical notice activation are external review gates. This change must not be described as clearing those gates.
- No deployment, remote publishing, real child data, credential changes or billed model calls were performed by this implementation task.

### Offline freeze validation (9 October 2026)

- TypeScript: `tsc --noEmit` passed on the frozen implementation.
- Focused acceptance/provider/Now/action-ledger guards: 9 files, 113 tests passed.
- Related journey, comic, age, add-child, design, RTL, token, KPI, pilot and rail regression guards: 13 files, 393 tests passed.
- Capability floors: 27 passed, 0 failed, 1 documented pre-existing F18b warning (`coRegulationScript`). Framework consistency passed.
- Full-suite attempt before final stale-contract repairs reached 12,412 passes but was not green; those four failing assertions and the renamed-test collection error were fixed and covered by focused reruns. A subsequent final full run was interrupted. The release owner must run the combined full suite and build; no final full-suite or production-build pass is claimed here.

### Independent-review follow-up (9 October 2026)

- Explicit accept now checkpoints the exact step-3 input, including a newly typed Talking quote, before writing its action. Failed checkpoints and failed completion saves stay incomplete locally. Completion converts `onboardingDraft: undefined` to Firestore `deleteField()` and removes the local property.
- First-run operations capture service callbacks and owner/child lifetime, and check them across asynchronous continuations. Unmount or session replacement cannot finalize through another owner's callback. Profile loads, writes and ownership provisioning additionally pin the actual Firebase user and latch auth transitions, including A→B→the original A object before React renders. A cancelled same-account session can recover with explicit Retry. In-flight ownership markers cannot block the new session or erase a newer attempt.
- A signed-in load error never imports the unowned sandbox cache or starts new-account onboarding. ProfileGate shows the new retryable bilingual draft message above. Actual sandbox data remains available; old remote profiles are never mirrored into that sandbox cache.
- First-run action acceptance explicitly requires server acknowledgement. Offline or an unacknowledged four-second timeout leaves setup open for retry; ordinary capture queue semantics remain unchanged. Cached optimistic matching rows cross a same-ID confirmed write barrier before profile completion. Superseded/completed rows are preserved as history, so returning to an earlier choice accepts the currently selected card rather than silently replaying superseded content.
- Both worry text and child quotes use the existing urgent override. Urgent cards hide ordinary say-back/helper copy and keep existing human-support links and continuation wording.
- Permanent offline regressions execute the actual provider with stateful effect cleanup, and the actual collection callback with synthetic SDK/token/storage boundaries. They cover delayed loads/tokens/creates/updates, pre-render raw-auth swaps, same-UID cancellation/recovery, draft deletion, quote remount, optimistic action replay, acknowledgement timeout/rejection/retry, and ordinary-source acceptance parity. These synthetic checks do not replace rendered, native-language, clinical or production acceptance.

Follow-up checkpoint validation: TypeScript passed; 10 focused files / 131 tests passed; 5 related files / 103 tests passed; independent synthetic provider harness 11 / 11 passed. `git diff --check` passed. The combined full suite/build and all rendered/native/clinical gates remain with the release owner.

## Narrow release recovery — 10 October 2026

This release recovers the authored slice from `1c073d03daab45848eaeb33caba73ac74540ee38` and its lifecycle fix `25135bad2184991f5648b5b6dff5fcaac1f7295d` onto `372debd46e2398eeb36af435b8de87e166c41bd4`. It does not merge the held integration tree. The invite-retry change `48cb8bbf5d16be68e96d93f0c651a1b953be9d6e` and its regression test are already byte-identical at this base; additional tests verify profile-error recovery and account-return response ownership.

### Dependency and conflict resolution

- The base already has owner-scoped profile loading, retry and raw-auth lifetime protection. Only first-run create/checkpoint/completion honesty is added, together with a read-only owner-lifetime predicate for the flow's multi-write continuation.
- Child selection now has a non-revivable lifetime object. Both rendered and same-render A→B→A switches retire pending onboarding writes. The original ID-only guard failed two new synthetic probes before this fix.
- The flow checks the mounted and owner lifetime before each unissued action write and after the last acknowledgement. An old superseding-row acknowledgement cannot write a new accepted row after close or owner retirement. Two mounted-handler negative controls failed before this fix and pass afterward. Already-issued server writes are not rolled back; this is not an atomic transaction or a cross-tab serialization claim.
- Current `ArborContext` acceptance sequencing and cross-caller ownership are retained around the recovered shared helper. Existing Family/Ask receipt tests run against the real helper and preserve all 45 assertions.
- `useChildCollection` retains the base's unbounded `awaitServer` receipt option, confirmed snapshots, export-currentness receipt, local-history guard and ordinary queued-write default. The original first-run-only bounded `requireAcknowledgement` option is added alongside it. No held-tree collection serializer, book-history consent, engagement collection or bedtime preference is imported.
- Current Now record/visit/evening priorities and chosen-step heading remain. The first-run loading fence and same-day tomorrow line are the only Now additions. Parent navigation, route registry and Kids entry source remain unchanged.
- Existing add-child fields are recovered into `AddChildFields.tsx`; this preserves the accepted separate add-child contract while first run changes shape.
- The removed book-consent test file is not restored. Its six relevant first-run persistence cases are recovered into `ProfileContext.firstRunPersistence.test.ts`; book-history activation remains excluded.

### Validation of this recovered source

42 focused test files / 809 tests passed, executed serially with the already-installed Vitest, one file per process, `--maxWorkers=1`, `MODEL_PROVIDER=mock`, blank Firebase client configuration and the offline socket guard. Coverage includes the real flow/controller/acceptance callbacks with synthetic boundaries, interrupted draft recovery, repeated acceptance, rapid close/reopen, account and child A→B→A, failed/late acknowledgements, invite retry and requested-family ownership, final `#/overview` destination, current Now leads, ordinary receipt behavior, month precision, consent controls, pilot expiry, firewall guards and Kids entry regressions. A guessed `useChildCollection.identity.test.ts` selector matched no file and is not counted; the actual collection and acknowledgement files passed. Historical validation counts above belong to their original source boundaries and are not added to this result.

`git diff --check` passed. No local typecheck, build, full-suite run, browser, live auth, account/profile mutation, provider request, publication, new credential/grant/permission or font/asset work was performed in this recovery. Synthetic handler coverage is not real-auth E2E or rendered acceptance.

### Remaining gates

Independent review of this exact recovered commit; authorized aggregate CI/type/build checks; permitted synthetic/browser visual and keyboard/Back/Forward acceptance at the specified EN/HE widths; native Hebrew/product review; named clinical approval before opening the area-notice manifest; and the existing approved-account/authenticated end-to-end gate. The area-notice manifest stays empty and closed, explicit parent consent and card acceptance remain, and the hard-moment pilot digest/expiry are untouched.

### Independent hold and lifecycle correction

Independent exact-source probes held recovery candidate `f5b91b59dfc8ff837205d5abe3e3e65fa98bd155`: a retired first-create callback could append/provision after acknowledgement, reopening could allocate a second child document, and selection A→B→A during action acceptance could issue completion/navigation. The 809-test recovery receipt above predates those probes and does not establish the corrected boundary.

The follow-up keeps a provider-owned, owner-keyed first-create reservation with the same child identity and issued write promise across flow close/reopen. An uncertain pending write remains pending; a rejected write can retry that same ID. Only the live non-revivable adopter may admit provisioning/install after acknowledgement. The original issued server write is never rolled back. Corrected form fields use the same reserved document. Completion retires the reservation. This is an in-provider recovery contract, not remote atomicity, cross-tab serialization, or a promise of crash/reload transaction recovery.

Once a live acknowledged adopter admits ownership provisioning, that existing work retains the provider's owner/auth lifetime, so closing its UI does not strand an installed child. A close before create acknowledgement admits no provisioning or local append; reopening may explicitly adopt its retained result. Owner/session replacement still retires the old callback, and an obsolete adopter cannot install or erase a newer adopter's work.

A frozen owner/selection predicate is captured once per controller operation and carried through the checkpoint, every action upsert, completion, and navigation. The first-create exception covers only the legitimate self-selection after successful creation; the provider's pre-install selection guard still rejects an external switch. An acknowledgement callback runs after confirmed/current completion persistence and before the completed profile becomes visible to ProfileGate. It allows the real flow's final Now navigation exactly once, while external close, owner changes and selection return before acknowledgement cannot invoke it.

Follow-up validation: 13 affected files / 233 tests passed serially with the same mock/offline constraints. Thirteen permanent actual-provider/controller probes include the three original independent failures, confirmed retired-result adoption, same-ID rejected retry, corrected reopened input, account-return adoption, non-stranding already-admitted ownership, and completion publication ordering. Ten actual-flow handler tests include the real navigation callback before gate-driven unmount and unissued writes after selection return. These counts overlap the earlier recovery suite and are not added to it. `git diff --check` passed. Exact corrected-source independent review and all previously listed auth/render/native/clinical/aggregate gates remain open.
