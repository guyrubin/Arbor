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

## The three doors (B-BOOK-79)

| Door | State | Where |
|---|---|---|
| (a) The parent types a step from the professional who works with the child | built | the composer's own-words entry asks whose step it is; the step is phrased, screened and approved like any own step, and labelled "a step from the professional who works with your child" on the step, in the parent panel and in the intake packet (`app/src/lib/library/plans/composePlanBook.ts`, `app/src/components/plans/PlanComposer.tsx`) |
| (b) "Print {name}'s plan" | built | the parent-only printed copy: text only (no photo, no hero art), a watermark naming it a parent copy, the data-consent line, Hebrew as a right-to-left document, a count of nights (`app/src/lib/plans/planPrint.ts`) |
| (c) A practitioner composes the plan for a family | **scoped only — never built** | needs counsel (BD-03) before a line of code: see the questions below |

The child's Everyday plans also reach the clinician intake packet as **counts**
(when the plan started, its bounded length, how many nights the parent
confirmed, whether one step came from the child's practitioner) through the one
input assembler (`app/src/consult/packet.ts`, section `everyday-plans`); a
teacher never receives them, and the child's lines never leave the device.

### Door (c): the counsel questions (for BD-03, held by the owner)

Before a practitioner can compose a plan for a family, counsel is asked:

1. **Who is the controller of a plan a practitioner composes?** The family
   (Arbor processes on the parent's consent), the practitioner (a professional
   record), or both? This decides where the row lives, who can erase it, and
   whether the child's export carries it.
2. **Is a plan composed by a licensed practitioner a clinical document?** If a
   step the practitioner writes is read to a child as "my plan", does Arbor
   carry, store or display a treatment instruction, and does that change the
   product's non-diagnostic contract or its regulatory posture (medical-device
   software rules in the EU and Israel)?
3. **Consent and identity of the practitioner.** How does Arbor verify a
   practitioner is who they say they are and holds a current licence, and what
   does the parent consent to when they let one in (scope, duration,
   revocation, the practitioner's own retention)?
4. **The child's lines.** A practitioner's own words become the child's
   first-person text after AI phrasing. Who approves the exact line: the
   parent (as today, B-GA-11), the practitioner, or both? Does the practitioner
   see the approved line, and the counts?
5. **Liability and the red lines.** If a practitioner composes past a red line
   the pattern would have stopped a parent at, whose decision is it, and what
   does Arbor record?
6. **Billing.** Is the practitioner a paying seat (B2B2C), a referral source
   on the family's subscription (BD-53/BD-54 funnel), or both; and does either
   create a professional-services relationship with Arbor?

Until these are answered and recorded in STATUS, door (c) has no code path,
no flag and no landing copy.

