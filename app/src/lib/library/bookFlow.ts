/**
 * lib/library/bookFlow — B-BOOK-02/04: the reading order of a book and the
 * reader's state machine, pure (the React reader and its tests share it).
 *
 * Path = the linear pages up to and including the decision page, then the
 * chosen branch's pages, then the linear pages from the rejoin page on. Before
 * a choice the path stops at the decision page: nothing turns past it but a
 * committed choice. A repair page holds the page until the child has tapped
 * EVERY item (each tap answers; nothing can fail — BR3), in order when the
 * repair says so. There is no "Another way?" jump (BR3): Next on the last page
 * opens the END screen ("The End", the frame line, Read again / close, and the
 * grown-up's panel); Read again starts at the cover. A choice lives only in this in-memory state — it is never stored and
 * never describes the child (lane A rule 8).
 */
import type { Book, Choice, Page } from "./types";

/** The pages a child reads on the path of `choiceId` (null = no choice yet). */
export function readPath(book: Book, choiceId: string | null): Page[] {
  const at = book.pages.findIndex((p) => p.id === book.decision.pageId);
  const before = at >= 0 ? book.pages.slice(0, at + 1) : book.pages.slice();
  const choice = choiceId ? book.decision.choices.find((c) => c.id === choiceId) : undefined;
  if (!choice) return before;
  const from = book.pages.findIndex((p) => p.id === book.rejoinPageId);
  const after = from >= 0 ? book.pages.slice(from) : [];
  return [...before, ...choice.branch, ...after];
}

export function findChoice(book: Book, choiceId: string | null): Choice | undefined {
  return choiceId ? book.decision.choices.find((c) => c.id === choiceId) : undefined;
}

export interface BookFlowState {
  /** "cover" or the id of the page on screen. */
  at: string;
  /** The committed choice of this read (in memory only). */
  choiceId: string | null;
  /** The card currently selected on the decision page (before commit). */
  selected: string | null;
  /** Repair items done on this path, as `<pageId>:<itemId>`. */
  repaired: readonly string[];
  /** The direction of the last move: 1 = forward, -1 = back, 0 = none. */
  dir: 1 | -1 | 0;
}

export type BookFlowAction =
  | { type: "open" }
  | { type: "next" }
  | { type: "back" }
  | { type: "choose"; choiceId: string }
  | { type: "go" }
  | { type: "repair"; itemId: string }
  | { type: "toCover" };

export const COVER = "cover";
export const END = "end";

export function initialBookFlow(): BookFlowState {
  return { at: COVER, choiceId: null, selected: null, repaired: [], dir: 0 };
}

export function currentPage(book: Book, s: BookFlowState): Page | null {
  if (s.at === COVER || s.at === END) return null;
  return readPath(book, s.choiceId).find((p) => p.id === s.at) ?? null;
}

export function isDecision(book: Book, s: BookFlowState): boolean {
  return s.at === book.decision.pageId;
}

export function isEnding(book: Book, s: BookFlowState): boolean {
  if (s.choiceId == null) return false;
  const path = readPath(book, s.choiceId);
  return path.length > 0 && path[path.length - 1].id === s.at;
}

export const repairKey = (pageId: string, itemId: string) => `${pageId}:${itemId}`;

/** The next item the child may tap (ordered repairs: the first not done;
 *  unordered: null = any). */
export function nextRepairItem(page: Page | null, s: BookFlowState): string | null {
  if (!page?.repair?.ordered) return null;
  const done = repairedItems(page, s);
  return page.repair.items.find((it) => !done.has(it.id))?.id ?? null;
}

/** The repair items of the current page already done. */
export function repairedItems(page: Page | null, s: BookFlowState): Set<string> {
  const done = new Set<string>();
  for (const item of page?.repair?.items ?? []) if (s.repaired.includes(repairKey(page!.id, item.id))) done.add(item.id);
  return done;
}

/** True when the page has a repair and every item is done. */
export function repairDone(page: Page | null, s: BookFlowState): boolean {
  return !!page?.repair && repairedItems(page, s).size === page.repair.items.length;
}

/** True while the page's repair still waits for the child. */
export function awaitingRepair(book: Book, s: BookFlowState): boolean {
  const page = currentPage(book, s);
  return !!page?.repair && !repairDone(page, s);
}

/** Can the forward page-turn control move on from here? */
export function canTurnForward(book: Book, s: BookFlowState): boolean {
  if (s.at === COVER) return true;
  if (s.at === END) return false;
  if (isEnding(book, s)) return true;
  if (isDecision(book, s) || awaitingRepair(book, s)) return false;
  const path = readPath(book, s.choiceId);
  const i = path.findIndex((p) => p.id === s.at);
  return i >= 0 && i < path.length - 1;
}

export function bookFlowReducer(book: Book, s: BookFlowState, a: BookFlowAction): BookFlowState {
  const path = readPath(book, s.choiceId);
  const i = path.findIndex((p) => p.id === s.at);
  switch (a.type) {
    case "open":
      return s.at === COVER && path.length ? { ...s, at: path[0].id, dir: 1 } : s;
    case "next":
      if (s.at === COVER) return bookFlowReducer(book, s, { type: "open" });
      if (isEnding(book, s)) return { ...s, at: END, dir: 1 };
      return canTurnForward(book, s) ? { ...s, at: path[i + 1].id, dir: 1 } : s;
    case "back":
      if (s.at === COVER) return s;
      if (s.at === END) return path.length ? { ...s, at: path[path.length - 1].id, dir: -1 } : s;
      if (i <= 0) return { ...s, at: COVER, dir: -1 };
      // Back onto the decision page keeps the committed choice selected, so a
      // second tap (or Go) re-enters the same branch; another card moves it.
      return { ...s, at: path[i - 1].id, selected: path[i - 1].id === book.decision.pageId ? s.choiceId : s.selected, dir: -1 };
    case "choose": {
      if (!isDecision(book, s) || !findChoice(book, a.choiceId)) return s;
      // Tapping the selected card again commits it (lane C §4.1).
      if (s.selected === a.choiceId) return bookFlowReducer(book, s, { type: "go" });
      return { ...s, selected: a.choiceId };
    }
    case "go": {
      const choice = isDecision(book, s) ? findChoice(book, s.selected) : undefined;
      if (!choice || !choice.branch.length) return s;
      // A newly entered branch starts with its repairs undone.
      const repaired = s.repaired.filter((k) => !choice.branch.some((p) => k.startsWith(`${p.id}:`)));
      return { ...s, choiceId: choice.id, at: choice.branch[0].id, repaired, dir: 1 };
    }
    case "repair": {
      const page = currentPage(book, s);
      if (!page?.repair?.items.some((it) => it.id === a.itemId)) return s;
      const next = nextRepairItem(page, s);
      if (next && next !== a.itemId) return s;
      const key = repairKey(page.id, a.itemId);
      return s.repaired.includes(key) ? s : { ...s, repaired: [...s.repaired, key], dir: 0 };
    }
    case "toCover":
      return initialBookFlow();
    default:
      return s;
  }
}
