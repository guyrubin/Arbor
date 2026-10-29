import { Capacitor, registerPlugin } from "@capacitor/core";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, type Auth } from "firebase/auth";
import { isNativePlatform, nativePlatform } from "./runtime";

/**
 * B-GA-19 (agent half) — Apple and the native Google path, in code.
 *
 * Inside the native shells a Firebase popup or redirect cannot complete (the webview is
 * capacitor://localhost, not a browser tab), so a native build signs in through the platform:
 * the native Firebase Authentication plugin returns the provider's credential and the Firebase
 * JS SDK signs in WITH it (`skipNativeAuth`), so the one web session, the ID token the API
 * verifies and onAuthStateChanged stay the single source of the signed-in family.
 *
 * The plugin is the `FirebaseAuthentication` native plugin (the @capacitor-firebase/authentication
 * API; only the calls below). It is bound by name, so this code is inert until a binary ships the
 * plugin: `nativeSignInAvailable()` is false on the web and in a native build without it, and the
 * existing web path runs unchanged. Apple stays dark until the provider is configured
 * (VITE_AUTH_APPLE_ENABLED=true). Guy's half: add the plugin with its native config, enable Apple
 * in Firebase and the Apple developer account, set the flag, and verify on real devices.
 */
export const NATIVE_AUTH_PLUGIN = "FirebaseAuthentication";

type NativeCredential = { idToken?: string; accessToken?: string; nonce?: string };
type NativeSignInResult = { credential?: NativeCredential | null };
interface NativeAuthPlugin {
  signInWithGoogle(options?: { skipNativeAuth?: boolean; scopes?: string[] }): Promise<NativeSignInResult>;
  signInWithApple(options?: { skipNativeAuth?: boolean; scopes?: string[] }): Promise<NativeSignInResult>;
  signOut(): Promise<void>;
}

let plugin: NativeAuthPlugin | null = null;
const native = (): NativeAuthPlugin => (plugin ??= registerPlugin<NativeAuthPlugin>(NATIVE_AUTH_PLUGIN));

/** True only in a native shell whose binary ships the native auth plugin. */
export function nativeSignInAvailable(): boolean {
  return isNativePlatform && Capacitor.isPluginAvailable(NATIVE_AUTH_PLUGIN);
}

/** Whether to offer "Continue with Apple": the provider is configured (build flag), and the
 *  surface can complete it — the web (popup/redirect) or iOS with the native plugin. */
export function appleSignInOffered(flag: string | undefined = import.meta.env.VITE_AUTH_APPLE_ENABLED as string | undefined): boolean {
  if (flag !== "true") return false;
  if (!isNativePlatform) return true;
  return nativePlatform === "ios" && nativeSignInAvailable();
}

/** The web Apple provider (popup, or redirect when the popup is blocked). */
export function appleProvider(): OAuthProvider {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return provider;
}

const missingToken = (provider: string) => Object.assign(new Error(`native ${provider} sign-in returned no ID token`), { code: "auth/invalid-credential" });

/** Native Google: the platform account picker, then the Firebase JS session from its credential. */
export async function nativeGoogleSignIn(auth: Auth) {
  const { credential } = await native().signInWithGoogle({ skipNativeAuth: true });
  if (!credential?.idToken) throw missingToken("Google");
  return signInWithCredential(auth, GoogleAuthProvider.credential(credential.idToken, credential.accessToken));
}

/** Native Apple (iOS): the system sheet, then the Firebase JS session; the nonce binds the token. */
export async function nativeAppleSignIn(auth: Auth) {
  const { credential } = await native().signInWithApple({ skipNativeAuth: true });
  if (!credential?.idToken) throw missingToken("Apple");
  return signInWithCredential(auth, new OAuthProvider("apple.com").credential({ idToken: credential.idToken, rawNonce: credential.nonce }));
}

/** A parent who closes the native sheet is not an error. */
export function isNativeCancel(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return /cancel/i.test(String(e?.code ?? "")) || /cancel/i.test(String(e?.message ?? ""));
}

/** Sign the platform account out too, so the next sign-in asks which account again. */
export async function nativeSignOut(): Promise<void> {
  if (!nativeSignInAvailable()) return;
  try { await native().signOut(); } catch { /* the Firebase JS sign-out is what ends the session */ }
}
