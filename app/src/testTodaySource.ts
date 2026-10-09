import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Test-only. #/overview is NowView since the companion rewrite (7e25419e), and
 * the Today loop it runs was re-homed from the retired tabs/OverviewTab.tsx
 * into these files (parity, 9 Oct 2026). Source pins that guarded "Today"
 * read this live set, never a dead file.
 */
export const TODAY_LIVE_FILES = [
  "components/companion/NowView.tsx",
  "components/companion/useNowLoop.ts",
  "components/companion/NowLoopBlocks.tsx",
  "components/companion/NowMoreForToday.tsx",
  "components/companion/NowRecommendation.tsx",
] as const;

const SRC = path.dirname(fileURLToPath(import.meta.url));

/** One live Today file under components/companion (LF), for pins about one file's shape. */
export const todayFile = (name: string): string =>
  readFileSync(path.join(SRC, "components/companion", name), "utf8").replace(/\r\n/g, "\n");

/** The live Today source, joined (raw; callers strip comments as they did before). */
export const todayLiveSource = (): string =>
  TODAY_LIVE_FILES.map((rel) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n")).join("\n");
