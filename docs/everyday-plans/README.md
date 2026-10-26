# Everyday Plans — definition files and review packet

Everyday Plans are the third kind of Kid Mode book, the **PLAN book**: a short
first-person story in which the child's own hero meets one hard everyday
pattern, hears what their body and their family are going to do about it, and
ends calm. The parent composes it from authored pages; the child reads it with
zero model calls; the plan's steps become the parent's week in Today.

This folder holds, per pattern, the **definition file** the licensed reviewer
reads before a word of manuscript (the thirteen fields of the plan-book
standard §1), and, once built, the **review packet** per pattern and language.
The engine and the content live in `app/src/lib/library/plans/`.

Rules that hold everywhere here:

- A pattern names a behaviour in parent words, never a condition.
- No graded verdict about a child anywhere a parent sees; counts only.
- Zero virtue nouns and zero diagnosis nouns in the child's text, EN and HE.
- Hebrew is AI-written: native review owed on every line until the native
  editor's pass.
- A pattern is **dark** (composable only in the sandbox and for the owner
  allow-list) until the licensed reviewer signs it per language. Nothing here
  is a signature; the reviewer's record is held server-side (`PLANS_REVIEWED`).
- Every example here is synthetic. No real family's plan is in this repo.

| Pattern | Definition | Manuscript | Reviewer EN | Reviewer HE |
|---|---|---|---|---|
| `plan-poo-sit` | [definition-plan-poo-sit.md](definition-plan-poo-sit.md) | `app/src/lib/library/plans/patterns/planPooSit.ts` | owed | owed |
| `plan-sleep-alone` | [definition-plan-sleep-alone.md](definition-plan-sleep-alone.md) | `app/src/lib/library/plans/patterns/planSleepAlone.ts` | owed | owed |
| `plan-dropoff` | [definition-plan-dropoff.md](definition-plan-dropoff.md) | `app/src/lib/library/plans/patterns/planDropoff.ts` | owed | owed |
| `plan-big-feelings` | [definition-plan-big-feelings.md](definition-plan-big-feelings.md) | `app/src/lib/library/plans/patterns/planBigFeelings.ts` | owed | owed |
| `plan-screen-end` | [definition-plan-screen-end.md](definition-plan-screen-end.md) | `app/src/lib/library/plans/patterns/planScreenEnd.ts` | owed | owed |
| `plan-new-food` | [definition-plan-new-food.md](definition-plan-new-food.md) | `app/src/lib/library/plans/patterns/planNewFood.ts` | owed | owed |
| `plan-toilet-start` | [definition-plan-toilet-start.md](definition-plan-toilet-start.md) | `app/src/lib/library/plans/patterns/planToiletStart.ts` | owed | owed |
| `plan-stay-in-bed` | [definition-plan-stay-in-bed.md](definition-plan-stay-in-bed.md) | `app/src/lib/library/plans/patterns/planStayInBed.ts` | owed | owed |
