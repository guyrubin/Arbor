/**
 * B-RESID-05 — the caption/link fallback, through the real handlers:
 *  · the invite (components/referral/InviteCard → shareInviteLink): the OS
 *    sheet gets the caption and the attributed link; without a sheet the
 *    caption and the link are copied together; a dismissed sheet records
 *    nothing; "Copy" copies the link the card shows;
 *  (The branded-card engine, lib/share shareCard, has had no caller since
 *  B-SHELL-29 made child content text-only, so the invite is the one place a
 *  caption and a link leave the app.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const h = vi.hoisted(() => ({ events: [] as [string, Record<string, unknown>][] }));
vi.mock("./analytics", () => ({ track: (event: string, props: Record<string, unknown> = {}) => { h.events.push([event, props]); } }));

import { attributeShareLink, captionWithLink, shareInviteLink } from "./share";
import { translate } from "./i18n";

const LINK = "https://arborparentingapp.com/?ref=ABC2345";
const CAPTION = "I use Arbor to understand my kid's development. Here's a free month of Plus 🌱";
const clipboard = () => { const writes: string[] = []; return { writes, clipboard: { writeText: vi.fn(async (text: string) => { writes.push(text); }) } as unknown as Clipboard }; };
const names = () => h.events.map(([event, props]) => [event, props.artifact ?? null, props.channel ?? null]);

beforeEach(() => { h.events = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("B-RESID-05 · the invite link carries its ref and the share attribution", () => {
  it("stamps utm_source/medium/campaign and keeps ref; a non-URL passes through", () => {
    const url = new URL(attributeShareLink(LINK, "invite"));
    expect(url.searchParams.get("ref")).toBe("ABC2345");
    expect(url.searchParams.get("utm_source")).toBe("share");
    expect(url.searchParams.get("utm_medium")).toBe("invite");
    expect(url.searchParams.get("utm_campaign")).toBe("organic_share");
    expect(attributeShareLink("not a url", "invite")).toBe("not a url");
    expect(captionWithLink(` ${CAPTION} `, LINK)).toBe(`${CAPTION}\n${LINK}`);
  });
});

describe("B-RESID-05 · shareInviteLink (the invite card's one send path)", () => {
  it("the OS sheet gets the caption and the attributed link; share_completed + invite_sent fire", async () => {
    const share = vi.fn(async () => undefined);
    const { clipboard: cb, writes } = clipboard();
    await expect(shareInviteLink({ link: LINK, caption: CAPTION, surface: "weekly_invite", mode: "share" }, { share, clipboard: cb })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledExactlyOnceWith({ title: "Arbor", text: CAPTION, url: attributeShareLink(LINK, "invite") });
    expect(writes).toEqual([]);
    expect(names()).toEqual([["share_initiated", "invite", null], ["share_completed", "invite", "web_share"], ["invite_sent", null, "web_share"]]);
  });

  it("no OS sheet: the caption and the link are copied together", async () => {
    const { clipboard: cb, writes } = clipboard();
    await expect(shareInviteLink({ link: LINK, caption: CAPTION, surface: "weekly_invite", mode: "share" }, { share: undefined as unknown as Navigator["share"], clipboard: cb })).resolves.toBe("copied");
    expect(writes).toEqual([`${CAPTION}\n${attributeShareLink(LINK, "invite")}`]);
    expect(names()).toEqual([["share_initiated", "invite", null], ["share_completed", "invite", "clipboard"], ["invite_sent", null, "copy"]]);
  });

  it("a sheet that fails (not a dismissal) falls back to the same caption + link", async () => {
    const { clipboard: cb, writes } = clipboard();
    const share = vi.fn(async () => { throw Object.assign(new Error("NotAllowed"), { name: "NotAllowedError" }); });
    await expect(shareInviteLink({ link: LINK, caption: CAPTION, surface: "weekly_invite", mode: "share" }, { share, clipboard: cb })).resolves.toBe("copied");
    expect(writes[0]).toContain(CAPTION);
    expect(writes[0]).toContain("ref=ABC2345");
  });

  it("a dismissed sheet records nothing past the initiation and copies nothing", async () => {
    const { clipboard: cb, writes } = clipboard();
    const share = vi.fn(async () => { throw Object.assign(new Error("Share canceled"), { name: "AbortError" }); });
    await expect(shareInviteLink({ link: LINK, caption: CAPTION, surface: "weekly_invite", mode: "share" }, { share, clipboard: cb })).resolves.toBe("cancelled");
    expect(writes).toEqual([]);
    expect(names()).toEqual([["share_initiated", "invite", null]]);
  });

  it("Copy copies the link the card shows; a refused clipboard is an error with no completion", async () => {
    const { clipboard: cb, writes } = clipboard();
    await expect(shareInviteLink({ link: LINK, caption: CAPTION, surface: "weekly_invite", mode: "copy" }, { share: vi.fn(), clipboard: cb })).resolves.toBe("copied");
    expect(writes).toEqual([LINK]);
    h.events = [];
    const refused = { writeText: async () => { throw new Error("denied"); } } as unknown as Clipboard;
    await expect(shareInviteLink({ link: LINK, caption: CAPTION, surface: "weekly_invite", mode: "share" }, { share: undefined as unknown as Navigator["share"], clipboard: refused })).resolves.toBe("error");
    expect(names()).toEqual([["share_initiated", "invite", null]]);
  });

  it("InviteCard sends through it for both buttons, with the localized caption", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const card = readFileSync(path.join(here, "..", "components", "referral", "InviteCard.tsx"), "utf8");
    expect(card).toContain('await shareInviteLink({ link, caption: t("set.referral.shareText"), surface: "weekly_invite", mode });');
    expect(card).toContain('const doCopy = (link: string) => send(link, "copy");');
    expect(card).toContain('const doShare = (link: string) => send(link, "share");');
    expect(card).not.toMatch(/navigator\.(share|clipboard)/);
  });

  it("the card says what was copied: the link (Copy), or the message and the link (Share with no sheet), EN and HE", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const card = readFileSync(path.join(here, "..", "components", "referral", "InviteCard.tsx"), "utf8");
    expect(card).toContain('if (result === "copied") flashCopied(mode === "share" ? "invite" : "link");');
    expect(card).toContain('{copied === "link" ? t("set.referral.copied") : t("set.referral.copy")}');
    expect(card).toContain('{copied === "invite" ? <><Icon name="check" size={14} /> {t("elev.words.invite.copied")}</>');
    for (const lang of ["en", "he"] as const) {
      const said = translate(lang, "elev.words.invite.copied");
      expect(said, lang).not.toBe("elev.words.invite.copied");
      expect(said).not.toBe(translate(lang, "set.referral.copied"));
      if (lang === "he") expect(said).toMatch(/[\u0590-\u05FF]/);
    }
    expect(translate("en", "elev.words.invite.copied")).toMatch(/message and link/i);
  });
});
