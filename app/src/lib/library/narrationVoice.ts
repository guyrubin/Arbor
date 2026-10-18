/** Pure selection contract. Reading a voice folder must not load a builder. */
import { heGender } from "./bookText";
import type { VoiceFolder } from "./narration";
import type { BookReaderChild } from "./types";

export function narrationFolder(lang: "en" | "he", gender: BookReaderChild["gender"]): VoiceFolder {
  return lang === "he" ? (heGender(gender) === "f" ? "he-f" : "he-m") : "en";
}
