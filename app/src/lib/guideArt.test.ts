import { describe, expect, it } from "vitest";
import { ROUTINES } from "./routines";
import {
  GUIDE_ART,
  GUIDE_ART_SHIPPED,
  GUIDE_TOPICS,
  guideArtFiles,
  guideArtFor,
  guideTopicFor,
  type GuideTopic,
} from "./guideArt";

/** VIS-05: the guide-art lookup. The files themselves are held by guideArt.guard.test.ts. */

describe("guideArtFor", () => {
  const onlyMornings = new Set<GuideTopic>(["mornings"]);

  it("gives the 960 picture, the 480 one in srcSet, the 16:9 box and the alt in the reader's language", () => {
    expect(guideArtFor("mornings", "en", onlyMornings)).toEqual({
      src: "/visuals/guides/mornings-960.webp",
      srcSet: "/visuals/guides/mornings-480.webp 480w, /visuals/guides/mornings-960.webp 960w",
      width: 960,
      height: 540,
      alt: GUIDE_ART.mornings.alt.en,
    });
    expect(guideArtFor("mornings", "he", onlyMornings)?.alt).toBe(GUIDE_ART.mornings.alt.he);
  });

  it("is undefined for a topic with no shipped art, or no topic, so the card keeps its own face", () => {
    expect(guideArtFor("bedtime", "en", onlyMornings)).toBeUndefined();
    expect(guideArtFor("mornings", "he", new Set<GuideTopic>())).toBeUndefined();
    expect(guideArtFor(undefined, "en", onlyMornings)).toBeUndefined();
    expect(guideArtFor(null, "he", onlyMornings)).toBeUndefined();
  });

  it("by default offers exactly the shipped topics", () => {
    for (const topic of GUIDE_TOPICS) {
      expect(guideArtFor(topic, "en") !== undefined, topic).toBe(GUIDE_ART_SHIPPED.has(topic));
    }
  });

  it("names both files of a topic under /visuals/guides, smallest first", () => {
    expect(guideArtFiles("calm-corner")).toEqual([
      "/visuals/guides/calm-corner-480.webp",
      "/visuals/guides/calm-corner-960.webp",
    ]);
  });
});

describe("guideTopicFor", () => {
  it("maps each pictured routine to its topic, and every such routine exists", () => {
    const routineIds = new Set(ROUTINES.map((r) => r.id));
    const pictured = GUIDE_TOPICS.filter((t) => GUIDE_ART[t].routineId);
    expect(pictured).toHaveLength(7);
    for (const topic of pictured) {
      const routineId = GUIDE_ART[topic].routineId as string;
      expect(routineIds.has(routineId), routineId).toBe(true);
      expect(guideTopicFor({ routineId })).toBe(topic);
    }
    expect(guideTopicFor({ routineId: "morning" })).toBe("mornings");
    expect(guideTopicFor({ routineId: "goodbye" })).toBe("drop-off");
    expect(guideTopicFor({ routineId: "meal" })).toBe("meals");
    expect(guideTopicFor({ routineId: "tidy" })).toBe("tidy-up");
    expect(guideTopicFor({ routineId: "calm" })).toBe("calm-corner");
  });

  it("a routine wins over the words; a routine with no picture falls through to them", () => {
    expect(guideTopicFor({ routineId: "bedtime", title: "Breakfast is a battle" })).toBe("bedtime");
    expect(guideTopicFor({ routineId: "gratitude" })).toBeUndefined();
    expect(guideTopicFor({ routineId: "gratitude", title: "Saying thank you at dinner" })).toBe("meals");
  });

  it.each<[string, GuideTopic]>([
    ["Tears at drop-off every morning", "drop-off"],
    ["She hits her little brother when he takes her toys", "siblings"],
    ["How much TV is okay at two?", "screens"],
    ["He fights bedtime every night", "bedtime"],
    ["Getting dressed takes forever", "mornings"],
    ["Picky eating at dinner", "meals"],
    ["Won't help tidy the toys away", "tidy-up"],
    ["Grabs toys and won't take turns at the playground", "sharing"],
    ["Late talker: a few words at two", "new-words"],
    ["Ideas for playing outside in the rain", "outdoor-play"],
    ["Big tantrums when we leave the shop", "big-feelings"],
    ["A calm-down corner at home", "calm-corner"],
  ])("EN: %s -> %s", (title, topic) => {
    expect(guideTopicFor({ title })).toBe(topic);
  });

  it.each<[string, GuideTopic]>([
    ["בכי בפרידה בגן כל בוקר", "drop-off"],
    ["הוא מרביץ לאחותו הקטנה", "siblings"],
    ["כמה זמן מסך מותר בגיל שנתיים?", "screens"],
    ["היא לא נרדמת בלילה", "bedtime"],
    ["בררנות באוכל", "meals"],
    ["איך לגרום לו לסדר את הצעצועים?", "tidy-up"],
    ["לא מוכן לחלוק בצעצועים", "sharing"],
    ["אוצר מילים בגיל שנתיים", "new-words"],
    ["משחק בחוץ בחורף", "outdoor-play"],
    ["התקפי זעם בסופר", "big-feelings"],
    ["פינת רגיעה בבית", "calm-corner"],
  ])("HE: %s -> %s", (title, topic) => {
    expect(guideTopicFor({ title })).toBe(topic);
  });

  it("reads Hebrew with niqqud and attached particles", () => {
    expect(guideTopicFor({ title: "שֵׁינָה בַּצָּהֳרַיִם" })).toBe("bedtime");
    expect(guideTopicFor({ title: "בגן" })).toBe("drop-off");
  });

  it("does not take a word in its other sense", () => {
    // "לא מסכים" is "will not agree", not "screens".
    expect(guideTopicFor({ title: "הוא לא מסכים להתלבש בבוקר" })).toBe("mornings");
    // "גן שעשועים" is a playground, not a kindergarten.
    expect(guideTopicFor({ title: "בגן שעשועים הוא בורח" })).toBe("outdoor-play");
    // Dropping off to sleep is not a drop-off.
    expect(guideTopicFor({ title: "He won't drop off to sleep without me" })).toBe("bedtime");
    // A developmental screening is not screen time.
    expect(guideTopicFor({ title: "Should we book the two-year screening?" })).toBeUndefined();
  });

  it("is undefined when nothing matches, in either language", () => {
    expect(guideTopicFor({ title: "How do I keep a journal of the week?" })).toBeUndefined();
    expect(guideTopicFor({ title: "איך מנהלים יומן משפחתי?" })).toBeUndefined();
    expect(guideTopicFor({})).toBeUndefined();
    expect(guideTopicFor({ routineId: null, title: null, learnCategory: null })).toBeUndefined();
  });

  it("falls back to the Learn shelf only when the words say nothing", () => {
    expect(guideTopicFor({ learnCategory: "sleep" })).toBe("bedtime");
    expect(guideTopicFor({ learnCategory: "behavior" })).toBe("big-feelings");
    expect(guideTopicFor({ learnCategory: "parent" })).toBeUndefined();
    expect(guideTopicFor({ title: "Tantrums at dinner", learnCategory: "sleep" })).toBe("meals");
    expect(guideTopicFor({ title: "How do I keep a journal of the week?", learnCategory: "language" })).toBe("new-words");
  });
});
