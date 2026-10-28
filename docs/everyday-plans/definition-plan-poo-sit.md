# Definition — `plan-poo-sit`

Plan-book standard §1, the thirteen fields. Written before the manuscript;
the manuscript (`app/src/lib/library/plans/patterns/planPooSit.ts`)
transcribes it. Reviewer's yes: **not recorded** (B-GA-37 pending, EN and HE).
Hebrew: native review owed.

| # | Field | Content |
|---|---|---|
| 1 | **Pattern id, title** | `plan-poo-sit`. EN "The toilet champion". HE "הבטן שלי לומדת לשחרר" (my tummy learns to let go). Both name the win, not the problem. The Hebrew title is gender-neutral because the book title has one Hebrew form; the native editor may propose another. |
| 2 | **Shelf and age band** | Body domain door (the app's nine shelves have no Body shelf; the Parent host row places the door). Age bands `36m`, `48m`, `60m`, `6-8y`; register band 5–7 (EN ≤ 40 words a page, HE ≤ 34). |
| 3 | **Parent words** | EN "Hard poo, holding it in, or afraid of the toilet". HE "קקי קשה, התאפקות, או פחד מהשירותים". |
| 4 | **Body fact** | "After I eat, my tummy does important work. It takes what my body needs from the food. What is left over becomes poo, and the poo waits inside until it is ready to come out." Picture: how a body works, drawn like a game map (plate PP2, no face, no child). |
| 5 | **The hard part, named** | "Sometimes the poo wants to come out, but it is a little hard. Sometimes it hurts, or it feels scary. Sometimes I am busy playing, and I would rather keep playing. So my tummy holds on, and holds on." The hero holds the tummy (pose `hold-tummy`); nobody scolds. |
| 6 | **The plan, three steps** | Default: (1) sit calmly on the toilet for about 5 minutes every evening, feet on a little step — `sit-after-meal`; (2) the wonder box — `the-box`; (3) just try, no need to produce — `just-try`. Menu alternatives: `sit-same-time` (slot 1), `blow-bubbles` (slot 2). Minutes 3–10, parent-set. No step depends on the child succeeding. |
| 7 | **The box** | Parent chooses from: a book I love, bubbles, a story from my grown-up, a calm little game, a song we sing. The child taps what goes in (in memory only; nothing is stored about the child). |
| 8 | **The win** | "When the poo comes out, my tummy feels light and happy. Every time we sit, my body learns to let go at the right time. My tummy gets a chance, and we just try. That is my plan!" The body's learning, never the child's merit. Frame line: "{name}'s tummy is learning." |
| 9 | **Sources** | `naspghan-espghan-2014` — NASPGHAN/ESPGHAN joint guideline on functional constipation in children (Tabbers et al., 2014): the behavioural half (demystification without blame, scheduled calm toilet sitting after meals with a footstool, no pressure to produce). `nhs-constipation-children` — NHS, Constipation in children. `aap-constipation` — AAP HealthyChildren, constipation and toilet-learning pages. Steps 1 and 3 cite the guideline and the public pages; step 2 the guideline and the NHS page; `blow-bubbles` the NHS page. The reviewer confirms each and may strike a step. |
| 10 | **Red lines (watchFor)** | In parent words, rendered only as the existing care line, never a checklist with a score: blood in the poo · fever or vomiting with it · a very swollen or very painful tummy · losing weight or not growing as before · poo problems since birth · it started after a fall or an illness · the child is under three and has not started toilet learning. Any one routes to the doctor and offers no plan. |
| 11 | **Banned words for this pattern** | Beyond the shared §5 lists: EN constipation, constipated, encopresis, soiling, withholding, laxative, accident. HE עצירות, אנקופרזיס, משלשל, תאונה. The lint rejects them in the child's text. |
| 12 | **Pose list** | Six of the shared twelve: `hands-up` (cover, win), `stand-tall` (p1, p2), `hold-tummy` (p3), `point-up` (p4), `sit-calm` (steps 1 and 3), `hold-box` (step 2). No new pose. |
| 13 | **The sceptic's three** | (a) "Scheduled sitting without stool softening can entrench withholding in a child whose stools are hard." → the panel keeps the medical half with the doctor; the red lines route pain, swelling and blood to care before any plan. (b) "A story that praises the toilet can shame a child who still soils." → no verdict, no merit; the body learns, the child only tries; soiling words are banned. (c) "Toilet sitting is wrong for a child under three or one with problems since birth." → both are red lines; no plan is offered. |

## Screens (standard §2)

| # | Screen | Page id | Plate | Pose |
|---|---|---|---|---|
| 0 | Cover | `cover` | PP1 | hands-up |
| 1 | My body is good | `p1` | PP1 | stand-tall |
| 2 | How it works | `p2` | PP2 | stand-tall |
| 3 | Sometimes it is hard | `p3` | PP3 | hold-tummy |
| 4 | We have a plan | `p4` | PP4 | point-up |
| 5 | Step one | `s1-<menu>-<min>m` | PP5 | sit-calm |
| 6 | Step two | `s2-<menu>` | PP6 / PP5 | hold-box / sit-calm |
| 7 | Step three | `s3-just-try` | PP7 | sit-calm |
| 8 | The win | `p8` | PP8 | hands-up |
| 9 | End page | (reader END screen) | — | — |

Refrains: body "my tummy gets a chance" / "הבטן שלי מקבלת הזדמנות"; plan "we
just try" / "אנחנו רק מנסים"; both return on p8. Hooks: p3 and p4 end
unresolved. Sentence ratio on the default composition: see the plan lint test
(`planBooks.test.ts`), which asserts descriptive : directive ≥ 2 : 1.

## Gate §1

- Every field filled: yes.
- Sources named per step: yes (menu `sourceIds`).
- Reviewer's yes: **owed** — EN and HE. Until then the pattern is dark.
