/** Thin wrapper around the browser SpeechSynthesis API for reading stories aloud. */

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, onend?: () => void) {
  if (!ttsSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.onend = () => onend?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
