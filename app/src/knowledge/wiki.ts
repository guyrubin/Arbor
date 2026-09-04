import { promises as fs } from "fs";
import path from "path";

export type KnowledgeCard = {
  id: string;
  type: string;
  domains: string[];
  age_bands: string[];
  six_frame?: string;
  risk_level?: string;
  allowed_uses: string[];
  title: string;
  body: string;
  review_status?: string;     // draft | reviewed
  source?: string;            // public provenance (CDC / AAP / Harvard CDC / scholar)
  evidence_strength?: string; // low | medium | high
};

export type KnowledgeLoadResult = {
  cards: KnowledgeCard[];
  loadedFrom: string | null;
  byType: Record<string, number>;
};

export const resolveKnowledgeRoots = () => {
  const candidates = [
    process.env.ARBOR_KNOWLEDGE_PATH,
    process.env.KNOWLEDGE_PATH,
    path.join(process.cwd(), "knowledge"),
    path.join(process.cwd(), "..", "knowledge")
  ].filter(Boolean) as string[];
  return candidates;
};

const parseFrontMatter = (text: string) => {
  // AI-03: the delimiters were matched against `\n` only, so a CRLF checkout of
  // knowledge/ (git's default on Windows) matched NOTHING — every card lost its
  // `id`, `loadKnowledgeCardsWithMetadata` dropped all of them, and the whole
  // coach knowledge base silently loaded ZERO cards. Normalize first; on an LF
  // checkout this is a no-op, so the parsed result is byte-identical there.
  text = text.replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };
  const meta: Record<string, any> = {};
  for (const line of match[1].split("\n")) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim();
    const value = rest.join(":").trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
    } else {
      meta[key] = value;
    }
  }
  return { meta, body: match[2] };
};

const walkMarkdown = async (dir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkMarkdown(fullPath);
      if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
      return [];
    }));
    return nested.flat();
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

export const loadKnowledgeCardsWithMetadata = async (): Promise<KnowledgeLoadResult> => {
  const roots = resolveKnowledgeRoots();
  let files: string[] = [];
  let loadedFrom: string | null = null;
  for (const root of roots) {
    files = await walkMarkdown(root);
    if (files.length > 0) {
      loadedFrom = root;
      break;
    }
  }
  const cards: KnowledgeCard[] = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const { meta, body } = parseFrontMatter(text);
    if (!meta.id) continue;
    cards.push({
      id: meta.id,
      type: meta.type || "note",
      domains: meta.domains || [],
      age_bands: meta.age_bands || [],
      six_frame: meta.six_frame,
      risk_level: meta.risk_level,
      allowed_uses: meta.allowed_uses || [],
      title: body.match(/^#\s+(.+)$/m)?.[1] || meta.id,
      body: body.trim(),
      review_status: meta.review_status,
      source: meta.source,
      evidence_strength: meta.evidence_strength
    });
  }

  const byType = cards.reduce<Record<string, number>>((counts, card) => {
    counts[card.type] = (counts[card.type] || 0) + 1;
    return counts;
  }, {});

  return { cards, loadedFrom, byType };
};

export const loadKnowledgeCards = async () => (await loadKnowledgeCardsWithMetadata()).cards;

export const filterKnowledgeCards = (cards: KnowledgeCard[], filters: {
  ageBand?: string;
  domains?: string[];
  allowedUse?: string;
  riskLevel?: string;
  /** Card `type` values to leave out entirely (AI-03: see COACH_EXCLUDED_CARD_TYPES). */
  excludeTypes?: readonly string[];
  limit?: number;
}) => {
  const limit = filters.limit ?? 5;
  // Every filter here is HARD, including ageBand. AI-03 made that consequential:
  // ageBand and domains used to be undefined at every call site, so the two
  // filters were skipped; they are now derived from the child and the question,
  // and ANDing them against a 13-card library has real empty intersections
  // (a 0-12m child asked about focus, a 9-12y child asked about sensory input).
  //
  // Returning zero cards there is the CORRECT answer, and the fallback that
  // suggests itself — widen when the intersection is empty — was considered and
  // rejected: it would hand a parent of a 3-month-old an intervention written
  // for a 3-to-5-year-old, which is worse than answering from the lens cards
  // alone. Retrieval returning nothing is a graceful degradation here because
  // /chat always adds scholarCards, so the model is never left with no grounding
  // at all. See retrievalKeys.ts, which states the same contract.
  const scoped = cards.filter((card) => {
    if (filters.excludeTypes?.includes(card.type)) return false;
    if (filters.allowedUse && !card.allowed_uses.includes(filters.allowedUse)) return false;
    if (filters.ageBand && !card.age_bands.includes(filters.ageBand)) return false;
    if (filters.domains?.length && !filters.domains.some((domain) => card.domains.includes(domain))) return false;
    if (filters.riskLevel && card.risk_level !== filters.riskLevel) return false;
    return true;
  });
  const scored = scoped.map((card) => {
    let score = 0;
    if (filters.allowedUse && card.allowed_uses.includes(filters.allowedUse)) score += 3;
    if (filters.ageBand && card.age_bands.includes(filters.ageBand)) score += 2;
    if (filters.domains?.some((domain) => card.domains.includes(domain))) score += 2;
    if (filters.riskLevel && card.risk_level === filters.riskLevel) score += 1;
    if (card.review_status === "reviewed") score += 2; // KB-1: reviewed evidence leads
    if (card.evidence_strength === "high") score += 1;
    return { card, score };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.card);
};

export const retrieveKnowledgeCards = async (filters: Parameters<typeof filterKnowledgeCards>[1]) =>
  filterKnowledgeCards(await loadKnowledgeCards(), filters);

/** Load specific cards by id, preserving order (v4 SCH-3 lens-aware retrieval). */
export const loadCardsByIds = async (ids: string[]): Promise<KnowledgeCard[]> => {
  if (!ids.length) return [];
  const all = await loadKnowledgeCards();
  return ids
    .map((id) => all.find((card) => card.id === id))
    .filter((card): card is KnowledgeCard => Boolean(card));
};

export const renderKnowledgeContext = (cards: KnowledgeCard[]) =>
  cards
    .map((card) => {
      const status = card.review_status && card.review_status !== "reviewed" ? ` [${card.review_status}]` : "";
      const prov = card.source
        ? `\nSource: ${card.source}${card.evidence_strength ? ` (evidence: ${card.evidence_strength})` : ""}`
        : "";
      return `- ${card.id} (${card.type})${status}: ${card.title}\n${card.body.slice(0, 900)}${prov}`;
    })
    .join("\n\n");
