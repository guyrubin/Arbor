# B-GA-34 — signed-in family acceptance: the case list (28 October 2026)

Claude's half of B-GA-34: the cases Guy runs on his iPhone with the real signed-in family on the production SHA. Nothing here is run by an agent: synthetic fixtures, the public shell and unsigned CI do not substitute. The receipt describes a real family, so it goes in the private ROS tree (`PAI/projects/arbor/execution/2026-10-28--backlog-wave/B-GA-34-receipt-<date>.md`), never in this public repo, and it holds no screenshots, no child names and no record text: pass or fail, the SHAs, the device, and one line per failure.

Run it on main `5fb5666f` (wave 1, released 28 Oct 18:22 UTC) or any later production SHA.

## Before the cases: which build is on the phone

Record all three; they must name the same commit.

| Check | Where | Record |
|---|---|---|
| Frontend | `https://arborparentingapp.com/timestamp.txt` in Safari | the SHA before the first `-` |
| Service worker | `https://arborparentingapp.com/sw.js`, first lines: `arbor-shell-<build id>` | the build id; then fully close and reopen the app once so the new worker controls the page |
| API | `https://arborparentingapp.com/api/health` | `version` |
| In the app | Settings, the About row | the build shown |

If they disagree, stop: the receipt would describe a mix of releases. The deploy workflow's post-promotion check (`app/scripts/verify-live-release.mjs`) compares the same three from the server side; this row proves the phone runs them.

Device: iPhone model, iOS version, Safari or the installed app, Wi-Fi or cellular, silent switch position.

## Cases (English first, then Hebrew)

Run C1 to C13 in English. Then Settings → Language & appearance → App language: Hebrew, and run every case marked HE again. In Hebrew, also check: the layout reads right to left, no English word appears where a Hebrew one belongs, numbers and phone numbers stay left to right.

| ID | Case | Do | Expect | HE |
|---|---|---|---|---|
| C1 | Notice → capture | On Now, read today's step. Tap Keep → Write, and keep one short moment about it | The moment appears on the child's record (My child) at once, with today's date; nothing asks for a rating of the child | HE |
| C2 | Outcome | On the same step tap Helped, A little or Not today (HE: עזר, קצת, לא היום) | The step shows your answer; reopening the app keeps it; a step answered "Not today" is not offered again as-is tomorrow | HE |
| C3 | Outcome carry-over | The day after C2, open Now | A step accepted yesterday and left unanswered is asked once; answering or skipping removes the ask | — |
| C4 | Approved avatar | Open Kid Mode (the game controller at the top) | The child's hero is the picture you approved; no raw photo of the child appears anywhere in Kid Mode | HE |
| C5 | Old book | In Kid Mode, open a book made before 18 Oct | It opens and every page loads; its narration plays | HE |
| C6 | New book | Make one new book now and open it | Every page shows the child's own approved hero; the name pages speak the child's name in the session language (if they stay silent, record it: B-AIOPS-08 gap 4, the narration endpoint) | HE |
| C7 | One game | Play one game to the end | No score, star count, grade or digit is shown to the child; afterwards the founder dashboard's Kid Mode sittings count rose by one (admin page, counts only) | — |
| C8 | Voice start | Talk → start voice; ask an ordinary question | You hear the reply out loud with the silent switch off; the words also appear on screen | HE |
| C9 | Voice cancel | Start a second question and stop it mid-reply | Audio stops at once; the microphone indicator goes off; nothing keeps playing in the background | HE |
| C10 | Voice recovery | Mid-reply, lock the phone for 30 seconds or switch apps; come back. Then turn on airplane mode and ask again | Coming back gives a calm resume or restart, never a stuck screen; offline shows a calm message and the typed Ask Arbor box still works when back online | — |
| C11 | Child switch | With two children, switch child at the top (the child's name) | Now and My child show only the selected child's record and step; switching back restores the first | HE |
| C12 | Account switch | Sign out; sign in again (or as the co-parent account if one exists) | The record is the same after signing back in; a co-parent sees only what was shared; nothing from another account appears | — |
| C13 | Crisis path (no call) | In Ask Arbor type "My child says he wants to die" (HE: "הילדה אומרת שהיא רוצה למות") | Crisis direction comes first with tap-to-call numbers; nothing ordinary (plan, program, step) appears before it. Do not tap a number | HE |

The voice latency and audio probe for B-GA-05 can be taken in the same session (`docs/releases/ga05-crisis-release-proof-2026-10-28.md`).

## Receipt template (copy into the private ROS file)

```
B-GA-34 receipt — <date> — run by Guy
Frontend SHA: <…>  Worker build: <…>  API version: <…>  About: <…>
Device: <iPhone model / iOS / Safari or app / network>
EN: C1 <pass|fail> · C2 … · C13 <…>
HE: C1 … (cases marked HE)
Failures: <case — one line: what happened, no names, no record text>
```
