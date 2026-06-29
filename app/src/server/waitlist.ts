/**
 * B2: email/waitlist capture — no-account lead capture for interested-but-not-ready visitors.
 *
 * Privacy-first design:
 * - Stores ONLY: email, consentAt (ISO), source, market. NO child data, NO name.
 * - Consent is mandatory (explicit checkbox on the landing page, not pre-checked).
 * - Deduplication is idempotent: a second submission for the same email is a 200 ok, not an error.
 * - Dev/local: in-memory Map (reset on restart, no file I/O).
 * - Prod: Firestore `waitlist` collection keyed by normalised email.
 */

import { randomUUID } from "crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";

export type WaitlistEntry = {
  id: string;
  email: string;
  consentAt: string;   // ISO-8601 — when explicit consent was recorded
  source: string;      // e.g. "landing-en", "landing-he"
  market: string;      // e.g. "il", "nl", "de", "fr", "en"
};

export interface WaitlistStore {
  /** Add or skip (idempotent). Returns the entry regardless. */
  add(entry: WaitlistEntry): Promise<WaitlistEntry>;
  /** Whether this email is already on the list. */
  has(email: string): Promise<boolean>;
}

export interface WaitlistNotifier {
  /** Notify the product/founder inbox that a new parent requested access. */
  notify(entry: WaitlistEntry): Promise<void>;
}

// ── In-memory (dev) ──────────────────────────────────────────────────────────

export class LocalWaitlistStore implements WaitlistStore {
  private entries = new Map<string, WaitlistEntry>(); // key = normalised email

  async add(entry: WaitlistEntry): Promise<WaitlistEntry> {
    const key = entry.email.toLowerCase();
    if (!this.entries.has(key)) this.entries.set(key, entry);
    return this.entries.get(key)!;
  }

  async has(email: string): Promise<boolean> {
    return this.entries.has(email.toLowerCase());
  }
}

// ── Firestore (prod) ─────────────────────────────────────────────────────────

export class FirestoreWaitlistStore implements WaitlistStore {
  private readonly db;

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }

  private col() { return this.db.collection("waitlist"); }

  /** Keyed on the normalised email so duplicate submissions hit the same doc. */
  private docId(email: string) {
    return Buffer.from(email.toLowerCase()).toString("base64url");
  }

  async add(entry: WaitlistEntry): Promise<WaitlistEntry> {
    const ref = this.col().doc(this.docId(entry.email));
    // set with merge:false only when the doc doesn't exist (idempotent insert).
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) tx.set(ref, entry);
    });
    const snap = await ref.get();
    return (snap.data() as WaitlistEntry) ?? entry;
  }

  async has(email: string): Promise<boolean> {
    const snap = await this.col().doc(this.docId(email)).get();
    return snap.exists;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

export const createWaitlistStore = (config: ArborConfig): WaitlistStore =>
  config.memoryAdapter === "firestore"
    ? new FirestoreWaitlistStore(config)
    : new LocalWaitlistStore();

// ── Email notification (prod opt-in) ──────────────────────────────────────────

export const createResendWaitlistNotifier = (input: {
  resendApiKey?: string;
  notifyTo?: string;
  notifyFrom?: string;
}): WaitlistNotifier | null => {
  const resendApiKey = input.resendApiKey?.trim();
  const notifyTo = input.notifyTo?.trim();
  const notifyFrom = input.notifyFrom?.trim();
  if (!resendApiKey || !notifyTo || !notifyFrom) return null;

  return {
    async notify(entry: WaitlistEntry) {
      const text = [
        "New Arbor access request",
        "",
        `Email: ${entry.email}`,
        `Source: ${entry.source || "unknown"}`,
        `Market: ${entry.market || "unknown"}`,
        `Consent recorded: ${entry.consentAt}`,
        `Waitlist id: ${entry.id}`,
      ].join("\n");

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: notifyFrom,
          to: [notifyTo],
          subject: `New Arbor access request — ${entry.email}`,
          text,
        }),
      });

      if (!response.ok) {
        const details = (await response.text()).slice(0, 500);
        throw new Error(`Waitlist notification email failed: ${response.status} ${details}`.trim());
      }
    },
  };
};

export const createWaitlistNotifierFromEnv = (): WaitlistNotifier | null =>
  createResendWaitlistNotifier({
    resendApiKey: process.env.RESEND_API_KEY,
    notifyTo: process.env.WAITLIST_NOTIFY_EMAIL || process.env.ARBOR_WAITLIST_NOTIFY_EMAIL,
    notifyFrom: process.env.WAITLIST_NOTIFY_FROM || process.env.ARBOR_WAITLIST_NOTIFY_FROM,
  });

// ── Builder ──────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (v: unknown): v is string =>
  typeof v === "string" && EMAIL_RE.test(v.trim()) && v.trim().length <= 320;

export const buildWaitlistEntry = (input: {
  email: string;
  source?: unknown;
  market?: unknown;
}): WaitlistEntry => ({
  id: randomUUID(),
  email: input.email.trim().toLowerCase(),
  consentAt: new Date().toISOString(),
  source: String(input.source ?? "landing").slice(0, 80),
  market: String(input.market ?? "").slice(0, 10),
});
