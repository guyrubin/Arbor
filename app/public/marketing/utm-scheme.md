# Arbor UTM Scheme — single source of truth (P0-5)

Every outbound link the GTM plan builds (creator links, the 2 AM-test campaign,
paid, PR, QR) MUST follow this scheme. Lowercase, snake_case, ASCII only.
Consistency is what lets the in-app **Attribution & funnel** dashboard aggregate
channels (`facebook`, not `Facebook`/`fb`).

Capture lives in `app/src/lib/attribution.ts` (`UTM_KEYS`, first-touch persist to
`localStorage["arbor.attribution"]`); every analytics event inherits it via
`setGlobalProps`. The dashboard (`AttributionTab.tsx`) reads it back.

## Parameters

| Param | Allowed values (canonical) | Notes |
| :-- | :-- | :-- |
| `utm_source` | `instagram` · `tiktok` · `youtube` · `facebook` · `whatsapp` · `telegram` · `creator` · `pr` · `newsletter` · `appstore` · `playstore` · `qr` · `landing` | the platform/property |
| `utm_medium` | `social` · `paid_social` · `influencer` · `referral` · `email` · `organic` · `press` · `qr` | the channel class |
| `utm_campaign` | `2am_test` · `avatar_challenge` · `launch_il` · `launch_en` · `evergreen` | matches campaign names in GTM / the 2 AM-test launch doc |
| `utm_content` | freeform slug, snake_case (e.g. `hero_video_a`, `bio_link`) | creative/placement variant for A/B |
| `utm_term` | optional — paid keyword | |
| `ref` | referral code (P0-2) | parsed by `attribution.ts` as `referralCode`; `source` becomes `"referral"` |

## Market is NOT a UTM param

`attribution.ts:detectMarket()` derives market from the path prefix
(`/il` `/nl` `/be` `/ie` `/uk`) or the UI language (`he`→`il`, `nl`→`nl`,
else `intl`). Do not encode market in UTM. Marketing landing pages resolve market
via `<html lang>`.

## Canonical example (Instagram bio, IL launch)

```
https://arborprd-westeu.web.app/?utm_source=instagram&utm_medium=social&utm_campaign=launch_il&utm_content=bio_link
```

## Landing-page handoff

The marketing landing pages tag their own default UTM
(`utm_source=landing&utm_medium=organic&utm_campaign=evergreen`) on every
conversion CTA (`a[data-cta="app"]`), but **incoming params always win** — a
tagged link that lands on the marketing page first has its `utm_*`/`ref`
forwarded to the app on the hop, preserving first-touch attribution.
