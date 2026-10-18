import { useEffect, useState } from "react";
import { goToRoute } from "../hooks/useHashQuery";
import { auth, firebaseEnabled } from "./firebase";
import { requestCompanionClose, requestCompanionConversation } from "./companionConversation";
import type { NoticeTarget } from "./noticeNavigation";

/** Only identity travels. Source words and parent approval never live here. */
export interface NoticeTalkRequest extends NoticeTarget { ownerId: string; requestId: number }
export const NOTICE_TALK_EVENT = "arbor:notice-talk";
let request: NoticeTalkRequest | null = null;
let sequence = 0;
const usable = (id: string) => !!id && id.length <= 200 && !/[\/\u0000-\u001f]/.test(id);
export const noticeOwnerId = (): string | null => firebaseEnabled ? auth?.currentUser?.uid ?? null : "local-sandbox";
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTICE_TALK_EVENT)); };

export function openNoticeTalk(childId: string, milestoneId: string): void {
  const ownerId = noticeOwnerId();
  if (!ownerId || !usable(childId) || !usable(milestoneId)) return;
  request = { childId, milestoneId, ownerId, requestId: ++sequence };
  notify();
  requestCompanionConversation({ source: "notice-object" });
}

export function openNoticeCare(childId: string, milestoneId: string): void {
  if (!usable(childId) || !usable(milestoneId)) return;
  requestCompanionClose();
  goToRoute("consult", { notice: milestoneId, child: childId });
}

export const readNoticeTalk = (): NoticeTalkRequest | null => request;
export function clearNoticeTalk(expected: NoticeTalkRequest): void {
  if (request !== expected) return;
  request = null;
  notify();
}

export function useNoticeTalkRequest(): NoticeTalkRequest | null {
  const [current, setCurrent] = useState(readNoticeTalk);
  useEffect(() => {
    const update = () => setCurrent(readNoticeTalk());
    update();
    if (typeof window === "undefined") return;
    window.addEventListener(NOTICE_TALK_EVENT, update);
    return () => window.removeEventListener(NOTICE_TALK_EVENT, update);
  }, []);
  return current;
}
