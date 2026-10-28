/**
 * B-PROV-12 — the voice provider notice is bound to the RUNTIME route.
 *
 * Inventory/copy receipt: every approved notice the server can name
 * (ai/voiceProviderNotice.ts) has reviewed EN and HE copy here, and no copy
 * exists for a route the server cannot select. Then the binding itself: each
 * route shows its own line (global, EU, device-only), an unknown id is never
 * shown as approved, and an acknowledgement covers exactly one notice id.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "./i18n";
import {
  acknowledgeVoiceNotice, DEVICE_VOICE_NOTICE_ID, liveNoticeIdFrom, runtimeVoiceNoticeId, VOICE_NOTICE_ACK_KEY, VOICE_NOTICE_COPY,
  voiceNoticeAcknowledged, voiceNoticeLine, voiceNoticeResidencyKey, voiceNoticeShortLine, voiceNoticeTap,
} from "./voiceProviderNotice";
import { VOICE_NOTICE_INVENTORY, liveVoiceNoticeId, voiceNoticeIdFor } from "../ai/voiceProviderNotice";
import { LIVE_GLOBAL_PROVIDER, LIVE_VERTEX_EU_PROVIDER, decideLive } from "../ai/liveResidency";
import { createTestConfig } from "../testConfig";
import { api } from "./api";

const GLOBAL = "google-global-realtime-v1";
const EU = "google-eu-realtime-v1";
const line = (lang: "en" | "he", id: string) => voiceNoticeLine((k, p) => translate(lang, k, p), id);
const memory = () => {
  const map = new Map<string, string>();
  return { map, storage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } };
};

afterEach(() => vi.unstubAllGlobals());

describe("inventory/copy receipt — the server's processor inventory and the approved EN/HE copy agree", () => {
  const serverIds = Object.values(VOICE_NOTICE_INVENTORY).flatMap((byRegion) => Object.values(byRegion));

  it("every route the provider policy can select has exactly one approved notice", () => {
    expect(voiceNoticeIdFor({ provider: LIVE_GLOBAL_PROVIDER, region: "global" })).toBe(GLOBAL);
    expect(voiceNoticeIdFor({ provider: LIVE_VERTEX_EU_PROVIDER, region: "eu" })).toBe(EU);
    // A region the inventory has not approved for that provider, or a new provider: no notice.
    expect(voiceNoticeIdFor({ provider: LIVE_GLOBAL_PROVIDER, region: "eu" })).toBeNull();
    expect(voiceNoticeIdFor({ provider: "openai-realtime", region: "eu" })).toBeNull();
    expect(new Set(serverIds).size).toBe(serverIds.length);
  });

  it("every server notice has client copy, and no Live copy exists for a route the server cannot select", () => {
    for (const id of serverIds) expect(VOICE_NOTICE_COPY[id], id).toBeDefined();
    const liveCopy = Object.keys(VOICE_NOTICE_COPY).filter((id) => id !== DEVICE_VOICE_NOTICE_ID);
    expect(liveCopy.sort()).toEqual([...serverIds].sort());
  });

  it("every approved line is complete in EN and HE, the Hebrew is not the English, and HE never writes the Latin brand", () => {
    for (const id of Object.keys(VOICE_NOTICE_COPY)) {
      const en = line("en", id);
      const he = line("he", id);
      for (const text of [en, he]) {
        expect(text, id).not.toMatch(/\{[a-z]+\}/);
        expect(text, id).not.toMatch(/^elev\./);
      }
      expect(he, id).not.toBe(en);
      expect(he, id).not.toMatch(/\bArbor\b/);
      expect(en, id).toMatch(/^No recording is kept\./);
    }
  });
});

describe("the notice names the route the tap actually takes", () => {
  it("global Live: Google's model hears the words directly, on the global endpoint", () => {
    expect(line("en", GLOBAL)).toContain("Google's model hears them directly");
    expect(line("en", GLOBAL)).toContain("global endpoint, not the EU region");
    expect(line("he", GLOBAL)).toContain("הגלובלית");
  });

  it("EU Live: the same processor, the EU region — never the global line", () => {
    expect(line("en", EU)).toContain("Google's model hears them directly");
    expect(line("en", EU)).toContain("Live runs in Google's EU region.");
    expect(line("en", EU)).not.toContain("global endpoint");
    expect(line("he", EU)).toContain("האיחוד האירופי");
    expect(line("he", EU)).not.toContain("הגלובלית");
  });

  it("no Live route: the device speech line names no model provider", () => {
    expect(line("en", DEVICE_VOICE_NOTICE_ID)).toBe("No recording is kept. This device's speech service turns your words into text, and only the text is kept.");
    expect(line("en", DEVICE_VOICE_NOTICE_ID)).not.toContain("Google");
    expect(line("en", "some-unreviewed-id")).toBe(line("en", DEVICE_VOICE_NOTICE_ID));
  });

  it("the availability answer is read strictly: off, unknown or device ids never count as an approved Live notice", () => {
    expect(liveNoticeIdFrom({ available: true, notice: { id: GLOBAL } })).toBe(GLOBAL);
    expect(liveNoticeIdFrom({ available: true, notice: { id: EU } })).toBe(EU);
    expect(liveNoticeIdFrom({ available: false, notice: { id: GLOBAL } })).toBeNull();
    expect(liveNoticeIdFrom({ available: true, notice: { id: "openai-eu-realtime-v1" } })).toBeNull();
    expect(liveNoticeIdFrom({ available: true, notice: { id: DEVICE_VOICE_NOTICE_ID } })).toBeNull();
    expect(liveNoticeIdFrom({ available: true })).toBeNull();
    expect(runtimeVoiceNoticeId(null)).toBe(DEVICE_VOICE_NOTICE_ID);
    expect(voiceNoticeResidencyKey(EU)).toBe("elev.coachcontract.uses.liveResidencyEu");
  });

  it("the server names the notice from the decision it would mint on (global by default; EU when the EU route is on)", () => {
    expect(liveVoiceNoticeId(decideLive(createTestConfig({ liveEnabled: true })))).toBe(GLOBAL);
    expect(liveVoiceNoticeId(decideLive(createTestConfig({ liveEnabled: true, liveVertexEu: true, gcpProjectId: "p", liveVertexLocation: "europe-west4" })))).toBe(EU);
    expect(liveVoiceNoticeId(decideLive(createTestConfig({ liveEnabled: false })))).toBeNull();
  });
});

describe("acknowledgement — one tap, remembered per device and per notice id", () => {
  it("an acknowledgement covers exactly its notice: a changed provider or region asks again", () => {
    const { map, storage } = memory();
    expect(voiceNoticeAcknowledged(GLOBAL, storage)).toBe(false);
    acknowledgeVoiceNotice(GLOBAL, storage);
    acknowledgeVoiceNotice(GLOBAL, storage);
    // A Live notice names the device speech fallback too, so it covers that one.
    expect(JSON.parse(map.get(VOICE_NOTICE_ACK_KEY)!)).toEqual([GLOBAL, DEVICE_VOICE_NOTICE_ID]);
    expect(voiceNoticeAcknowledged(GLOBAL, storage)).toBe(true);
    expect(voiceNoticeAcknowledged(DEVICE_VOICE_NOTICE_ID, storage)).toBe(true);
    expect(voiceNoticeAcknowledged(EU, storage)).toBe(false);
    // The device notice alone never covers a Live route.
    const other = memory();
    acknowledgeVoiceNotice(DEVICE_VOICE_NOTICE_ID, other.storage);
    expect(voiceNoticeAcknowledged(GLOBAL, other.storage)).toBe(false);
  });

  it("a storage failure or a corrupt record reads as not acknowledged (the notice shows again; never hidden)", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(voiceNoticeAcknowledged(GLOBAL, broken)).toBe(false);
    expect(() => acknowledgeVoiceNotice(GLOBAL, broken)).not.toThrow();
    const { map, storage } = memory();
    map.set(VOICE_NOTICE_ACK_KEY, "{not json");
    expect(voiceNoticeAcknowledged(GLOBAL, storage)).toBe(false);
    map.set(VOICE_NOTICE_ACK_KEY, JSON.stringify({ [GLOBAL]: true }));
    expect(voiceNoticeAcknowledged(GLOBAL, storage)).toBe(false);
    expect(voiceNoticeAcknowledged(GLOBAL, null)).toBe(false);
  });
});

describe("the mint refusal reaches the caller with the route's notice id", () => {
  it("a 428 voice_notice_required becomes VoiceNoticeRequiredError carrying the notice id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 428, headers: { get: () => null },
      json: async () => ({ available: false, code: "voice_notice_required", notice: { id: EU } }),
    })));
    const err = await api.liveToken({ noticeAck: GLOBAL }).catch((e) => e);
    expect(err.name).toBe("VoiceNoticeRequiredError");
    expect(err.status).toBe(428);
    expect(err.noticeId).toBe(EU);
  });
});

describe("the one-line form under the composer (P2-6: one calm line each)", () => {
  const short = (lang: "en" | "he", id: string) => voiceNoticeShortLine((k, p) => translate(lang, k, p), id);
  const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

  it("every approved notice has a short line in EN and HE that names the same route, at most 26 words, plus a 7-word start line", () => {
    for (const id of Object.keys(VOICE_NOTICE_COPY)) {
      for (const lang of ["en", "he"] as const) {
        const text = short(lang, id);
        expect(text, `${lang} ${id}`).not.toMatch(/^elev\./);
        expect(words(text), `${lang} ${id}`).toBeLessThanOrEqual(26);
      }
      expect(short("he", id)).not.toBe(short("en", id));
      expect(short("he", id)).not.toMatch(/\bArbor\b/);
    }
    expect(short("en", GLOBAL)).toContain("global endpoint (not the EU)");
    expect(short("en", EU)).toContain("EU region");
    expect(short("en", EU)).not.toContain("global");
    // A Live line names its device fallback, so its acknowledgement covers it.
    expect(short("en", GLOBAL)).toContain("without Live, your device writes your words as text");
    expect(short("en", DEVICE_VOICE_NOTICE_ID)).not.toContain("Google");
    const tapAgain = translate("en", "elev.wave2Daily.capture.voice.tapAgain");
    expect(tapAgain).toBe("Tap the voice button again to start.");
    expect(translate("he", "elev.wave2Daily.capture.voice.tapAgain")).not.toBe(tapAgain);
    expect(words(short("en", GLOBAL)) + words(tapAgain)).toBeLessThan(63);
  });
});

describe("start, cancel, decline and retry receipts (one tap on the voice button)", () => {
  it("start: the first tap shows the notice and starts nothing; the next tap while it shows acknowledges and starts", () => {
    const { storage } = memory();
    expect(voiceNoticeTap(GLOBAL, null, voiceNoticeAcknowledged(GLOBAL, storage))).toBe("show");
    expect(voiceNoticeTap(GLOBAL, GLOBAL, voiceNoticeAcknowledged(GLOBAL, storage))).toBe("acknowledge_and_start");
    acknowledgeVoiceNotice(GLOBAL, storage);
    expect(voiceNoticeTap(GLOBAL, null, voiceNoticeAcknowledged(GLOBAL, storage))).toBe("start");
  });

  it("cancel / decline: leaving or typing instead clears the shown notice, so the next tap shows it again and nothing is acknowledged", () => {
    const { storage } = memory();
    let pending: string | null = null;
    const tap = () => voiceNoticeTap(GLOBAL, pending, voiceNoticeAcknowledged(GLOBAL, storage));
    expect(tap()).toBe("show");
    pending = GLOBAL;
    pending = null; // the parent closed the panel / sent a typed message (CoachTab stopVoice / handleChatSend)
    expect(tap()).toBe("show");
    expect(voiceNoticeAcknowledged(GLOBAL, storage)).toBe(false);
  });

  it("retry: after acknowledgement a retry starts at once; a retry on a changed route shows the new notice first", () => {
    const { storage } = memory();
    acknowledgeVoiceNotice(GLOBAL, storage);
    expect(voiceNoticeTap(GLOBAL, null, voiceNoticeAcknowledged(GLOBAL, storage))).toBe("start");
    expect(voiceNoticeTap(EU, null, voiceNoticeAcknowledged(EU, storage))).toBe("show");
    // A notice showing for the OLD route is not an acknowledgement of the new one.
    expect(voiceNoticeTap(EU, GLOBAL, voiceNoticeAcknowledged(EU, storage))).toBe("show");
  });
});
