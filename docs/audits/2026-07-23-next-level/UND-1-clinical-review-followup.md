# UND-1 — Clinical-review follow-up note (GD-10 queue)

**Filed:** 2026-07-23 · **Entry:** Wave 1, "UNDERSTAND — Development Check localization (P0 parity)" · **Gate:** GD-10 (named clinical reviewer appointment)

## What shipped now (no clinical sign-off required)

The Development Check (ScreeningFlow / Screening / ScreeningSheet), the monitoring watch-note card and the MilestonesTab observation buttons are fully localized through `app/src/lib/i18n.ts` (`screen.*`, `ms.observe*` keys). The English content was already live verbatim; localization itself carried no new clinical claims.

Per the firewall CONDITIONS ruling, the two verdict literals were **not** ported verbatim and were rephrased to the observational register before keying:

| Old literal (Screening.tsx) | New key | New EN value |
|---|---|---|
| `{name} looks on track across these areas` | `screen.result.title.calm` | "Nothing stands out for {name} across these areas right now" |
| `On track` (per-domain chip) | `screen.chip.calm` | "Nothing to raise" |
| `all areas on track` (last-checked line) | `screen.last.calm` | "no areas flagged" |

The wave-3 banned-token scan (`clinicalFirewall.wave3.test.ts`) was extended to every `screen.*` / `sec.screen.*` i18n key line, so the "on-track" verdict class cannot regress.

## Queued for the named clinical reviewer (once appointed)

All Hebrew strings below are **first drafts** shipped for parity; they need clinical + native review before any further prompt-content change:

1. **HE item-bank prompts** — the 32 `screen.item.<id>` HE values (i18n.ts, HE block), translating the CDC/AAP-style prompts in `app/src/lib/screening.ts` `AGE_BANDS`. Register used: gender-inclusive child forms ("מחייך/ת"), plural parent address.
2. **HE result framing** — `screen.result.title.watch/calm`, `screen.result.body.watch/calm`, `screen.chip.watch/calm`, `screen.safetyNote`, `screen.trustNote` (non-diagnostic disclaimer), `screen.intro.body`, `screen.intro.basis`.
3. **HE monitoring watch-note templates** — `screen.monitor.headline.*`, `screen.monitor.note.*` (mirrors `buildNote()` in `app/src/lib/monitoring.ts`).
4. **EN calm-result rephrase ratification** — the three rephrased values in the table above replace the previous "on track" phrasing on a live clinical surface; reviewer to ratify or supply preferred observational wording.
5. **(From UND-5, shipped 2026-07-25, Wave 2)** — the Development Check band selection changed from `bandForAge(childProfile.age)` (legacy whole-years, uncorrected) to `bandForAgeMonths(comparisonAgeMonths(chronoMonths, gestationalWeeks))` — months-precise with AAP preterm correction (stops at 24 months), the same spine the Milestones map uses. Term children are unchanged (unit-tested, `app/src/lib/screeningBand.test.ts`); a preemie now gets the corrected band's questions plus a visible corrected-age badge and one observational intro sentence (`screen.intro.corrected`, EN+HE first draft). Reviewer to ratify: (a) that corrected-age banding is clinically appropriate for the screener item bank, (b) the EN/HE corrected-intro wording.
6. **(From UND-3, shipped 2026-07-25, Wave 2)** — the Milestones "Gentle watch points" card no longer asserts a hardcoded insight; it now renders only real domain names + counts from the canonical monitoring derivation (`watchPointsSummary`), with a neutral line when nothing is unobserved. New `ms.watch.*` EN/HE strings are first drafts under the wave-3 banned-token scan; reviewer to ratify wording.

## Where things live

- Keys + HE drafts: `app/src/lib/i18n.ts` (blocks marked `UND-1`)
- Canonical EN bank: `app/src/lib/screening.ts`
- Coverage guard: `app/src/lib/screeningI18n.test.ts` (item/band/domain key parity + banned-verdict regression)
- Banned-token scan: `app/src/lib/clinicalFirewall.wave3.test.ts`
