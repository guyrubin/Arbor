import { authHeaders } from "./api";
import { translate, type UiLang } from "./i18n";
import { clearSituationKept, type SituationMoment } from "./trialEntry";

/** The parent-facing fact for a kept walkthrough example. Authored, not generated. */
export function landingExampleFact(moment: SituationMoment, lang: UiLang): string {
  return translate(lang, `elev.situation.example.fact.${moment}`);
}

export const LANDING_EXAMPLE_PROMPT = "landing:example";

export type LandingExampleProposal =
  | { status: "pending"; memoryId: string }
  | { status: "settled" }
  | { status: "unavailable" };

type ReviewItem = { memoryId?: string; fact?: string; status?: string; prompt?: string };

const inflight = new Map<string, Promise<LandingExampleProposal>>();

function classify(items: ReviewItem[]): LandingExampleProposal {
  const mine = items.filter(item => item.prompt === LANDING_EXAMPLE_PROMPT && typeof item.memoryId === "string");
  const pending = mine.find(item => item.status === "pending");
  if (pending?.memoryId) return { status: "pending", memoryId: pending.memoryId };
  if (mine.some(item => item.status === "approved" || item.status === "rejected")) return { status: "settled" };
  return { status: "unavailable" };
}

/** Propose the kept illustration as a pending memory. No model call. */
export function proposeLandingExample(childId: string, moment: SituationMoment, lang: UiLang): Promise<LandingExampleProposal> {
  const key = `${childId}:${moment}:${lang}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = (async (): Promise<LandingExampleProposal> => {
    const fact = landingExampleFact(moment, lang);
    const res = await fetch(`/api/memory/${encodeURIComponent(childId)}/propose`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ fact, source: "landing-example", retention: "3 months", prompt: LANDING_EXAMPLE_PROMPT }),
    });
    if (!res.ok) return { status: "unavailable" };
    const data = await res.json().catch(() => null);
    return classify(Array.isArray(data?.items) ? data.items : []);
  })();
  inflight.set(key, promise);
  void promise.finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });
  return promise;
}

/** The same approve / leave-out write the memory review uses. */
export async function decideLandingExample(memoryId: string, status: "approved" | "rejected"): Promise<boolean> {
  const res = await fetch(`/api/memory/${encodeURIComponent(memoryId)}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (res.ok) clearSituationKept();
  return res.ok;
}
