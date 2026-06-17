# Arbor Incident-Response & Breach-Notification Runbook

**Status:** Wave-0 build-ready · replaces the 451-byte stub at `docs/compliance/incident-response-plan.md`
**Missions:** OPS-5 (incident runbook) + CMP-6 (breach detection → notification workflow)
**Markets (both first-class):** Netherlands (NL — GDPR/AVG, Autoriteit Persoonsgegevens) · Israel (IL — Privacy Protection Law + Amendment 13, in force Aug 2025)
**Owner:** Founder / Incident Commander (single-person on-call today; see §2)
**Last reviewed:** 2026-06-17 · **Review cadence:** quarterly + after every Sev1/Sev2 + after any framework/safety-copy change (OPS-6)

> This runbook is the operational source of truth for *what we do when something breaks or leaks*. It is grounded in Arbor's real levers (Cloud Run on `europe-west4`, Firestore, the `/api` middleware chain, `MODEL_PROVIDER` flip, `infra/rollback.sh`, OPS-1 alert policies, the CMP-5 `auditEvents` ledger). Do not invent capabilities — every action below maps to a lever that exists or is being built in this migration set.

---

## 0. How to use this runbook in the first 5 minutes

1. **An alert fired or someone reported something.** Open this file. Do not start fixing yet.
2. Go to **§3 Severity matrix** → classify Sev1 / Sev2 / Sev3.
3. Go to **§4 The five phases** (Detect → Triage → Contain → Notify → Postmortem) and work them in order.
4. If a **personal-data breach** is in scope (child data of an EU/Dutch or Israeli data subject exposed, altered, lost, or accessed without authorization), **start the §6 BREACH CLOCK the moment you become aware**. Awareness starts the legal timer, not resolution.
5. Open the **incident log** (§5.1) and record timestamps as you go. The log is later evidence for both the Autoriteit Persoonsgegevens (NL) and the Privacy Protection Authority (IL).

**Golden rule:** *Awareness starts the clock. Containment does not stop it. Notification is a legal obligation, not a courtesy.*

---

## 1. Scope & what counts as an incident

An **incident** is any event that threatens the confidentiality, integrity, or availability of Arbor, its users, or — above all — **child-sensitive data**. The four canonical trigger events (carried forward from the original stub, each now mapped to a severity and an owner in §3):

| # | Trigger event | Default severity | Personal-data breach? |
|---|---|---|---|
| T1 | **Unauthorized child-data access** (auth bypass, leaked token, Firestore rule hole, exposed export) | **Sev1** | **Yes — breach clock starts** |
| T2 | **Unsafe AI output reaching a parent** (safety screen bypassed; harmful/clinical-claim/self-harm content delivered) | **Sev1 / Sev2** | Usually no (not a confidentiality breach) — but see T3 |
| T3 | **High-risk safety disclosure mishandled** (a child-safety/self-harm disclosure not escalated per `safety/escalation.ts`) | **Sev1** | Possibly (duty-of-care + data) |
| T4 | **Data export/delete failure** (`/api/privacy/export` or `/api/privacy/erase` silently fails; erasure incomplete across the two data trees) | **Sev2** | **Yes if data that should be erased persists** — data-subject-rights breach |

Additional incident classes detected via OPS-1 / CMP-6 signals: 5xx error spikes, 401/403 floods (auth-bypass attempts), CORS/CSP violation spikes, anomalous `data.export` / `data.delete` volume, provider/model outage, Firestore unavailability.

**Not an incident (handle as a normal bug/ticket):** a single non-sensitive 500, a known-flaky test, a cosmetic RTL/layout glitch with no data impact.

---

## 2. Roles & on-call

At current stage **one person (the Founder) wears all hats**. The roles are still named so that responsibilities are explicit and so the runbook scales when the team grows. When solo, work the roles sequentially; the Scribe duty (the incident log) is **never skipped** even solo — it is the evidence trail.

| Role | Responsibility | Held by (today) |
|---|---|---|
| **Incident Commander (IC)** | Owns the incident end-to-end. Declares severity, decides containment, decides whether a breach is notifiable, authorizes notifications. The only role that can declare "resolved." | Founder |
| **Comms Lead** | Drafts and (after IC sign-off) sends authority + data-subject notifications and any user-facing status. Owns the §7 templates incl. the Hebrew variant. | Founder |
| **Scribe** | Maintains the incident log (§5.1) with UTC timestamps. Captures the **awareness timestamp** (T0) verbatim — this anchors the breach clock. | Founder |
| **Technical lead / responder** | Executes containment levers (§4.3), pulls traces/logs, runs `infra/rollback.sh`. | Founder |
| **DPO / privacy contact** | Privacy-law decision support. **IL Amendment 13 note:** if Arbor's database scale crosses the IL DPO-appointment threshold, a DPO must be formally appointed and named here. **NL note:** named DPO/privacy contact is a B2G (municipality/JGZ/insurer) DPA requirement. | TBD — record name + email here before private beta |
| **Legal counsel** | Sign-off on breach notifiability and on the wording of authority notices. **Human gate** — cannot be performed by an agent. | External counsel (engage before beta) |

**Escalation path / on-call rota** lives in `docs/ops/on-call.md` (created alongside this runbook). It carries: primary contact + phone, backup, GCP project/console link, and the two regulators' intake channels (§6). Keep it current — a stale on-call entry is itself a Sev3.

---

## 3. Severity matrix

| Severity | Definition | Examples | First owner | Target ack |
|---|---|---|---|---|
| **Sev1 — Critical** | Active or probable exposure/loss of **child-sensitive data**, a safety-screen bypass delivering harmful content, OR full outage. Likely a notifiable breach. | T1 unauthorized child-data access; T3 mishandled self-harm disclosure; mass safety bypass; Firestore data leak. | IC immediately; engage counsel | **≤ 15 min** |
| **Sev2 — High** | Material degradation or a contained data issue; data-subject-rights failure; single unsafe output. Possibly notifiable. | T4 export/erase failure; a single safety bypass to one parent; elevated 5xx; partial erasure. | IC | **≤ 1 h** |
| **Sev3 — Low** | Minor/contained, no data exposure, no safety impact. | Latency regression; non-sensitive 500 spike; cosmetic RTL bug; flaky smoke. | Technical lead | next business day |

**Promotion rule:** when uncertain whether child data was exposed, treat as **Sev1** until proven otherwise. Under-classifying a breach is the expensive mistake — the breach clock (§6) runs from awareness regardless of your initial label, so a late re-classification does **not** reset the timer.

---

## 4. The five phases — Detect → Triage → Contain → Notify → Postmortem

### 4.1 Detect (ties to OPS-1 alerting)

Detection is the OPS-1 / CMP-6 observability layer. Signals:

- **OPS-1 alert policies** (`infra/monitoring/alert-policies.yaml`): 5xx error-rate > 2% / 5 min; p95 latency > 5 s / 10 min — fire to the founder notification channel.
- **CMP-6 log-based metrics + alert policies** (config, not code): spikes in 401/403 (auth-bypass attempts), anomalous `data.export` / `data.delete` volume (derived from the CMP-5 `auditEvents` ledger), CORS/CSP violation spikes, Cloud Run error-rate.
- **GCP Error Reporting** auto-grouping of `severity:ERROR` lines from `server/logger.ts` (already emitted; OPS-1 verifies grouping).
- **Cloud Trace** correlation: every `/api/*` log line carries `logging.googleapis.com/trace` (OPS-1), so a request's logs, its `ai.usage` line, and any error sit in one trace view.
- **Human reports:** a parent emails, a design-partner flags an unsafe output, a professional user reports a wrong handoff. A human report is a valid detection — log T0 = the moment Arbor *became aware*, which for an external report is when it reached the founder inbox.

→ The instant a signal suggests **personal-data** exposure, jump to §6 and note T0. Detection and breach-clock start can be the same instant.

### 4.2 Triage

1. **Scribe opens the incident log** (§5.1); record T0 (awareness), reporter, raw signal.
2. **IC classifies severity** (§3).
3. **Scope the blast radius** using least-exposure log review (see §4.3 redaction note): which route, which provider, how many children/users, what data categories (profile JSON: age, languages, challenges, strengths, schoolContext — note `server/redaction.ts` strips child *name*/email/phone at the model seam, but the **profile JSON still reaches the LLM** on several routes — residual risk SEC-3). Pull the CMP-5 `auditEvents` for `data.export` / `data.delete` / `share.create` around the window via `GET /api/audit`.
4. **Breach decision:** is this a *personal-data breach* (confidentiality, integrity, or availability of personal data compromised)? If yes or *probably*, the §6 clock is already running. Engage counsel.
5. **Market scope:** are NL (Dutch/EU) data subjects affected? Are IL (Israeli) data subjects affected? **Both regimes can apply at once** — a single incident touching both markets triggers **both** notification paths (Autoriteit Persoonsgegevens *and* the IL Privacy Protection Authority). Record the affected-market(s) explicitly.

### 4.3 Contain (real Arbor levers only)

Pick the smallest lever that stops the bleeding. All levers below are real:

| Lever | How | When |
|---|---|---|
| **Disable a single route** | Remove/short-circuit the route's entry in the `/api` middleware chain in `app/src/server/createApp.ts` (mounts at lines 99–125, e.g. the `/api/chat`, `/api/council`, `/api/vision`, `/api/generate-*` mounts) and redeploy, OR gate it behind a feature flag. | A specific route is leaking or emitting unsafe output. |
| **Flip the model provider** | Change `MODEL_PROVIDER` env (prod-invariant `vertex`; staging mirrors it) — switch provider or disable AI calls for a route family. | An AI provider is the fault source (bad outputs, provider breach). |
| **One-command rollback** | `infra/rollback.sh` (OPS-2) → `gcloud run services update-traffic arbor-api --to-revisions <prev>=100`. Emits a `deploy.rollback` event (OPS-3 / MTTR). | A bad deploy caused the incident. |
| **Revoke access / rotate** | Invalidate the leaked Firebase token/session; rotate the affected secret; tighten the offending `firestore.rules` match block and redeploy rules. | Auth bypass / leaked credential / rules hole (T1). |
| **Freeze exports/erasure** | Disable `/api/privacy/export` / `/api/privacy/erase` mounts until the failure (T4) is fixed, to avoid partial/incorrect data operations. | Export/erase failure. |
| **Least-exposure log review** | Review via `server/logger.ts` (AI bodies are never logged) + `server/redaction.ts`; query CMP-5 `auditEvents` for the *fact* of access without re-exposing child content. **Never** export raw child-sensitive content into incident notes. | Always, during scoping. |

**Preserve evidence before you change anything destructive:** snapshot relevant Cloud Logging entries (by trace id / request id), capture the CMP-5 `auditEvents` for the window, and note the current Cloud Run revision. The CMP-5 ledger is PII-scrubbed and immutable — it is the safe evidence source.

### 4.4 Notify

→ See **§6 Breach clock** (legal timers, both markets) and **§7 Templates** (incl. Hebrew). The IC authorizes; the Comms Lead sends after counsel sign-off. Notification is its own phase because it has hard legal deadlines independent of technical resolution.

### 4.5 Postmortem (blameless)

Within **5 business days** of resolution, write a blameless postmortem (template §5.2). Required for every Sev1/Sev2. Cover: timeline (from the incident log), root cause, blast radius, what detection caught it / what it missed, every lever used, breach-clock compliance (did we hit 72h / the IL deadline?), and **action items with owners + dates**. File under `docs/ops/postmortems/`. Feed gaps back into OPS-1 alerts, OPS-2 smoke tests, OPS-4 coverage, and OPS-6 framework change-control.

---

## 5. Artifacts

### 5.1 Incident log template (Scribe maintains; all times UTC)

```
INC-<YYYYMMDD>-<n>
Severity:            Sev_
T0 awareness (UTC):  <timestamp>   ← BREACH CLOCK START
Detected by:         <alert id / human report>
IC / Comms / Scribe: <names>
Affected markets:    [ ] NL (EU/AVG)   [ ] IL (Amendment 13)
Personal-data breach?  [ ] No  [ ] Probable  [ ] Confirmed
Data categories:     <child profile fields / memory / share grants / none>
Subjects affected:   <count / unknown>
Timeline:
  <ts> detected ...
  <ts> classified Sev_
  <ts> contained via <lever>
  <ts> breach decision: notifiable? <y/n> — counsel: <name>
  <ts> AP (NL) notified  /  PPA (IL) notified  /  data subjects notified
  <ts> resolved
Evidence refs:       <trace ids, audit event ids, revision>
```

### 5.2 Postmortem template

```
# Postmortem — INC-<id> — <title>
Severity / Duration / Markets affected
## Summary (3 lines)
## Timeline (from incident log)
## Root cause
## Blast radius (subjects, data categories, breach y/n)
## Detection — caught by / missed by
## Containment levers used
## Breach-clock compliance (T0 → notification deltas vs 72h / IL deadline)
## What went well
## Action items  (owner · due date · tracking)
```

---

## 6. THE BREACH CLOCK — both markets, first-class

> **Start the moment you become aware** (T0 in the incident log). Awareness = reasonable certainty a personal-data breach has occurred, not full investigation. Both clocks below can run **simultaneously** for one incident.

### 6.1 Netherlands / EU — GDPR + Dutch AVG

| Step | Deadline from T0 | To whom | Trigger |
|---|---|---|---|
| **Notify supervisory authority** | **72 hours** (GDPR Art. 33) | **Autoriteit Persoonsgegevens (AP)** — the Dutch DPA. Use the AP's online datalek (data-breach) notification portal. | Any personal-data breach **unless** unlikely to result in a risk to rights/freedoms. For a **children's** product, default to *notify*. |
| **Notify data subjects** | **Without undue delay** (GDPR Art. 34) | Affected parents/guardians (and, age-appropriately, children) | When the breach is **likely to result in a high risk** to rights/freedoms. Children + sensitive data → high-risk by default. |
| **If >72h** | — | AP, in the notification | Art. 33(1): explain the **reasons for the delay**. Late ≠ exempt — notify anyway with justification. |
| **Internal record** | Always, even if not notified | Internal breach register | Art. 33(5): document **every** breach (facts, effects, remedial action) regardless of notifiability. Use §5.1 + the CMP-5 ledger. |

**NL specifics:** DPIA is effectively **mandatory** here (Art. 35 — children + profiling); the breach narrative cross-references the DPIA's identified risks. Name the AP explicitly in B2G DPAs. Cross-link: `docs/compliance/dpa-outline.md` (Breach notification section), `docs/compliance/data-retention-policy.md`.

### 6.2 Israel — Privacy Protection Law + Amendment 13 (in force Aug 2025)

| Step | Deadline from T0 | To whom | Trigger |
|---|---|---|---|
| **Notify the supervisory authority** | **Promptly / without delay** per the Amendment 13 / Security Regulations regime for a **serious security incident** (a severe breach of a database holding sensitive/children's data) | **Privacy Protection Authority (PPA)** — the Israeli regulator (formerly ILITA) | A **serious security incident** affecting a database subject to the high/medium security tier (Arbor's child-sensitive data qualifies). |
| **Notify data subjects** | Without delay, as directed | Affected guardians (Hebrew/RTL) | Where the incident is likely to harm data subjects, or where the PPA directs notification. |
| **Database accountability** | Ongoing | Internal + PPA on request | Amendment 13 strengthens **database accountability**: maintain the database record, the security tier classification, and (if scale crosses the threshold) an appointed **DPO**. The CMP-5 audit ledger is the accountability evidence. |
| **Adequacy / residency** | n/a | — | IL has **EU adequacy**; `europe-west4` residency satisfies cross-border transfer for **both** directions. State this in notices — no separate transfer mechanism needed. |

**IL specifics:** notices to Israeli guardians and any authority-facing summary **must have a Hebrew (RTL) variant** — see §7.4. Child-sensitive content in scope may itself be Hebrew; the least-exposure log-review rule (§4.3) applies equally to Hebrew content. Record `market: "IL"` to distinguish lawful basis.

### 6.3 Dual-market decision flow

```
T0 awareness logged
   │
   ▼
Personal-data breach?  ──no──► internal record (Art.33(5) / IL DB accountability) · monitor · close
   │ yes / probable
   ▼
Which subjects?  ──► NL/EU only ──► GDPR path (§6.1): AP ≤72h (+ subjects if high risk)
                 ──► IL only    ──► Amendment 13 path (§6.2): PPA promptly (+ subjects), Hebrew notice
                 ──► BOTH       ──► run BOTH paths in parallel; counsel coordinates wording
   │
   ▼
High risk to subjects?  ──yes──► notify data subjects (NL Art.34 / IL) — use §7 templates (EN + HE)
   │
   ▼
Postmortem (§4.5) records T0→notification deltas vs each deadline
```

---

## 7. Communication templates

All authority/subject-facing templates require **IC + counsel sign-off** before sending (Safety Level 3 — external action; never auto-send). Fill bracketed fields from the incident log. The §7.4 Hebrew variant is mandatory whenever an Israeli guardian or the PPA is the recipient.

### 7.1 Internal incident declaration (Slack/email to responders)

```
[INC-<id>] Sev<n> declared — <one-line>.
T0 awareness: <UTC>. IC: <name>. Markets: <NL/IL/both>.
Breach status: <No / Probable / Confirmed>. Clock running: <y/n>.
Current containment: <lever>. Incident log: <link>. Join: <channel>.
```

### 7.2 Authority notification — GDPR Art. 33 (to Autoriteit Persoonsgegevens), EN

```
To: Autoriteit Persoonsgegevens — data-breach notification (datalekmelding)
Controller: Arbor — <legal entity> · DPO/contact: <name, email>
Date/time of awareness (T0): <UTC>
Notification within 72h: <yes / no — reason for delay: ...>

1. Nature of the breach: <what happened, breach type — confidentiality/integrity/availability>
2. Categories & approx. number of data subjects: <children/guardians, count>
3. Categories & approx. number of records: <profile fields / memory events / shares>
4. Likely consequences: <risk to the children/guardians>
5. Measures taken / proposed: <containment lever, remediation, mitigation of risk>
6. Were data subjects notified (Art.34)? <yes/no + when/how>
Contact for follow-up: <name, email, phone>
```

### 7.3 Data-subject notification — GDPR Art. 34 (to parents/guardians), EN

```
Subject: Important security notice about your Arbor account

Dear <parent/guardian>,

We are writing to let you know about a security incident that may have affected
information related to your child's Arbor account.

What happened: <plain-language, no jargon>
What information was involved: <data categories — be specific and honest>
What we have done: <containment + remediation>
What you can do: <concrete steps, if any>
We have notified <the Autoriteit Persoonsgegevens / the Privacy Protection Authority>
as required by law.

We are sorry this happened and take the protection of your family's data extremely
seriously. Questions: <contact>.

— The Arbor team
```

### 7.4 Hebrew (RTL) variant — data-subject notification (IL Amendment 13)

> **דרישת RTL:** ההודעה חייבת להישלח בעברית, מיושרת לימין (RTL). זוהי הגרסה לשליחה להורים/אפוטרופוסים ישראליים, ובהתאמה לרשות להגנת הפרטיות.

```
נושא: הודעת אבטחה חשובה בנוגע לחשבון Arbor שלך

הורה/אפוטרופוס יקר/ה,

אנו פונים אליך כדי ליידע אותך על אירוע אבטחה שייתכן שהשפיע על מידע
הקשור לחשבון ה-Arbor של ילדך.

מה קרה: <תיאור בשפה פשוטה, ללא מונחים טכניים>
איזה מידע היה מעורב: <קטגוריות המידע — באופן מדויק וכן>
מה עשינו: <הכלה ותיקון>
מה ניתן לעשות: <צעדים מעשיים, אם רלוונטי>
דיווחנו לרשות להגנת הפרטיות כנדרש על פי חוק הגנת הפרטיות ותיקון 13.

אנו מצטערים על אירוע זה ומתייחסים בכובד ראש להגנה על פרטיות המשפחה שלך.
לשאלות: <פרטי קשר>.

— צוות Arbor
```

**Hebrew note for authority-facing summaries:** the PPA-facing summary mirrors §7.2's structure but in Hebrew; counsel localizes the legal references (חוק הגנת הפרטיות, תיקון 13) rather than translating GDPR articles verbatim.

### 7.5 User-facing status (only if service-affecting and non-sensitive)

```
We're investigating an issue affecting <area>. Your data is <safe / under review>.
Next update by <time>. Status: <link>.
```

---

## 8. Cross-references (verify these links resolve at review time)

- `docs/compliance/incident-response-plan.md` — the stub this runbook supersedes (apply step in §10 points the stub here).
- `docs/compliance/dpa-outline.md` — Breach-notification + international-transfer sections this runbook satisfies.
- `docs/compliance/data-retention-policy.md` — least-exposure logging; safety-review event retention as incident evidence.
- `docs/ops/on-call.md` — escalation path + contact rota (companion file).
- `infra/monitoring/alert-policies.yaml` — OPS-1 detection layer (5xx, p95 latency) feeding §4.1.
- `infra/rollback.sh` — OPS-2 one-command rollback lever (§4.3).
- CMP-5 audit ledger — `auditEvents` collection + `GET /api/audit`: PII-scrubbed, immutable evidence source for scoping (§4.2) and breach records (§6).
- `app/src/server/createApp.ts` (lines 99–125) — route-disable containment points (§4.3).
- `app/src/server/redaction.ts` / `app/src/server/logger.ts` — least-exposure review primitives (§4.3).
- DPIA (CMP-2, NL Art. 35) — risk register the breach narrative references (§6.1).

---

## 9. Tabletop dry-run (CMP-6 done-when)

Run at least one tabletop before private beta and after major changes. **Scenario:** *an unsafe AI output reaches a parent in Hebrew, and a parent reports it; investigation finds the profile JSON for 3 children was logged in a debug build.* Walk every phase:

- Detect: was it an alert or a human report? Log T0.
- Triage: Sev1 (child data + safety). Both markets? (IL guardian → IL path; if any EU child → NL path too.)
- Contain: disable the offending route in `createApp.ts`; flip `MODEL_PROVIDER` if provider-side; rollback if a deploy caused it.
- Notify: confirm the 72h AP path AND the IL PPA path both engage; confirm the Hebrew §7.4 template is ready.
- Postmortem: confirm action items land in OPS-1/OPS-2/OPS-4/OPS-6.

**Pass criterion:** every step maps to a real lever and a named owner, and every cross-reference link in §8 resolves.

---

## 10. Apply steps (human / clean-baseline run — this runbook is the source-of-truth draft)

1. Copy this file's content over the 451-byte stub at `docs/compliance/incident-response-plan.md` (the canonical OPS-5/CMP-6 location), OR replace the stub body with a one-line pointer to this runbook. Done on the clean baseline, not in this dirty tree.
2. Create the companion `docs/ops/on-call.md` (escalation path + rota + AP/PPA intake channels). Fill the DPO/counsel names left as TBD in §2.
3. Add an "Operations" link in `README.md` pointing to the runbook (OPS-5 done-when).
4. **Legal/human gate:** counsel to confirm (a) the IL Amendment 13 serious-incident deadline wording, (b) the AP datalek portal fields, and (c) localize the Hebrew §7.4 legal references. The breach clock and templates must not go to beta without this sign-off.
5. Confirm OPS-1 (`infra/monitoring/alert-policies.yaml`) and OPS-2 (`infra/rollback.sh`) land so §4 levers are live; wire the CMP-6 log-based metrics (401/403 spikes, `data.export`/`data.delete` anomalies) as config.
