# Crisis helpline verification record (B-GA-04)

Every phone number Arbor shows a parent in crisis, with the official source to check it against and the result of each run. `app/src/safety/helplineRecord.test.ts` reads this file: CI fails when a number on screen has no row here, when a row names a number the app no longer shows, or when `HELPLINES_REVIEWED_ON` moves without a complete run approved by Guy.

Constants version: `HELPLINES_REVIEWED_ON = 2026-10-01` (`app/src/safety/escalation.ts`)

Next verification due: 2027-03-30 (180 days; CI warns 14 days before and fails after)

No run calls an emergency or crisis number. Verification means reading the operator's own page.

## Verification runs

| Date | Kind | Scope | By | Approved by | Evidence |
|---|---|---|---|---|---|
| 2026-10-01 | baseline | The 12 directory numbers (B-CAREPRO-07; 118, 0800-2000 and 1-800-422-4453 added 6 Oct under B-CAREPRO-45) | Engineering session | none recorded | Source comment above `HELPLINES_REVIEWED_ON` in `escalation.ts`; no retained page captures |
| 2026-10-28 | attempt | All 16 numbers below | Wave scout and the ga-evidence builder | — | Every operator host refused: the session's DNS returned ENOTFOUND (scout), and this container's proxy answered `CONNECT tunnel failed, response 403` for eran.org.il, gov.il, 113.nl, veiligthuis.nl, zelfmoord1813.be, 1712.be, preventionsuicide.be, mdais.org, 988lifeline.org and childhelphotline.org at 2026-10-28 18:35 UTC. Search snippets agreed with the coded numbers; a snippet is not an official page, so nothing is marked verified |

Kinds: `baseline` is the state this record started from; `attempt` is a run that verified nothing; `approved` is a complete run Guy signed off, and only an `approved` run may move `HELPLINES_REVIEWED_ON`.

## Numbers shown

"Shown in": the EN escalation copy (coach, voice, quick log, behaviours), the Safety list (EN and HE labels, tap to call) and the hard-moment cards (EN and HE).

| ID | Country | Number | tel | Service and role shown | Shown in | Official source | Last recorded check | Result of latest run |
|---|---|---|---|---|---|---|---|---|
| eu_112 | EU, Netherlands, Belgium; Israel from mobiles | 112 | 112 | Emergency services, EU-wide; the copy adds "mobile in Israel" | EN copy; Safety list EN, HE | https://digital-strategy.ec.europa.eu/en/policies/112 (the Israel mobile claim needs an Israeli source as well) | 2026-10-01 | not reached |
| il_mda | Israel | 101 | 101 | Magen David Adom, ambulance | EN copy; Safety list EN, HE; hard-moment cards EN, HE | https://www.mdais.org/ | 2026-10-01 | not reached |
| il_police | Israel | 100 | 100 | Police; the abuse copy also calls it "Police child protection" | EN copy; Safety list EN, HE; hard-moment cards EN, HE | https://www.police.gov.il/ | 2026-10-01 | not reached |
| il_eran | Israel | 1201 | 1201 | ERAN emotional first aid, "24/7"; the label sits on the phone number, which is the 24/7 channel (ERAN's online channels keep shorter hours) | EN copy; Safety list EN, HE; hard-moment cards EN, HE | https://www.eran.org.il/ | 2026-10-01 | not reached |
| il_welfare | Israel | 118 | 118 | Ministry of Welfare line, shown as "family violence and child protection (24/7)". Public snippets describe 118 as the ministry's general information and assistance line; confirm the child-protection role and the hours on gov.il | EN copy; Safety list EN, HE | https://www.gov.il/he/service/contact-the-ministry-of-labor-welfare-and-social-services and https://www.gov.il/he/pages/molsa-news-violence-and-delinquency-domestic-violence-21112022 | 2026-10-06 | not reached |
| il_105 | Israel | 105 | — | National online child-protection centre ("Lametayel/105"); shown, not dialable (`DISPLAY_ONLY_HELPLINE_NUMBERS`) | EN copy | https://www.gov.il/ (the 105 centre's own page was not reachable to record; record its exact URL at the next run) | never recorded | not reached |
| nl_113 | Netherlands | 0800-0113 | 08000113 | 113 Suicide Prevention, free | EN copy; Safety list EN, HE | https://www.113.nl/ | 2026-10-01 | not reached |
| nl_113_short | Netherlands | 113 | — | Same service, short number; shown, not dialable (the free 0800 line is the tap target) | EN copy; Safety label text EN, HE | https://www.113.nl/ | 2026-10-01 | not reached |
| nl_veiligthuis | Netherlands | 0800-2000 | 08002000 | Veilig Thuis, abuse and domestic violence, free, 24/7 | EN copy; Safety list EN, HE | https://veiligthuis.nl/ | 2026-10-06 | not reached |
| be_1813 | Belgium | 1813 | 1813 | Zelfmoordlijn, suicide prevention (Dutch) | EN copy; Safety list EN, HE | https://www.zelfmoord1813.be/ | 2026-10-01 | not reached |
| be_cps | Belgium | 0800 32 123 | 080032123 | Centre de Prévention du Suicide, suicide prevention (French). Shown in the self-harm copy since before 1 Oct; tap to call from 28 Oct (B-GA-04) | EN copy; Safety list EN, HE | https://www.preventionsuicide.be/ | never recorded | not reached |
| be_1712 | Belgium | 1712 | 1712 | Violence, abuse and child-abuse line; the copy marks it Dutch. Opening hours are not displayed and were never sourced (the code comment that stated Mon–Fri 09:00–18:00 was removed 28 Oct) | EN copy; Safety list EN, HE | https://www.1712.be/ | 2026-10-01 (hours never sourced) | not reached |
| be_antigif | Belgium | 070 245 245 | — | Antigifcentrum, poison centre, in the urgent-medical copy; shown, not dialable | EN copy | https://www.antigifcentrum.be/ | never recorded | not reached |
| us_988 | United States; the self-harm copy says "US & Canada" | 988 | 988 | 988 Suicide & Crisis Lifeline | EN copy; Safety list EN, HE | https://988lifeline.org/ (US) and https://988.ca/ (Canada claim) | 2026-10-01 (US only) | not reached |
| us_911 | United States | 911 | 911 | Emergency services | EN copy; Safety list EN, HE | https://www.911.gov/ | 2026-10-01 | not reached |
| us_childhelp | United States | 1-800-422-4453 | +18004224453 | Childhelp National Child Abuse Hotline | EN copy; Safety list EN, HE | https://www.childhelphotline.org/ | 2026-10-06 | not reached |

Named without a number: the Belgian abuse line reads "**1712** (violence & abuse, NL) · SOS Enfants (FR)". SOS Enfants has no number, so a French-speaking parent has nothing to dial for abuse. Guy decides at the next run: add its official number (as a directory entry with EN and HE labels) or drop the name.

## Findings fixed on 28 Oct (engineering, no network)

1. The GA row says "nine numbers". The app shows 16 (13 tap-to-call directory entries, 3 display-only). The row should name this record, not a count.
2. `be_cps` (0800 32 123) was in the self-harm copy but not in `HELPLINE_DIRECTORY`, so it rendered as plain text with no call link. It is now a directory entry with EN and HE labels. A new guard fails when the copy shows a number that is neither a directory entry nor listed in `DISPLAY_ONLY_HELPLINE_NUMBERS` with a reason.
3. `be_1712` hours were a code comment with no source. The claim is removed from the comment; the row above carries it as unsourced.
4. `il_welfare` 118: the role stays as coded until the gov.il page is read; the row above names exactly what to confirm.
5. `il_eran` "(24/7)": holds for the phone line the label sits on; no change.

The GA row's "before 4 Dec" date predates B-CAREPRO-07: with the constant at 2026-10-01 the CI tripwire falls due on 2027-03-30. The release gate still needs a dated official source and result per number, which no run has produced yet.

## Prepared bump (Guy approves)

From a machine that can open the operators' pages (not this cloud session):

1. Open each row's official source. Set "Last recorded check" to the run date D and "Result of latest run" to `confirmed`, or `changed: <new number or role>`. Record the exact URL you read. Call nothing.
2. Where a number or role changed, edit `HELPLINE_DIRECTORY`, the escalation copy and the EN and HE labels in the same commit.
3. Add a runs row: `D | approved | all rows | <who verified> | Guy | <where the page captures are kept>`.
4. Set `HELPLINES_REVIEWED_ON = "D"` in `escalation.ts` and the two lines at the top of this file (constants version; next due = D + 180 days).
5. Run `npx vitest run --config scripts/vitest.config.mjs src/safety` from `app/`. `helplineRecord.test.ts` fails until steps 1 to 4 agree.
