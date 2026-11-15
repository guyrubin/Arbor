# Living landing page (draft, not deployed)

A redesign of the English marketing landing page: one evening followed through Arbor, with a live 3D Living Forms sculpture that reshapes across eight scroll chapters.

It lives here, outside `app/public`, so it cannot ship with a hosting deploy. `app/src/lib/marketingDeployGuard.test.ts` allows only approved files in `app/public/marketing`.

## Preview

```bash
node docs/marketing-drafts/living-landing/preview.mjs
```

Open `http://localhost:4812/marketing/arbor-living-en.html`. Add `?motion=off` for the still render.

## Before go-live

- Clinical and native review of the new copy (perspective notes, summary examples, section headings).
- Hebrew transcreation; the language link still points to the current Hebrew page.
- A viewed pass of the phone layout, the no-WebGL fallback and performance on a real phone.
- Remove `noindex`, then move every file except `preview.mjs` and this README into `app/public/marketing` unchanged and add each to `APPROVED_MARKETING_FILES` in the same pull request.
