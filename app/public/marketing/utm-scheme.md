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
| `utm_source` | `instagram` · `tiktok` · `youtube` · `facebook` · `whatsapp` · `telegram` · `creator` · `pr` · `newsletter` · `appstore` · `playstore` · `qr` · `landing` · `practitioner` | the platform/property; `practitioner` = a link or QR a professional who works with the child handed the family (BD-54) |
| `utm_medium` | `social` · `paid_social` · `influencer` · `referral` · `email` · `organic` · `press` · `qr` | the channel class |
| `utm_campaign` | `2am_test` · `avatar_challenge` · `launch_il` · `launch_en` · `evergreen` · `everyday_plans` | matches campaign names in GTM / the 2 AM-test launch doc; `everyday_plans` = the per-pattern intent pages (dark until a pattern is signed) |
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
https://arborparentingapp.com/?utm_source=instagram&utm_medium=social&utm_campaign=launch_il&utm_content=bio_link
```

## Landing-page handoff

The marketing landing pages tag their own default UTM
(`utm_source=landing&utm_medium=organic&utm_campaign=evergreen`) on every
conversion CTA (`a[data-cta="app"]`), but **incoming params always win** — a
tagged link that lands on the marketing page first has its `utm_*`/`ref`
forwarded to the app on the hop, preserving first-touch attribution.

## Practitioner handoff (BD-54)

A professional who works with a child hands the family a link or QR to one of
the Everyday-plan intent pages (`/marketing/plans/<pattern>-<lang>.html`, dark:
`noindex`, not in the sitemap, disallowed in `robots.txt`, linked from nowhere
until the pattern is signed). The link carries:

```
?utm_source=practitioner&utm_medium=referral&utm_campaign=everyday_plans&utm_content=plan_<pattern>
```

The page forwards the incoming params to the app on its CTA (incoming always
wins; its own default is `utm_source=landing&utm_medium=organic&utm_campaign=everyday_plans`),
so `source=practitioner` reaches every later event through first-touch
attribution — `paywall_view → checkout_start → paid` (BD-53) and
`plan_approved` (BD-54: "first useful action = plan") group by it in the
Attribution dashboard with no second seam.

