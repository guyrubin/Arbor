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
5. **(From UND-5, separate entry)** — the corrected-age band-selection change is flagged to the same reviewer alongside this localization pass.

## Where things live

- Keys + HE drafts: `app/src/lib/i18n.ts` (blocks marked `UND-1`)
- Canonical EN bank: `app/src/lib/screening.ts`
- Coverage guard: `app/src/lib/screeningI18n.test.ts` (item/band/domain key parity + banned-verdict regression)
- Banned-token scan: `app/src/lib/clinicalFirewall.wave3.test.ts`
