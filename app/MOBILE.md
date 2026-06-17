# Arbor mobile (iOS + Google Play)

Arbor ships to the App Store and Google Play as a [Capacitor](https://capacitorjs.com)
wrapper around the existing React/Vite web app. One codebase, two native shells.

- **Web frontend** → built to `dist/` (same as web hosting).
- **Native shells** → `ios/` (Xcode project) and `android/` (Android Studio / Gradle project).
- The native webview loads the bundled `dist/` and calls the **remote** Arbor API.

## How the native app talks to the backend

The webview origin is `capacitor://localhost` (iOS) / `https://localhost` (Android),
so the web app's relative `/api/*` calls are rewritten to an absolute base:

- `src/lib/runtime.ts` installs a `fetch` shim that re-points `/api/*` at `API_BASE`.
- `API_BASE` = `VITE_API_BASE` (build-time override) → else the prod hosting origin
  (`https://arborprd-westeu.web.app`) when running natively → else `""` (web, same-origin).
- The backend allows the native origins in CORS automatically (`src/config/env.ts`
  always includes `capacitor://localhost` and `https://localhost`). **This needs a
  backend redeploy to take effect** (Cloud Run `arbor-api`), see below.

## One-time setup

1. **Bundle id.** `capacitor.config.ts` uses the placeholder `app.arbor.family`. Set it
   to the id you register in App Store Connect / Google Play **before first submission**
   (it can't change once a listing exists), then re-run `npx cap sync`.
2. **Backend CORS redeploy** so native calls are accepted:
   `gcloud builds submit --config cloudbuild.prod.yaml --project arborprd-westeu`
   (run from `PPPPtherapy-/PPPPtherapy-/`). The native origins are baked into `env.ts`,
   so no env var change is required.

## Build & run (every change)

```bash
# from PPPPtherapy-/PPPPtherapy-/app
# Build the web app pointed at the prod API, then copy into the native projects:
VITE_API_BASE=https://arborprd-westeu.web.app npm run build
npx cap sync                 # copies dist/ + plugins into ios/ and android/

npx cap open android         # opens Android Studio  (works on Windows/macOS/Linux)
npx cap open ios             # opens Xcode           (macOS only)
```

- **Android:** in Android Studio, Build → Generate Signed App Bundle (`.aab`) → upload to
  the Play Console. First time: create a signing key and the Play app listing.
- **iOS:** in Xcode (on a Mac), set the Team/signing, then Product → Archive →
  Distribute App → App Store Connect. Requires an Apple Developer account.

> iOS **building** requires macOS + Xcode. The `ios/` project is fully generated and
> committed, so it builds as-is on any Mac — no extra scaffolding needed.

## App icon & splash

Source art lives in `assets/` (`icon-only.svg`, `icon-foreground.svg`,
`icon-background.svg`, `splash.svg`, `splash-dark.svg` — the Arbor "Sprout" on the
brand canvas). Regenerate all platform sizes after editing:

```bash
npx @capacitor/assets generate \
  --iconBackgroundColor '#eef6f0' --iconBackgroundColorDark '#141d18' \
  --splashBackgroundColor '#eef6f0' --splashBackgroundColorDark '#141d18'
```

This also emits PWA icons to `icons/`.

## Cloud CI builds (no local Android Studio / Mac needed)

Two GitHub Actions workflows build the native apps in the cloud:

- **`.github/workflows/android.yml`** (Linux runner) → debug APK + release AAB, uploaded as the `arbor-android` artifact. Runs on push to `app/**` and on demand (Actions tab → "Android build" → Run workflow).
- **`.github/workflows/ios.yml`** (macOS runner) → unsigned Xcode archive (full compile verification), uploaded as `arbor-ios-archive`.

Both build the web bundle, `npx cap sync`, then the native build. The Firebase `VITE_*` values in the workflows are the public web client config (already in the shipped bundle), not secrets.

### To produce SIGNED, submittable binaries, add repo secrets:
- **Android (Google Play):** `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (generate an upload key with `keytool -genkey -v -keystore upload.keystore -alias arbor -keyalg RSA -keysize 2048 -validity 10000`, then base64 it). Play App Signing manages the app signing key after upload.
- **iOS (App Store Connect):** `BUILD_CERTIFICATE_BASE64` + `P12_PASSWORD`, `PROVISIONING_PROFILE_BASE64`, and an App Store Connect API key — then flip `CODE_SIGNING_ALLOWED=YES` and add an `-exportArchive` step to emit a signed `.ipa`.

## Native runtime config

- `capacitor.config.ts` — app id/name, splash, status bar (dark icons on the light
  "Soft Daylight" canvas), background colors.
- `src/lib/native.ts` — runtime status bar / keyboard / splash-hide, gated to native
  only (dynamic imports, no-op on web). Adds `is-native` / `is-ios` / `is-android`
  classes + `data-platform` to `<html>` for any platform-specific CSS.
