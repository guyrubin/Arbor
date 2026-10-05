/**
 * lib/library/bookFlow — B-BOOK-02/04: the reading order of a book and the
 * reader's state machine, pure (the React reader and its tests share it).
 *
 * Path = the linear pages up to and including the decision page, then the
 * chosen branch's pages, then the linear pages from the rejoin page on. Before
 * a choice is made the path stops at the decision page: nothing turns past it
 * but a committed choice. A choice lives only in this in-memory state — it is
 * never stored and never describes the child (lane A rule 8).
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
  /** Pages whose action tap has been done on this path. */
  tapped: readonly string[];
  /** The direction of the last move: 1 = forward, -1 = back, 0 = none. */
  dir: 1 | -1 | 0;
}

export type BookFlowAction =
  | { type: "open" }
  | { type: "next" }
  | { type: "back" }
  | { type: "choose"; choiceId: string }
  | { type: "go" }
  | { type: "tap" }
  | { type: "anotherWay" }
  | { type: "toCover" };

export const COVER = "cover";

export function initialBookFlow(): BookFlowState {
  return { at: COVER, choiceId: null, selected: null, tapped: [], dir: 0 };
}

export function currentPage(book: Book, s: BookFlowState): Page | null {
  if (s.at === COVER) return null;
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

/** True while the page's action tap is still waiting for the child. */
export function awaitingTap(book: Book, s: BookFlowState): boolean {
  const page = currentPage(book, s);
  return !!page?.actionTap && !s.tapped.includes(page.id);
}

/** Can the forward page-turn control move on from here? */
export function canTurnForward(book: Book, s: BookFlowState): boolean {
  if (s.at === COVER) return true;
  if (isDecision(book, s) || isEnding(book, s) || awaitingTap(book, s)) return false;
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
      return canTurnForward(book, s) ? { ...s, at: path[i + 1].id, dir: 1 } : s;
    case "back":
      if (s.at === COVER) return s;
      if (i <= 0) return { ...s, at: COVER, dir: -1 };
      // Back onto the decision page keeps the committed choice selected, so a
      // second tap (or Go) re-enters the same branch; a new card moves it.
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
      const tapped = s.tapped.filter((id) => !choice.branch.some((p) => p.id === id));
      return { ...s, choiceId: choice.id, at: choice.branch[0].id, tapped, dir: 1 };
    }
    case "tap": {
      const page = currentPage(book, s);
      if (!page?.actionTap || s.tapped.includes(page.id)) return s;
      return { ...s, tapped: [...s.tapped, page.id], dir: 0 };
    }
    case "anotherWay":
      // Back to the decision page with nothing selected and no repair done.
      return { at: book.decision.pageId, choiceId: null, selected: null, tapped: [], dir: -1 };
    case "toCover":
      return initialBookFlow();
    default:
      return s;
  }
}
