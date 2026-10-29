# Child-data register (DPIA lines, B-GA-09)

**Date:** 28 Oct 2026 · **Owner:** Guy (controller) · **Companion to:** the DPIA in `docs/architecture/migration-2026-06-17/wave-0/governance/DPIA.md` (§3.3 points here).

This file has one line for every place Arbor keeps data about one child. Export (GDPR Art. 15/20) and erase (Art. 17) must reach each one.

- The per-child Firestore subcollections are `CHILD_SUBCOLLECTIONS` in `app/src/lib/childData.ts`. That list alone drives the export and the erase of `users/{uid}/children/{childId}/*`.
- Every other sink (profile, server, Storage, device) is listed in `app/src/lib/childDataSinks.ts`.
- `app/src/lib/childDataSinks.guard.test.ts` fails the build if a sink is missing from this file, or if this file names a sink that is not registered. It also fails if the code gains an unclassified Firestore collection, Storage module or prefix, IndexedDB database, Cache Storage cache or device key.
- The erase receipt (`DeletionReceipt.sinks`) has one entry for every line here: a count, `cleared`, or `not-reached`. `not-reached` means that part of the erase failed. The sheet then reads "Deletion not finished" and marks those rows "Not reached" instead of claiming the data is gone. It offers Try again, which erases the same child again and folds the result into the same receipt. Save receipt downloads the counts and this per-line ledger, with the child's id but not the child's name. In the sheet, each row says in plain words how many of these lines it covers and how many were not reached; the internal ids appear only in the saved file. An unfinished erase is kept on the device under one key, `arbor.pendingErase`, scoped to the account that started it: each entry carries that uid and only that account reads it. It stays across that account's sign-out, so the same account finds the offer again after signing back in; another account on the device never sees it. An entry holds the erased child's id and the receipt so far, never the child's name. Your data offers "Finish deleting a child's data" as its first item until a retry completes, and the entry is cleared then. With no child left (the app shows onboarding), the app shell retries it once on start. A retry passes the server's owner check: `/privacy/erase` removes the child doc, which the owner check reads, last, and first writes an erase record `erasedChildren/{childId}` (the child and family ids, expiring after 30 days) that lets the same family retry after a lost response. Account deletion finds a child whose erase stopped half way even though its profile has left `users/{uid}/children`: it also erases every child named in the family's erase records, and every child pointer of a family the account is the last member of, then removes those erase records. It never erases a child whose record now names another family (a re-parented child leaves its old pointer behind); it removes only that stale pointer or record. It never sweeps the shared placeholder family `default-family`, whose members are unrelated accounts, and an erase record naming that family lets nobody retry through it. The device also sends the account's unfinished erases (child ids only) with `/account/delete`, and the server erases each one the account may erase. While an unexpired erase record stands, nothing re-creates the child: a late write that passed the owner check before the erase (a memory append, an onboarding upsert) is refused, the memory routes answer 410, and `children/{childId}` stays gone. The erase route and account deletion run the same per-child erase (`app/src/server/childErase.ts`): the erase record, shares, consents, consult requests (a co-parent's included), both Storage prefixes, then the ledger, the family's pointer and the child doc. When no Storage bucket is configured (the sandbox), the server reports no Storage counts, so both Storage lines read "Not reached" instead of "erased · 0".
- `app/src/lib/childData.eraseReceipt.test.ts` runs a synthetic child through export and then erase, and checks every line.

**Common to every line:** purpose = the parent-support service the parent asked for. Lawful basis and retention are as in the DPIA §2 and the retention policy: data is kept until the parent erases the child or closes the account. Subjects = the child, recorded by the parent. Access = the owning parent, plus share grants the parent created. Export = `exportChildData` (`collections.<name>` unless stated otherwise). Erase = `eraseEverything` → `/privacy/erase` + `wipeClientChildData`. Account deletion (`/account/delete`) removes every line for every child, including a child whose erase stopped half way.

## Per-child Firestore subcollections — `users/{uid}/children/{childId}/<name>`

| Sink | What it holds | Notes |
|---|---|---|
| `firestore:behaviorLogs` | Moments the parent logged (what happened, context, notes) | Core record |
| `firestore:milestones` | Milestone checks and parent observations | |
| `firestore:actionPlans` | Plans generated for a challenge the parent named | AI output, parent-saved |
| `firestore:savedStories` | Legacy saved bedtime stories | No writer since the story surface left (B-DATA-04); kept for export and erase |
| `firestore:contacts` | Safety contacts the parent entered (care team, emergency) | Third-party names and numbers given by the parent |
| `firestore:weeklyReports` | The weekly recap text | AI output |
| `firestore:briefs` | Legacy saved school or professional briefs | No writer since 18 Jul 2026; kept for export and erase |
| `firestore:insights` | Today's focus and insight snapshots | AI output |
| `firestore:growthEntries` | Height, weight and head measurements the parent logged | Health-adjacent; parent-entered |
| `firestore:conversations` | Talk conversations with the parent | Parent words and AI replies |
| `firestore:conversationChanges` | Parent-confirmed updates from a conversation and their audit metadata | |
| `firestore:familyTopics` | The parent's chosen questions and references | |
| `firestore:playLogs` | Play activities done and the parent's notes | |
| `firestore:actionLoops` | Today actions the parent accepted and the reported outcomes | |
| `firestore:savedLearn` | Library bookmarks (card id, saved time) | |
| `firestore:screenings` | Screening answers per age band | Parent answers; never a verdict |
| `firestore:devScoreSnapshots` | Legacy weekly snapshots | No writer since B-GROWTH-06; kept for export and erase |
| `firestore:routines` | Routines and their completion | |
| `firestore:goalObservations` | Post-activity observations against a goal | |
| `firestore:goals` | Legacy goal records | No live writer (B-DATA-04); kept for export and erase |
| `firestore:practiceEvents` | Practice activity events | |
| `firestore:speechAttempts` | Speech practice outcomes (no audio is stored) | Child ASR is off in production (`CHILD_ASR_PROVIDER=none`) |
| `firestore:langObs` | Words and phrases the parent observed | |
| `firestore:mimicSessions` | Mimic game sessions | Kid mode |
| `firestore:missionRecords` | Mission completions | Kid mode |
| `firestore:heroRuns` | Hero game runs | Kid mode |
| `firestore:heroRenders` | The child's personalised story text per story and language | Text only; device copy in `device:heroRenders` |
| `firestore:kidSouvenirs` | Souvenir stickers earned | Kid mode |
| `firestore:studioQuestProgress` | Studio quest progress | Kid mode |
| `firestore:bookBookmarks` | The page a book was left on | Kid mode |
| `firestore:books` | Composed Everyday Plan books (the parent's choices, never the text) | B-BOOK-75 |
| `firestore:journeyObjectives` | Journey objectives the parent set | |
| `firestore:adventureResults` | Adventure outcomes | Kid mode |
| `firestore:bandSnapshots` | Practice band snapshots | |
| `firestore:appointments` | Appointments with professionals | |
| `firestore:apptQuestions` | Questions prepared for an appointment | |
| `firestore:apptFollowUps` | What the professional said, in the parent's words | LC-12 |
| `firestore:wellness` | Legacy wellness entries | No live writer; kept for export and erase |
| `firestore:savedComics` | Comic shelf metadata only (id, title, language, time) | Page art is device-only (`device:comicPages`) |
| `firestore:keepsakes` | Keepsake notes on a noticed milestone (may hold a photo URL) | Photo bytes in `storage:photos` |
| `firestore:bookAssets` | Metadata of the child's private book files | The files are `storage:books` |
| `firestore:sleepLogs` | Sleep diary, one document per night | B-PROG-06 |
| `firestore:programs` | Program enrolments and the family's baseline | B-PROG-01 |
| `firestore:familyGoals` | The family's goals in their own words and their scores | B-PROG-07 |
| `firestore:coachSessions` | Guided-tier sessions booked and what was agreed | B-PROG-10 |
| `firestore:heroSheet` | The hero's pose sheet (generated art from the generated hero, never a photo) | B-GAME-13c |
| `firestore:studioCreations` | The child's saved studio toys (a corner layout, a short melody) | **Found by this sweep (28 Oct):** it escaped export and erase until registered |
| `firestore:bookReads` | The finished-book ledger: catalogue book id, language, time per true ending; never the path or the choice | B-BOOK-51 (X28); export and erase |

## Profile, server, Storage and device sinks

| Sink | Where | What it holds | Export | Erase |
|---|---|---|---|---|
| `profile` | `users/{uid}/children/{childId}` (sandbox: `arbor.children`) | Name, age or birth date, languages, school context, strengths and challenges the parent described, avatar and photo URL | `profile` | The client deletes the document. Sandbox: the row leaves the device list |
| `server:memoryEvents` | `children/{childId}` + `children/{childId}/memoryEvents/*` | The approved-memory ledger and the family-owned child doc | `serverData.memoryEvents` | `memoryStore.eraseChild` |
| `server:familyChildRef` | `families/{familyId}/childRefs/{childId}` | The child and family ids only | Not exported: the ids are already in the profile | `memoryStore.eraseChild` (since 28 Oct; before that the pointer stayed) |
| `server:shares` | `shares/*` (owner + child) | Share grants the parent created | `serverData.shares` | `shareStore.eraseByChild` |
| `server:consents` | `consents/*` (child) | Consent grants (face, voice, attachments) | `serverData.consents` (since 28 Oct) | `consentStore.eraseByChild` |
| `server:consultRequests` | `consultRequests/*` (child id; filed by the parent or a co-parent) | Requests to a professional, with a parent's note about the child | `serverData.consultRequests`, the exporting parent's own requests (since 28 Oct). **Residual:** a co-parent's requests are not in the owner's export. Only the owning family may open one (`requireChildOwnership` on `POST /consult-requests`, since 28 Oct); a co-parent who has only a share grant cannot | `consultStore.eraseByChild`, every request naming the child including a co-parent's (since 28 Oct; before that, only account deletion) |
| `storage:photos` | `users/{uid}/children/{childId}/` | Profile and keepsake photos | By reference only: the download URL in `profile.photoUrl` and `keepsakes[].photoUrl`. **Residual:** the bytes are not inside the export file | The prefix is deleted. The receipt counts it (`storage.photos`, part of `counts.storageFiles`) |
| `storage:books` | `children/{childId}/books/` | Hero sheet, prints, narration in the child's name (sandbox: `app/.data/book-assets/`) | `privateBookAssets` (bytes, digest, per-file receipt) | `eraseChildBookAssets`. The receipt counts it (`storage.books`, part of `counts.storageFiles`) |
| `device:webStorage` | localStorage + sessionStorage `arbor.<ns>.<childId>[.<variant>]` | Sandbox collections, drafts, seen markers | Sandbox: the registered collections. The rest is display state on this device | `clearChildLocalState` (`counts.clientDocs`) |
| `device:comicPages` | IndexedDB `arbor-comic-pages` | Generated comic pages | Not exported: a device copy (`savedComics` holds the shelf) | `purgeComicPages` |
| `device:heroRenders` | IndexedDB `arbor-hero-renders` | Device copy of the personalised story text | `heroRenders` | `purgeHeroRenders` |
| `device:bookAssets` | IndexedDB `arbor-book-assets` | Device copy of the private book files | `privateBookAssets` | `purgeBookAssets` |
| `device:firestoreCache` | IndexedDB `firestore/[DEFAULT]/…` (SDK offline cache) | A mirror of the registered documents | The documents themselves | Each `deleteDoc` removes the cached copy. **Residual:** account deletion and sign-out leave the SDK cache of a deleted account on the device. The SDK cannot see it from another account, but the bytes stay until the browser evicts them |

**T16 static clause:** `app/src/lib/childLikenessFiles.guard.test.ts` checks git and `app/public/` two ways. (1) Shape: no file may take a private book shape, matched case-insensitively in any folder: the `bookAssetPaths` grammar (`hero-sheets/…` with its `choices/`, `prints/` and manifests, `narration/<set>/<en|he-m|he-f>/…`), the Storage prefix `children/<id>/books/`, a `hero/` or `pose-sheet/` folder at any depth, a `sheet.json`, and any book audio outside the book's shared, name-free set. A plain `prints/` folder elsewhere is not a book shape, and neither is a voice folder such as `he-m/` outside the book audio paths. (2) Named likeness: the files that already show the proof child cannot be told apart by shape, so `app/src/lib/childLikenessFiles.named.ts` names each one with the row that owns its removal and the sha256 of the reviewed bytes. The tree must hold exactly that list, with the families matched in any letter case: a new file in a likeness family fails until it is named with an owner, a removed one fails until its line goes, and a named file whose bytes change fails until the new picture is reviewed and re-pinned. Today: `app/public/_proof/**` (23 files; Guy's 5 Oct 2026 ruling keeps them until B-GAME-35 migrates them, then B-BOOK-71) and the shared card tiles plus the hero avatar (114 files, every `cards/**/game-*` and `story-*` tile in each size and pack, and `visuals/dylan-hero-avatar.png`; B-BOOK-31 residue). The reader clauses still need the production check.

**Not child sinks (checked by the guard):** the service-worker caches `arbor-shell-*` and `arbor-kid-art-*` hold only public shell files and art. The worker never caches `/api`. Since 28 Oct the private book files are served `Cache-Control: private, no-store`, so no copy stays in the browser's HTTP cache after an erase; before that, a copy could stay for up to 24 hours. The device keys in `ACCOUNT_DEVICE_KEYS` hold no child's content. The one that names a child, `arbor.pendingErase`, names only a child whose erase already ran (id and receipt, read back only by the account that started it). The server's erase record `erasedChildren/{childId}` holds the erased child's id, the family id and two dates. Account deletion removes it, and a 30-day TTL on `expireAt`, declared in `firestore.indexes.json` and shipped by the deploy job, removes it otherwise. Account deletion removes every `arbor*` localStorage key; sessionStorage keys end with the tab. The family's charter and the parent's "How should Arbor talk with you?" choice (B-PLAY-21) are family-level, never about one child: on the device under `arbor.familyCharter` and `arbor.lens`, and, only with the device flag `arbor.flags.familyWaySync`, in the account document `users/{uid}/familyWay/current` (owner-only by the `users/{uid}/**` rule). Every child's data export carries both as `familyWay`; no child erase touches them; account deletion removes the document with `users/{uid}` and the device keys with the `arbor*` wipe.

## The production half (Guy, OWN-1)

The engineering proof above uses synthetic fixtures. The dated production verification needs the authorized production account and a safe fixture child. Export the child, check every line above against the export file and the receipt, erase the child, then check the receipt's `sinks` against the console:

- Firestore: the child doc and its subcollections are gone.
- `children/{childId}` and the family's pointer are gone.
- Storage: both prefixes are empty.
- The device: IndexedDB and storage keys for the child are gone.

- `erasedChildren`: after the first deploy that ships `firestore.indexes.json`, the TTL policy on `expireAt` shows as active (Firestore console › TTL). The app already refuses an expired record.

Record the date, the build SHA and the receipt here.
