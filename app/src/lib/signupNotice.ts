/**
 * B-RESID-05: "we sent a link to confirm your email". The login screen
 * unmounts the moment the new account exists (App renders onboarding for a
 * signed-in parent with no child), so the line is said where the parent lands:
 * AuthContext marks it once the link has actually been sent, and the first-run
 * flow shows it on its first step, then lets it go. sessionStorage (this tab
 * only, no address or id), with an in-tab subscription so a mark that lands
 * after onboarding has mounted still shows.
 */
const KEY = "arbor.auth.verifySent";
const listeners = new Set<() => void>();
let memory = false;

function emit() { listeners.forEach((listener) => listener()); }

export function markVerifySent(): void {
  memory = true;
  try { sessionStorage.setItem(KEY, "1"); } catch { /* memory still carries it in this tab */ }
  emit();
}

export function verifySentPending(): boolean {
  if (memory) return true;
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function clearVerifySent(): void {
  const was = verifySentPending();
  memory = false;
  try { sessionStorage.removeItem(KEY); } catch { /* nothing kept */ }
  if (was) emit();
}

export function subscribeVerifySent(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
