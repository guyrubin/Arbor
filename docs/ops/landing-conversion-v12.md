# Landing conversion v12 — 2026-10-30

The English and Hebrew landing pages use the existing Arbor artwork and type system, a controllable silent background film, an illustrative sharing preview, and a contextual trial entry. The film is a 12-second H.264 camera move over the approved `family-moment-v6.webp` artwork, not live-action footage. It is 736,958 bytes, has no audio, and loads only after the page loads and becomes visible. Reduced-motion/data-saving connections keep the still image unless the visitor presses Play. No new dependencies or media provider.

## Trial entry and data

Trial links preserve allowlisted campaign/referral parameters and explicitly select English or Hebrew. A 30-minute session-only intent stores locale, timestamp and whether its signed-in arrival was recorded. It carries no selected example, family details or billing entitlement. New visitors start the existing email form in Create account mode; existing families can switch to Sign in. All existing consent and entitlement rules still apply.

The sharing preview is fictional and local to the page. Its controls never save or send anything. Its claims refer to parent-approved observations (`ChildMemory.tsx`), selective report previews (`consult/packet.ts`) and existing export/erase controls.

## Measurement contract

Run from `app/` with the existing authorized Firestore project/credentials:

```sh
node scripts/cohort-report.mjs --since 2026-10-30 --funnel landing --activation --contract
```

The same `landing` funnel is included in the existing authenticated admin cohort report. The shared counter counts unique accounts completing `landing_entry → onboarding_completed → activated → paid`, in timestamp order, grouped by the entry event’s existing first-touch source or market. Duplicate events cannot inflate the stages. The existing activation definition remains a qualifying return on a later day. Earlier purchases or incomplete intermediate stages are not counted as full ordered completion.

Coverage: signed-in landing arrivals only, after the existing analytics opt-out and Kid Mode gates. Anonymous page views and exits are not collected. Counts are not visitor-to-signup conversion, an experiment, or evidence of uplift. The report returns this limitation alongside its data. No public analytics endpoint, tracking vendor, new collection or security-rule change was introduced.

The release environment could not retrieve a production baseline (no configured application-default project). Milestone 5 remains open until authorized cohort data and an agreed visitor denominator support a real conversion assessment. Do not translate missing data into zero traffic or claim an improvement before measurement.
