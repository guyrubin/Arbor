# Arbor — App Store & Google Play submission pack

Everything needed to publish Arbor 1.0. The engineering is done and **both native
apps build green in CI**; the remaining items are account actions only the account
owner can perform (enrolment, API keys, signing keys). Hand this doc to whoever
owns the Apple/Google accounts.

---

## 0. Status at a glance

| Piece | State |
| :-- | :-- |
| Web app + backend (prod) | ✅ Live, auto-deploys `main` → `arborprd-westeu.web.app` + Cloud Run `arbor-api` |
| Android release AAB | ✅ Builds green (`.github/workflows/android.yml`) |
| iOS archive (compile) | ✅ Builds green on Xcode 26 / macos-26 (`.github/workflows/ios.yml`) |
| iOS signed IPA → TestFlight | ⛔ Needs Apple secrets (below) |
| Android signed AAB | ⛔ Needs upload-keystore secrets (below) |
| Privacy Policy / Terms URLs | ✅ `https://arborprd-westeu.web.app/privacy.html` · `/terms.html` |
| App icons + splash | ✅ Both platforms |
| Bundle id | ✅ `app.arbor.family` (consistent across iOS/Android/Capacitor) |
| Version | 1.0 (build 1) both platforms |

**Bundle id is locked to `app.arbor.family`.** It cannot change after a store
listing exists — register exactly this on both stores. (To change it, do so before
first submission and re-run `npx cap sync`.)

---

## 1. Apple App Store — owner steps

1. **Enrol** in the Apple Developer Program — https://developer.apple.com/programs/ ($99/yr).
2. In **App Store Connect → Users and Access → Integrations → App Store Connect API**,
   create an **API key** with **App Manager** role and download the `.p8` (you only get
   it once).
3. **App Store Connect → Apps → +** → create the app record with bundle id
   `app.arbor.family`, primary language English, name **Arbor**.
4. Add these repo **secrets** (GitHub → repo → Settings → Secrets and variables → Actions):
   - `ASC_KEY_ID` — the API key's Key ID
   - `ASC_ISSUER_ID` — the Issuer ID (top of the API keys page)
   - `ASC_KEY_CONTENT` — the `.p8` file **base64-encoded**
     (`base64 -i AuthKey_XXXX.p8 | pbcopy` on a Mac, or `certutil -encode` on Windows)
   - (optional var) `IOS_BUNDLE_ID` — only if you registered something other than `app.arbor.family`
5. Push to `main` (or Actions → "iOS build" → Run workflow). Fastlane builds a **signed
   IPA** and uploads it to **TestFlight** — no Mac needed. Promote to the App Store from
   App Store Connect once the build finishes processing.

## 2. Google Play — owner steps

1. Create a **Play Console** account — https://play.google.com/console ($25 one-time).
2. **Create app** → name **Arbor**, default language English, app (not game), free/paid.
3. Generate an **upload keystore** (one command, keep the file + passwords safe):
   ```
   keytool -genkey -v -keystore upload.keystore -alias arbor \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
4. Add repo **secrets**:
   - `ANDROID_KEYSTORE_BASE64` — `base64 upload.keystore`
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (=`arbor`), `ANDROID_KEY_PASSWORD`
5. Run the **Android build** workflow → download the **`arbor-android` AAB** artifact →
   upload to Play Console (Production or Internal testing). Enrol in **Play App Signing**
   when prompted (Google manages the final signing key; your upload key just signs uploads).

---

## 3. Store listing copy (paste-ready)

**App name:** Arbor
**Subtitle / short description (≤30 / ≤80 chars):** Calm, smart child development
**Promo text (Apple, ≤170):** Understand your child's development with warm, non‑diagnostic guidance, playful practice, and a hero avatar that grows with them.

**Full description:**
> Arbor is a calm, intelligent companion for the everyday work of raising a young
> child. Track milestones, capture little observations, and turn them into warm,
> practical guidance — never diagnostic, always on your side.
>
> • **Today** — one glanceable focus for your child, drawn from what you've logged.
> • **Practice & Play** — short, joyful activities for speech, language and early
>   skills, starring your child's own hero avatar.
> • **Academy** — bite-size, evidence-informed reading for parents, when you want it.
> • **Hero avatar & comics** — a friendly, privacy-first character your child can see
>   themselves in, across stories and play.
> • **Memory that's yours** — your family's data stays private, stored in the EU, and
>   you can export or delete it anytime.
>
> Arbor gives general parenting support and is not a medical device or a substitute
> for professional advice.

**Keywords (Apple, ≤100 chars):** parenting,child development,milestones,toddler,speech,early learning,kids,family

**Support URL:** https://arborprd-westeu.web.app   **Marketing URL:** same
**Privacy Policy URL:** https://arborprd-westeu.web.app/privacy.html

**Screenshots (you must provide):** 6.7" iPhone + 5.5" iPhone + 12.9" iPad (Apple);
phone + 7"/10" tablet (Play). Capture Today, Practice & Play, a hero comic, Academy.
*(Screenshots are the one asset CI can't generate — take them from the running app.)*

---

## 4. Data-safety / privacy labels (pre-filled answers)

Both stores make you declare data practices. Use these (consistent with `/privacy.html`):

| Question | Answer |
| :-- | :-- |
| Collects personal data? | Yes — email (account), child name/age (user content), optional photo/audio for features |
| Sold to third parties? | **No** |
| Shared with third parties? | Only processors (Google Cloud/Firebase, Google AI) + professionals the user explicitly authorises |
| Used for third-party advertising? | **No** |
| Used for tracking (Apple ATT)? | **No** — no cross-app tracking, no IDFA |
| Data encrypted in transit? | Yes (HTTPS) |
| User can request deletion? | Yes — in-app export/erase + email |
| Children's data / target age | Parent-operated; child info managed by the adult. **Do not** mislabel as child-directed unless you opt into the kids programmes below. |

### Kids categories — decision needed
- **Apple "Kids" category** and **Google "Designed for Families"** impose strict rules
  (no third-party analytics/ads that collect PII, COPPA compliance). Arbor is built
  **for parents about their children**, so the safe default is to list it under
  **Education / Lifestyle / Parenting — NOT the Kids category** and set the age rating
  to the standard adult-facing tier. This avoids the strictest review path while staying
  honest. Revisit "Designed for Families" later if you want child-directed distribution.

---

## 5. Pre-submit checklist
- [ ] Apple + Google accounts created; app records made with id `app.arbor.family`
- [ ] Secrets added (Apple ×3, Android ×4); workflows run → TestFlight build + signed AAB
- [ ] Screenshots captured and uploaded
- [ ] Listing copy + privacy URL + data-safety form filled (sections 3–4)
- [ ] Age rating questionnaire completed; category = Education/Parenting (not Kids)
- [ ] Submit for review

Full build mechanics live in `app/MOBILE.md`.
