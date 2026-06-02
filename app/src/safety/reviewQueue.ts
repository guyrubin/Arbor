import { promises as fs } from "fs";
import path from "path";
import type { EscalationCategory } from "./escalation.js";

/**
 * K-02 — High-risk human review queue.
 *
 * When an interaction is hard-blocked (explicit escalation), flagged by the
 * softer semantic layer, or rated urgent by the model, it is appended here so
 * a human can review it. This turns `enableHighRiskReviewQueue` from a config
 * flag into an operationally real safety net, and is surfaced in the Safety tab.
 *
 * File-backed for the local tier, mirroring the memory ledger. A Firestore
 * adapter can later implement the same interface.
 */

export type ReviewTrigger = "hard_block" | "elevated_concern" | "model_urgent";
export type ReviewStatus = "open" | "reviewed" | "dismissed";

export type ReviewItem = {
  id: string;
  childId: string;
  createdAt: string;
  trigger: ReviewTrigger;
  category: EscalationCategory | "model_flagged";
  riskLevel?: string;
  excerpt: string;
  status: ReviewStatus;
  reviewedAt?: string;
};

export type ReviewQueueStore = {
  list(childId?: string): Promise<ReviewItem[]>;
  append(item: ReviewItem): Promise<void>;
  setStatus(id: string, status: ReviewStatus): Promise<ReviewItem | null>;
};

const REVIEW_QUEUE_PATH = path.join(process.cwd(), ".data", "review-queue.json");

export class LocalReviewQueueStore implements ReviewQueueStore {
  async list(childId?: string): Promise<ReviewItem[]> {
    try {
      const raw = await fs.readFile(REVIEW_QUEUE_PATH, "utf8");
      const parsed = JSON.parse(raw.replace(/^﻿/, ""));
      const items = Array.isArray(parsed) ? (parsed as ReviewItem[]) : [];
      const scoped = childId ? items.filter((i) => i.childId === childId) : items;
      return scoped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error: any) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async append(item: ReviewItem): Promise<void> {
    const items = await this.list();
    await fs.mkdir(path.dirname(REVIEW_QUEUE_PATH), { recursive: true });
    await fs.writeFile(REVIEW_QUEUE_PATH, JSON.stringify([...items, item], null, 2));
  }

  async setStatus(id: string, status: ReviewStatus): Promise<ReviewItem | null> {
    const items = await this.list();
    let updated: ReviewItem | null = null;
    const next = items.map((item) => {
      if (item.id !== id) return item;
      updated = { ...item, status, reviewedAt: new Date().toISOString() };
      return updated;
    });
    if (!updated) return null;
    await fs.mkdir(path.dirname(REVIEW_QUEUE_PATH), { recursive: true });
    await fs.writeFile(REVIEW_QUEUE_PATH, JSON.stringify(next, null, 2));
    return updated;
  }
}

/** Build a review item with a short, privacy-conscious excerpt. */
export const buildReviewItem = (input: {
  childId: string;
  trigger: ReviewTrigger;
  category: ReviewItem["category"];
  riskLevel?: string;
  message: string;
}): ReviewItem => ({
  id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  childId: input.childId,
  createdAt: new Date().toISOString(),
  trigger: input.trigger,
  category: input.category,
  riskLevel: input.riskLevel,
  excerpt: input.message.trim().slice(0, 280),
  status: "open"
});
