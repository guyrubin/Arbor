# Arbor Israel Domain Launch Runbook

Date: 2026-06-17

## Recommendation

Use a local Israeli domain for the Hebrew marketing surface.

Preferred order:

1. `arbor.co.il`
2. `getarbor.co.il`
3. `hellarbor.co.il`
4. `arbor.health` or `arbor.care` for a later international health/care brand

Avoid using `arborprd-westeu.web.app` in public campaigns. Keep it as the
technical Firebase Hosting origin until a brand domain is connected.

## SEO Positioning

Recommended public structure after domain purchase:

- Hebrew primary: `https://arbor.co.il/`
- English secondary: `https://arbor.co.il/en/`
- Sitemap: `https://arbor.co.il/sitemap.xml`
- LLM discovery: `https://arbor.co.il/llms.txt`

Do not switch canonical URLs, sitemap URLs, or `llms.txt` URLs to a custom
domain before the domain is purchased, verified, and serving the same content
over HTTPS. Premature canonical changes can confuse indexing.

## Firebase Hosting Setup

Firebase project: `arborprd-westeu`

Firebase docs: https://firebase.google.com/docs/hosting/custom-domain

1. Buy the selected domain through an Israeli registrar.
2. Open Firebase Console -> Hosting -> `arborprd-westeu`.
3. Click `Add custom domain`.
4. Add the apex domain, for example `arbor.co.il`.
5. Add `www.arbor.co.il` as a second custom domain and redirect it to the apex
   domain, or keep the apex redirected to `www` if the brand chooses `www` as
   canonical.
6. Add the Firebase-provided TXT verification record at the registrar.
7. After verification, add the Firebase A records shown in the wizard. Firebase
   commonly uses:
   - `A @ 199.36.158.100`
   - `A www 199.36.158.100`
8. Remove old A, AAAA, or CNAME records that point the same hostname elsewhere.
9. Wait for Firebase SSL provisioning. Firebase documentation says this can take
   up to 24 hours after DNS points to Firebase Hosting.
10. Verify:
    - `https://arbor.co.il/marketing/`
    - `https://arbor.co.il/sitemap.xml`
    - `https://arbor.co.il/llms.txt`

## Code Changes After Domain Is Live

Replace the Firebase origin in the marketing static files:

```powershell
$old = 'https://arborprd-westeu.web.app'
$new = 'https://arbor.co.il'
Get-ChildItem -Path app/public -Include *.html,*.xml,*.txt,*.md -Recurse |
  ForEach-Object {
    (Get-Content -Raw -LiteralPath $_.FullName).Replace($old, $new) |
      Set-Content -LiteralPath $_.FullName -Encoding UTF8
  }
```

Then rebuild and deploy:

```powershell
cd C:\Users\dguyr\ROS\PPPPtherapy-\PPPPtherapy-\app
npm.cmd run build
cd ..
Remove-Item -LiteralPath 'app\dist\server.cjs','app\dist\server.cjs.map' -Force -ErrorAction SilentlyContinue
npx.cmd --yes firebase-tools deploy --only hosting --project arborprd-westeu --non-interactive
```

## Search Console

After the custom domain is live:

1. Add `https://arbor.co.il` as a Google Search Console property.
2. Submit `https://arbor.co.il/sitemap.xml`.
3. Request indexing for:
   - `/marketing/`
   - `/marketing/arbor-marketing-landing-page-he.html`
   - `/marketing/guides.html`
   - `/marketing/he/maarechet-hafala-hitpatchut-hayeled.html`
4. Keep the Firebase URL available during the transition, but advertise only the
   custom domain.

