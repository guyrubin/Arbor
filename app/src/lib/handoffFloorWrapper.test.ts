/**
 * B-ASKJB-44 round 11 — the handoff floor as a monotonic wrapper over main's
 * floor (lib/clinicalScan `withoutHandoffFindings`). Each rule's test carries
 * its negative control: what main returns for the same note today.
 * The property over every corpus is handoffFloor.monotonic.test.ts.
 */
import { describe, expect, it } from "vitest";
import { scrubHandoffBriefFindings, withoutHandoffFindings } from "./clinicalScan";
import { explainHandoffFloor, findEscalationCommands, handoffFloor, scrubHandoffBrief } from "./handoffFloorWrapper";

const HARD_MOMENT_EN = "He bit a friend at preschool when they fought over a toy\nWe separated them and he calmed after a hug";
const HARD_MOMENT_HE = "הוא נשך חבר בגן כשרבו על צעצוע\nהפרדנו ביניהם והוא נרגע אחרי חיבוק";
const ASK_EN = "We have a few minutes together after dinner. What can we do? He loves drawing.";
const ASK_HE = "יש לנו כמה דקות יחד אחרי ארוחת הערב. מה אפשר לעשות?";

describe("rule (a) — an escalation line main dropped comes back with its condition (EN + HE)", () => {
  it.each([
    // the live wave-1 regression: an escalation inside a condition clause, dropped from the School Brief
    ["When he shows no signs of calming after 20 minutes, call the family.", HARD_MOMENT_EN],
    ["If there are no signs of improvement in two weeks, see your pediatrician.", HARD_MOMENT_EN],
    ["במידה ואין סימנים לשיפור תוך שבועיים, כדאי להתייעץ עם פסיכולוג גן.", HARD_MOMENT_HE],
    ["Whenever he shows no signs of settling after 20 minutes, call the family.", HARD_MOMENT_EN],
    ["After 20 minutes with no signs of calming, call the family.", HARD_MOMENT_EN],
    ["Call the family after 20 minutes without signs of calming.", HARD_MOMENT_EN],
    ["If he shows no signs of calming after 20 minutes, let the family know right away.", HARD_MOMENT_EN],
    ["If there are no signs of improvement in a month, consult a child psychologist.", HARD_MOMENT_EN],
    ["כשאין סימנים של רגיעה אחרי 20 דקות, יש להתקשר מיד להורים.", HARD_MOMENT_HE],
    ["בכל פעם שאין סימנים של רגיעה אחרי 20 דקות, יש להתקשר להורים.", HARD_MOMENT_HE],
    ["כעבור 20 דקות ללא סימנים של רגיעה, התקשרו להורים.", HARD_MOMENT_HE],
    ["אם אין סימנים של רגיעה אחרי 20 דקות, יש לעדכן את ההורים.", HARD_MOMENT_HE],
    ["אחרי שבועיים ללא סימנים לשיפור בשינה, יש לפנות לרופאת הילדים.", HARD_MOMENT_HE],
  ])("restored verbatim: %s", (line, parentText) => {
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line); // main drops or cuts it today
    expect(handoffFloor(line, { parentText })).toBe(line);
  });

  /* Round 12 (P1-3): the app's own Hebrew wording ("צרו קשר עם המשפחה",
     mockProvider and live companion-topics output), "ליצור קשר", "להזעיק",
     "להפנות", and the English passive and noun forms. Main drops each line. */
  it.each([
    ["אם אין סימנים של רגיעה אחרי 20 דקות, צרו קשר עם המשפחה.", "צרו קשר עם המשפחה"],
    ["אם הוא פוגע בעצמו או שאין סימנים של רגיעה, יש ליצור קשר עם ההורים מיד.", "ליצור קשר עם ההורים"],
    ["אם אחרי 20 דקות אין סימנים של רגיעה, יש להזעיק את ההורים.", "להזעיק את ההורים"],
    ["אם אין סימנים לשיפור, מומלץ להפנות להערכה של קלינאית תקשורת.", "להפנות להערכה"],
    ["If there are no signs of calming, the nurse should be called right away.", "nurse should be called"],
    ["Should there be no signs of improvement, a referral to a speech therapist is recommended.", "referral to a speech therapist"],
  ])("restored with its condition: %s", (line, command) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe(line);
    expect(findEscalationCommands(line).some((c) => c.text.includes(command))).toBe(true);
  });

  /* Round 13 (P1-B): a command under a negation, or "called" in the sense of
     named, is no escalation: nothing is restored, the note stays as main leaves it. */
  it.each([
    ["There is no evidence of a speech delay, so a referral to the speech therapist is not needed.", HARD_MOMENT_EN],
    ["There are no signs of a speech delay, and his family should be called by their first names at pickup.", HARD_MOMENT_EN],
    ["No signs of delay were found, so the game should be called Sound Orbit.", HARD_MOMENT_EN],
    ["There are no signs of anxiety, so the nurse does not need to be called.", HARD_MOMENT_EN],
    ["אין עדות לעיכוב בדיבור, ולכן אין צורך להפנות לקלינאית תקשורת.", HARD_MOMENT_HE],
    ["אין סימנים לחרדה, ולכן אין צורך להזעיק את האחות.", HARD_MOMENT_HE],
    ["אין סימנים לעיכוב, ואת המשחק כדאי לקרוא סאונד אורביט.", HARD_MOMENT_HE],
  ])("not restored: %s", (line, parentText) => {
    expect(handoffFloor(line, { parentText })).toBe(withoutHandoffFindings(line, { parentText }));
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  /* Round 14 (P1-B): a discouraging word anywhere around the command, outside its condition, makes it no
     escalation; the encouraging forms ("don't hesitate", "do not wait", "אל תהססו", "אין לחכות") do not. */
  it.each([
    "There are no signs of a speech delay, so there is no point calling the speech therapist.",
    "There are no signs of a speech delay, so calling the family isn't necessary.",
    "There are no signs of a speech delay, so you don't have to contact the pediatrician.",
    "There are no signs of a speech delay, so hold off on calling the family.",
    "There are no signs of a speech delay, so a referral to a specialist would be premature.",
    "There is no evidence of anxiety, so there is no reason for the teacher to call the family.",
    "There is no evidence of anxiety, so there is no real need to call the family.",
    "אין סימנים לעיכוב בדיבור, ולכן אין מה להזעיק את ההורים.",
    "אין סימנים לעיכוב בדיבור, ולכן לא נדרשת הפניה לקלינאית תקשורת.",
    "אין סימנים לעיכוב בדיבור, ולכן אין טעם לפנות לרופאת הילדים.",
    "אין סימנים לחרדה, ולכן מיותר להתקשר להורים.",
    "אין סימנים לחרדה, ולכן אין שום צורך להתקשר להורים.",
    "אין סימנים לחרדה, ולכן אין צורך ממשי לפנות לאחות.",
    "There are no signs of delay, and the family should be called the Cohens in class.",
    "There are no signs of delay, and the nurse should be called Nurse Dana by the children.",
  ])("a discouraged or naming line stays as main leaves it: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  it.each([
    "Don't hesitate to call the family when there are no signs of calming.",
    "When there are no signs of calming, do not wait: call the family.",
    "When there are no signs of calming, you should not hesitate to call the family.",
    "אל תהססו להתקשר להורים כשאין סימנים של רגיעה.",
    "כשאין סימנים של רגיעה, אין לחכות ויש להתקשר להורים.",
    "כשאין סימנים של רגיעה, לא לחכות – להתקשר מיד להורים.",
  ])("an encouraging form keeps the escalation whole: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe(line);
  });

  it("a negated command is no command; the same command without the negation is one", () => {
    expect(findEscalationCommands("A referral to the speech therapist is not needed.")).toEqual([]);
    expect(findEscalationCommands("A referral to the speech therapist is recommended.").length).toBe(1);
    expect(findEscalationCommands("There is no need to call the family.")).toEqual([]);
    expect(findEscalationCommands("Do not call the family.")).toEqual([]);
    expect(findEscalationCommands("If he does not calm, call the family.").map((c) => c.text)).toEqual(["call the family"]);
    expect(findEscalationCommands("אין צורך להזעיק את האחות.")).toEqual([]);
    expect(findEscalationCommands("אין להפנות לקלינאית תקשורת.")).toEqual([]);
    expect(findEscalationCommands("יש להזעיק את האחות.").length).toBeGreaterThan(0);
    expect(findEscalationCommands("His family should be called by their first names.")).toEqual([]);
    expect(findEscalationCommands("His family should be called right away.").length).toBe(1);
  });

  it("round 13 (P2): a relay command with nothing left to relay stays dropped; with its condition or content it comes back", () => {
    for (const [line, parentText] of [
      ["Please tell the family that there are no signs of a speech delay.", HARD_MOMENT_EN],
      ["Let his parents know there is no evidence of attention difficulties at school.", HARD_MOMENT_EN],
      ["Tell the family there are no signs of anxiety at school.", HARD_MOMENT_EN],
      ["ספרו להורים שאין סימנים לעיכוב בדיבור.", HARD_MOMENT_HE],
      ["עדכנו את ההורים שאין עדות לקשיי קשב בגן.", HARD_MOMENT_HE],
    ]) {
      expect(withoutHandoffFindings(line, { parentText })).toBe("");
      expect(handoffFloor(line, { parentText })).toBe("");
    }
    const withCondition = "If he shows no signs of calming after 20 minutes, let the family know right away.";
    expect(handoffFloor(withCondition, { parentText: HARD_MOMENT_EN })).toBe(withCondition);
    expect(handoffFloor("אם אין סימנים של רגיעה אחרי 20 דקות, יש לעדכן את ההורים.", { parentText: HARD_MOMENT_HE })).toBe("אם אין סימנים של רגיעה אחרי 20 דקות, יש לעדכן את ההורים.");
  });

  /* Round 16 (P1-A): a deferred instruction is no escalation, and a condition that is itself an unspoken
     negated reassurance ("If there are no signs of anxiety") governs nothing. Each stays as main leaves it. */
  it.each([
    "When there are no signs of anxiety, you can update the parents at the next meeting.",
    "When there are no signs of a speech delay, it is enough to mention it to the family at the end of the year.",
    "If there are no signs of anxiety, just let the family know at pickup next week.",
    "When there are no signs of a speech delay, the pediatrician can be consulted at the routine checkup next year.",
    "When there are no signs of anxiety, a short note to the family next month is enough.",
    "When there are no signs of calming, tell the family at the next pickup.",
    "כשאין סימנים לחרדה, ניתן לעדכן את ההורים בפגישה הבאה.",
    "כשאין סימנים לעיכוב, מספיק לעדכן את ההורים בסוף השנה.",
    "כשאין סימנים לחרדה, אפשר לספר להורים באסיפה של החודש הבא.",
    "כשאין סימנים לעיכוב בדיבור, אפשר להתייעץ עם רופאת הילדים בבדיקה השגרתית בשנה הבאה.",
    "כשאין סימנים לחרדה, אפשר להמתין ולעדכן את ההורים רק בחודש הבא.",
    "When there are no signs of anxiety, call the family.",
    "When there are no signs of crying at drop-off, call the family.",
    "כשאין סימנים של בכי, התקשרו להורים.",
    "כשאין סימנים לחרדה, התקשרו להורים.",
    "If there are no signs of a speech delay, a referral to a specialist can safely wait.",
    "כשאין סימנים לעיכוב, כדאי להמתין שבועיים ורק אז לעדכן את ההורים.",
  ])("deferred, or governed only by an unspoken reassurance: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  it.each([
    "Phone the family when there are no signs of calming after 20 minutes.",
    "When, after 20 minutes, there are still no signs of settling, phone the family.",
    "After 20 minutes with no signs of settling, call the family.",
    "Once he shows no signs of settling after 20 minutes, phone the family.",
    "When there are no signs of calming, call the family, not only the teacher.",
    "When there are no signs of calming, call the family no matter how late it is.",
    "When there are no signs of anxiety and he hurts himself, call the family.",
    "התקשרו להורים כשאין סימנים של רגיעה אחרי 20 דקות.",
    "ברגע שאין סימנים של רגיעה אחרי 20 דקות, עדכנו את ההורים מיד.",
    "כשאין סימנים של רגיעה, התקשרו להורים בכל שעה.",
    "במידה ואין סימנים לשיפור, יש לעדכן את ההורים ולא רק את הגננת.",
    "כעבור 20 דקות ללא סימנים של רגיעה, התקשרו להורים.",
    "כשאין סימנים של רגיעה, התקשרו להורים לא משנה מה השעה.",
  ])("a condition that negates a change, or names a harm, still governs: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
  it("lines main keeps stay byte-identical (K01, HK01)", () => {
    for (const line of ["If he cannot be calmed within 20 minutes, call the family and do not leave him alone.", "אם הוא לא נרגע תוך 20 דקות, התקשרו להורים ואל תשאירו אותו לבד."]) {
      const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
      expect(withoutHandoffFindings(line, { parentText })).toBe(line);
      expect(handoffFloor(line, { parentText })).toBe(line);
    }
  });

  /* Round 17 (P1-A): timing is an allow-list. A command that carries any time phrase other than an immediate
     one stays as main leaves it, whatever the wording (critic fresh16: C11-C13, C28, W11-W16, HC10-HC13,
     HC27, HW11-HW14). */
  it.each([
    "When there are no signs of calming, tell the family at the next parent evening.",
    "When there are no signs of calming, let the family know when the term ends.",
    "When there are no signs of settling, mention it to the family after the holidays.",
    "If there are no signs of calming, bring it up with the family at the parent-teacher conference.",
    "When there are no signs of calming, let the family know at the end-of-year meeting.",
    "When there are no signs of calming, tell the family once the holidays are over.",
    "When there are no signs of settling, let the family know next school year.",
    "When there are no signs of calming, let the family know in a month.",
    "When there are no signs of settling, tell the family after the break.",
    "When there are no signs of calming, wait a day before calling the family.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים בפגישת ההורים.",
    "כשאין סימנים של רגיעה, ספרו להורים אחרי החגים.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים בעוד שבועיים.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים כשהשנה מסתיימת.",
    "כשאין סימנים של רגיעה, חכו יום ורק אז התקשרו להורים.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים אחרי החופש.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים בעוד חודש.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים בפגישה הקרובה בעוד חודש.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים לקראת סוף השנה.",
    "When there are no signs of calming, call the family, at the end of the term.",
    "At the next meeting, when there are no signs of calming, tell the family.",
    "Call the family when, after 20 minutes, there are no signs of calming, at the end of the term.",
    "When there are no signs of calming, call the family not today but next week.",
    "כשאין סימנים של רגיעה, התקשרו להורים לא היום אלא בשבוע הבא.",
    "When there are no signs of calming, next week, tell the family.",
    "כשאין סימנים של רגיעה, בשבוע הבא, ספרו להורים.",
  ])("a deferred command stays as main leaves it: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  /* Round 19 (P1-D): a vital sign qualifies only as its own absence, never a problem with it (critic fresh18
     F01-F04, HF01, HF03); its own absence still restores (F05, F06, HF04, HF05, W20, HW19). */
  it.each([
    "When there are no signs of breathing trouble, tell the family.",
    "When there are no signs of trouble breathing, let the family know.",
    "When there are no signs of shortness of breath, call the family.",
    "When there are no signs of laboured breathing, tell the family.",
    "כשאין סימנים לקוצר נשימה, עדכנו את ההורים.",
    "כשאין סימנים לנשימה מהירה, התקשרו להורים.",
  ])("a problem with a vital sign does not qualify: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  it.each([
    "When there are no signs of a pulse, call an ambulance.",
    "When he shows no signs of being responsive, call an ambulance.",
    "When there are no signs of normal breathing, call an ambulance.",
    "כשאין סימנים לנשימה תקינה, הזמינו אמבולנס.",
  ])("a vital sign's own absence still restores: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
  /* Round 18 (P1-A): a negation that governs before / until / earlier (לפני, עד, מוקדם) is a deferral, never
     stripped (critic fresh17 N02, N03, HN02, HN03); "don't wait until pickup" still restores (N04, HN04). */
  it.each([
    "When there are no signs of calming, call the family, but not before next week.",
    "When there are no signs of calming, tell the family, though not until the term ends.",
    "When there are no signs of calming, call the family, but not earlier than Monday.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים, אבל לא לפני השבוע הבא.",
    "כשאין סימנים של רגיעה, ספרו להורים, רק לא לפני סוף החודש.",
    "כשאין סימנים של רגיעה, התקשרו להורים, אבל לא עד שהשבוע נגמר.",
  ])("a negated before / until stays as main leaves it: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  it.each([
    "When there are no signs of calming, don't wait until pickup, call the family.",
    "כשאין סימנים של רגיעה, אל תחכו לאיסוף, התקשרו להורים.",
  ])("a negated wait still restores: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
  /* Round 18 (P1-B): a condition after the command that is not about the hard moment is the time of the
     action, and a visit is the escalation's object only when the command books it (critic fresh17 P02, HP02,
     E01, E02, HE01-HE03). */
  it.each([
    "When there are no signs of calming, tell the family during their visit with the pediatrician.",
    "כשאין סימנים של רגיעה, ספרו להורים בביקור אצל רופאת הילדים.",
    "When there are no signs of calming, tell the family when they pick him up.",
    "When there are no signs of calming, let the family know when he gets home.",
    "When there are no signs of calming, tell the family, when you see the teacher.",
    "כשאין סימנים של רגיעה, ספרו להורים כשהם באים לאסוף אותו.",
    "כשאין סימנים של רגיעה, עדכנו את ההורים כשהוא חוזר הביתה.",
    "כשאין סימנים של רגיעה, ספרו להורים כשתראו אותם.",
  ])("a deferral worded as an event or a visit stays as main leaves it: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  it.each([
    "When there are no signs of calming, suggest the family book a visit with the pediatrician.",
    "כשאין סימנים של רגיעה, הציעו להורים לקבוע תור אצל רופאת הילדים.",
    "When there are no signs of calming, let the family know as soon as possible.",
    "When there are no signs of calming, call the family when he hurts himself.",
  ])("a booked visit, an immediate time or a moment condition still restores: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
  /* Round 18 (P2): "change" is a negated change only bare or on the hard moment (critic fresh17 X01, X02). */
  it.each([
    "When there are no signs of mood changes, let the family know.",
    "When there are no signs of behavior changes at home, tell the family.",
    "כשאין סימנים לשינויים במצב הרוח, עדכנו את ההורים.",
  ])("a change of something else does not qualify: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  it.each([
    "When there are no signs of change, call the family.",
    "When there are no signs of change in the crying, call the family.",
    "כשאין סימנים לשינוי, התקשרו להורים.",
    "כשאין סימנים לשינוי בבכי, התקשרו להורים.",
  ])("a bare change, or one in the hard moment, still qualifies: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
  /* Round 17 (P1-B): every item of a negated list is masked before a harm word may qualify the condition
     (C09, W05-W07, HW06, HW07). */
  it.each([
    "If there are no signs of biting or hitting, let the family know.",
    "When there are no signs of hitting or biting, tell the family.",
    "When there are no signs of crying or screaming at drop-off, phone the family.",
    "If there are no signs of hitting, biting or kicking, let the family know.",
    "אם אין סימנים של בכי או צרחות, עדכנו את ההורים.",
    "כשאין סימנים שהוא מרביץ או נושך, עדכנו את ההורים.",
  ])("a harm word inside a negated list does not qualify: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe("");
  });
  /* Round 17 (P1-A): an immediate time or a negated deferral restores (W17, W19, HW16, HW17); a monitoring
     duration is the condition's own, and a visit with a professional is the escalation's object. */
  it.each([
    "When there are no signs of calming, call the family today, not next week.",
    "When there are no signs of calming, let the family know right away rather than at pickup.",
    "כשאין סימנים של רגיעה, התקשרו להורים היום ולא בשבוע הבא.",
    "כשאין סימנים של רגיעה, התקשרו להורים מיד ואל תחכו לפגישה הבאה.",
    "Call the family when, after 20 minutes, there are no signs of calming.",
    "When there are no signs of calming, suggest a visit to the pediatrician right away.",
    "When there are no signs of improvement, after two weeks, talk with the pediatrician.",
  ])("an immediate time restores: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
  /* Round 17 (P1-B, critic P2): a vital sign's absence is the emergency itself (W20, HW19). */
  it.each([
    "When there are no signs of normal breathing, call an ambulance.",
    "כשאין סימנים לנשימה תקינה, הזמינו אמבולנס.",
  ])("a vital sign's absence restores: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
  /* Round 17 (P2): the Hebrew change forms — "נרגע" read as present under a negation, "נפסק" (HC03, HW01,
     HW03, HV05). */
  it.each([
    "כשאין סימן שהבכי נרגע, התקשרו להורים מיד.",
    "כשאין סימנים שהוא נרגע אחרי עשרים דקות, התקשרו לאמא שלו.",
    "כשאין סימנים שהצרחות נפסקות, התקשרו להורים מיד.",
    "כשהוא לא נרגע ואין סימנים של רגיעה, עדכנו את ההורים.",
  ])("a Hebrew negated change restores: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });

  it("a cut line comes back whole: a condition split off by ';' or a new line, a title's full stop", () => {
    for (const line of [
      "If there are no signs of calming after 20 minutes; call the family.",
      "If there are no signs of calming after 20 minutes,\ncall the family.",
      "Call the family; if there are no signs of calming after 20 minutes.",
      "אם אין סימנים של רגיעה אחרי 20 דקות; יש להתקשר להורים.",
      "If there are no signs of improvement after two weeks, talk with Dr. Levi.",
    ]) {
      expect(withoutHandoffFindings(line)).not.toBe(line);
      expect(handoffFloor(line)).toBe(line);
    }
    expect(withoutHandoffFindings("If there are no signs of improvement after two weeks, talk with Dr. Levi.")).toBe("Levi.");
  });

  /* Round 15 (P1-B): main's own escalation line is a condition plus a referral; a command no condition
     governs is never restored, whatever its wording. Each stays as main leaves it. */
  it.each([
    "Talk with Dr. Levi, who found no signs of delay when she assessed him.",
    "Contact the family once a week, as there is no evidence of attention difficulties.",
    "Please contact the family with any questions — he shows no signs of delay when playing with peers.",
    "When tested last month he showed no signs of delay, so contact the family with questions.",
    "דברו עם ד\"ר לוי, שאמרה שאין סימנים לעיכוב כשבדקה אותו.",
    "There are no signs of a speech delay, so it is better to wait a few weeks before calling the speech therapist.",
    "There are no signs of a speech delay, so I'd give it a few weeks before calling the pediatrician.",
    "There is no evidence of anxiety, so there's no rush to call the family.",
    "There is no evidence of anxiety, so calling the family can be left for later.",
    "There are no signs of a speech delay, so let's see how the next month goes before contacting the speech therapist.",
    "There are no signs of a speech delay, so a referral to a specialist can safely wait.",
    "There are no signs of a speech delay, so give it two weeks before you call the family.",
    "There are no signs of a speech delay, so instead of calling the pediatrician, wait for the next checkup.",
    "אין סימנים לעיכוב בדיבור, ולכן אפשר להמתין ורק אחר כך להתקשר להורים.",
    "אין סימנים לחרדה, ולכן לא בוער להתקשר להורים.",
    "אין סימנים לעיכוב בדיבור, ולכן כדאי להמתין שבועיים ורק אז לפנות לרופאת הילדים.",
    "אין סימנים לחרדה, ולכן עוד מוקדם להתקשר להורים.",
    "אין עדות לקשיי קשב, ולכן עדיף להמתין ולהתקשר להורים רק בחודש הבא.",
    "אין סימנים לחרדה, ולכן אין דחיפות להתקשר להורים.",
    "אין סימנים לחרדה, ולכן במקום להתקשר להורים אפשר לחכות לאסיפה.",
    "אין סימנים לעיכוב בדיבור, ולכן נחכה חודש לפני שנפנה לקלינאית ובינתיים לא להתקשר להורים.",
  ])("ungoverned, not restored: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(handoffFloor(line, { parentText })).toBe(withoutHandoffFindings(line, { parentText }));
    expect(findEscalationCommands(handoffFloor(line, { parentText }))).toEqual([]);
  });
  it.each([
    "When there are no signs of calming, do not delay calling the family.",
    "When he shows no signs of settling within 20 minutes, call the family without waiting.",
    "Where there are no signs of calming, don't put off calling the family.",
    "When there are no signs of calming, call the family, not just the teacher.",
    "When there are no signs of calming, call the family immediately, no matter the time.",
    "When she shows no signs of settling and does not stop crying, phone the family.",
    "כשאין סימנים של רגיעה, אין להתעכב – התקשרו מיד להורים.",
    "כשאין סימנים של רגיעה, אל תדחו – התקשרו להורים.",
    "כשאין סימנים לשיפור, יש להתקשר להורים בלי לחכות.",
    "כשאין סימנים של רגיעה, התקשרו להורים ולא רק לגננת.",
    "כשהיא לא נרגעת ואין סימנים של רגיעה, התקשרו להורים.",
    "במקום שאין סימנים של רגיעה, התקשרו להורים.",
  ])("governed, restored whole: %s", (line) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).toBe("");
    expect(handoffFloor(line, { parentText })).toBe(line);
  });

  it.each([
    ["When convenient, call the family, since he shows no signs of delay.", "When convenient, call the family."],
    ["Contact the family when he is upset at drop-off, and note there are no signs of attention difficulties.", "Contact the family when he is upset at drop-off."],
    ["When he cries and there are no signs of calming, call the family, because this is a sign of separation anxiety.", "When he cries and there are no signs of calming, call the family."],
    ["התקשרו להורים כשהוא נסער בבוקר, ואין סימנים לקשיי קשב.", "התקשרו להורים כשהוא נסער בבוקר."],
    ["אם יש שינוי, כדאי לעדכן את ההורים, כי אין סימנים לעיכוב בדיבור.", "אם יש שינוי, כדאי לעדכן את ההורים."],
    ["כשאין סימנים של רגיעה אחרי 20 דקות, יש להתקשר להורים, כי זה סימן לחרדת פרידה.", "כשאין סימנים של רגיעה אחרי 20 דקות, יש להתקשר להורים."],
  ])("restored without the clause that states a finding: %s", (line, restored) => {
    expect(withoutHandoffFindings(line, { parentText: HARD_MOMENT_EN })).not.toContain(restored); // main drops or cuts the line
    expect(handoffFloor(line, { parentText: HARD_MOMENT_EN })).toBe(restored);
  });

  it("a condition naming a diagnosis the parent never wrote stays out, and the command it governed stays out with it (round 15); the parent's own word keeps the line", () => {
    const line = "After a month with no signs of improvement in his speech delay, contact the family.";
    expect(handoffFloor(line, { parentText: HARD_MOMENT_EN })).toBe("");
    expect(handoffFloor("כעבור חודש ללא סימנים לשיפור בעיכוב השפתי שלו, יש לעדכן את ההורים.", { parentText: HARD_MOMENT_HE })).toBe("");
    expect(handoffFloor(line, { parentText: "His speech delay is our main worry this month." })).toBe(line);
  });

  it("round 12 (P2): \"Where …\" is a condition like \"When …\"; a finding label the parent never wrote leaves the condition, never the command", () => {
    const where = "Where there are no signs of calming after 20 minutes, phone the parents.";
    expect(withoutHandoffFindings(where, { parentText: HARD_MOMENT_EN })).toBe("");
    expect(handoffFloor(where, { parentText: HARD_MOMENT_EN })).toBe(where);
    const t18 = "After a month with no signs of improvement in his articulation problems, contact the family.";
    // round 15: without its condition the command is ungoverned, so the whole line stays as main leaves it
    expect(handoffFloor(t18, { parentText: HARD_MOMENT_EN })).toBe("");
    expect(handoffFloor("כעבור חודש ללא סימנים לשיפור בבעיית ההגייה שלו, יש לעדכן את ההורים.", { parentText: HARD_MOMENT_HE })).toBe("");
    expect(handoffFloor("After a month with no signs of improvement in his behavior difficulties, contact the family.", { parentText: HARD_MOMENT_EN })).toBe("");
    // the parent's own label keeps the whole line; a plain trigger ("in his sleep") is no label
    expect(handoffFloor(t18, { parentText: "His articulation problems worry us" })).toBe(t18);
    const sleep = "After two weeks with no signs of improvement in his sleep, talk with your pediatrician.";
    expect(handoffFloor(sleep, { parentText: HARD_MOMENT_EN })).toBe(sleep);
  });

  it("no command, nothing restored: narrated lines and plain findings keep main's verdict", () => {
    for (const [line, parentText] of [
      ["When he gets to tell his parents about his day he shows no signs of anxiety.", HARD_MOMENT_EN],
      ["She shows no signs of anxiety at drop-off.", HARD_MOMENT_EN],
      ["אתמול פנו ההורים לרופאה, שמצאה שאין סימנים לעיכוב.", HARD_MOMENT_HE],
      ["התקשרו אלינו מהגן כשהוא בכה, ואין סימנים לחרדה בבית.", HARD_MOMENT_HE],
      ["Whenever the teacher calls him he shows no signs of distress.", HARD_MOMENT_EN],
    ]) {
      expect(handoffFloor(line, { parentText })).toBe(withoutHandoffFindings(line, { parentText }));
    }
  });
});

describe("rule (b) — a negated-finding reassurance the parent never said is removed (EN + HE)", () => {
  it.each([
    ["Parent reports no evidence of attention or regulation difficulties.", ASK_EN],
    ["The parents say that he shows no signs of sensory overload.", ASK_EN],
    ["There is no evidence of attention difficulties, according to the family.", ASK_EN],
    ["No signs of anxiety at drop-off, according to her teacher.", ASK_EN],
    ["There is no evidence of attention or regulation difficulties.", "The doctor found no evidence of an ear infection last week. He still cries at drop-off."],
    ["ההורים מספרים שאין סימנים לקשיי קשב או ויסות.", ASK_HE],
    ["הגננת סיפרה שאין סימנים לחרדה בפרידה.", ASK_HE],
    ["אין עדות לקשיי קשב, לדברי ההורים.", ASK_HE],
    ["הגננת סיפרה שלא נצפו סימנים לחרדה בפרידה.", ASK_HE],
    ["הרופאה אמרה שלא נמצאו קשיים בדיבור.", ASK_HE],
    ["אין סימנים לקשיי קשב או ויסות.", "הרופאה אמרה שאין סימנים לדלקת אוזניים. הוא עדיין בוכה בבוקר."],
  ])("removed: %s", (line, parentText) => {
    expect(withoutHandoffFindings(line, { parentText })).toBe(line); // main keeps it today
    const trace = explainHandoffFloor(line, { parentText });
    expect(trace.output).toBe("");
    expect(trace.removedReassurances.length).toBeGreaterThan(0);
    for (const r of trace.removedReassurances) expect(r.absentWords.length).toBeGreaterThan(0);
  });

  it("the parent said X: the sentence stays exactly as main leaves it (also in other words)", () => {
    const cases: [string, string][] = [
      ["My son shows no signs of hearing problems since the ear tubes.", "The ENT says my son shows no signs of hearing problems since the ear tubes."],
      ["אין עדות לדלקת אוזניים.", "הרופאה אמרה לנו שאין עדות לדלקת אוזניים."],
      ["No signs of anxiety at drop-off, according to her teacher.", "She isn't anxious at drop-off anymore since the picture chart."],
      ["אין סימנים לחרדה בכניסה לגן, לדברי הגננת.", "הגננת אמרה שהחרדה בכניסה לגן עברה."],
    ];
    for (const [line, parentText] of cases) {
      expect(withoutHandoffFindings(line, { parentText })).toBe(line);
      expect(handoffFloor(line, { parentText })).toBe(line);
    }
  });

  it("round 12: the parent's own word for the finding counts as saying it (difficulties / problems, קשיים / בעיות)", () => {
    for (const [line, parentText] of [
      ["Mom reports no signs of sleep difficulties since the new routine.", "He's been sleeping through, no sleep problems since the new routine"],
      ["אמא מספרת שאין סימנים לקשיי שינה מאז השגרה החדשה.", "הוא ישן טוב, אין בעיות שינה מאז השגרה החדשה"],
    ]) {
      expect(withoutHandoffFindings(line, { parentText })).toBe(line);
      expect(handoffFloor(line, { parentText })).toBe(line);
    }
    expect(handoffFloor("Mom reports no signs of sleep difficulties since the new routine.", { parentText: ASK_EN })).toBe("");
  });

  it("round 13 (P2): a parent's word counts only about the child, never when it qualifies a thing", () => {
    // G01 / HG01: "problems with the behaviour chart" says nothing about his behavior; the label leaves, the command stays
    // (round 15: with its label condition gone the command is ungoverned, so the line stays as main leaves it)
    expect(handoffFloor("After a month with no signs of improvement in his behavior problems, contact the family.", { parentText: "He had no problems with the behaviour chart this week" }))
      .toBe("");
    expect(handoffFloor("כעבור חודש ללא סימנים לשיפור בבעיות ההתנהגות שלו, יש לעדכן את ההורים.", { parentText: "לא היו לו בעיות עם לוח ההתנהגות השבוע" }))
      .toBe("");
    expect(handoffFloor("After a month with no signs of improvement in his behavior problems, contact the family.", { parentText: "His behavior problems are our main worry" }))
      .toBe("After a month with no signs of improvement in his behavior problems, contact the family.");
    // G02: "No problem at all with the new car seat" is about the seat; main keeps the teacher's line, rule (b) removes it
    const g02 = "His teacher says there are no signs of problems at drop-off.";
    expect(withoutHandoffFindings(g02, { parentText: "No problem at all with the new car seat" })).toBe(g02);
    expect(handoffFloor(g02, { parentText: "No problem at all with the new car seat" })).toBe("");
    // R01 / about the child: kept as main keeps it
    for (const [line, parentText] of [
      ["Mom reports no signs of sleep difficulties since the new routine.", "He's been sleeping through, no sleep problems since the new routine"],
      ["Mom reports no signs of speech problems.", "He had problems with his speech last year"],
      ["His teacher sees no signs of anxiety at drop-off.", "Met his teacher about the biting, no signs of anxiety at drop-off since the chart."],
    ]) expect(handoffFloor(line, { parentText })).toBe(line);
  });

  it("a condition is not a reassurance: kept as main keeps it", () => {
    for (const line of [
      "Call the family if he bites, or there are no signs of a speech delay at home.",
      "Call the family if he is upset and there is no evidence of a speech delay.",
      "Call the family if he cries for more than 20 minutes, and the bus driver if there are no signs of calming.",
      "If he shows no signs of calming after 20 minutes, or hurts himself or others, call the parent and the school nurse right away.",
      "אם אין סימנים של רגיעה אחרי 20 דקות, או שהוא פוגע בעצמו, יש להתקשר מיד להורים.",
      "יש להתקשר להורים אם הוא בוכה יותר מ-20 דקות, ולאחות אם אין סימנים של רגיעה.",
      "Mom says that if he shows no signs of calming, she picks him up.",
    ]) {
      expect(withoutHandoffFindings(line, { parentText: HARD_MOMENT_EN })).toBe(line);
      expect(handoffFloor(line, { parentText: HARD_MOMENT_EN })).toBe(line);
    }
  });

  it.each([
    ["Call the family if he bites, but there are no signs of a speech delay at home.", "Call the family if he bites."],
    ["Call the family if he cries for more than 20 minutes, and the nurse if he hurts himself, though there are no signs of a speech delay.", "Call the family if he cries for more than 20 minutes, and the nurse if he hurts himself."],
    ["If you are worried, contact the family, as there are no signs of a speech delay at home.", "If you are worried, contact the family."],
    ["If you have questions, contact Dr. Levi, who found no signs of delay at his last visit.", "If you have questions, contact Dr. Levi."],
    ["יש להתקשר להורים אם הוא בוכה יותר מ-20 דקות, ולאחות אם הוא פוגע בעצמו, אבל אין סימנים לעיכוב בדיבור.", "יש להתקשר להורים אם הוא בוכה יותר מ-20 דקות, ולאחות אם הוא פוגע בעצמו."],
    ["יש להתקשר להורים אם הוא בוכה יותר מ-20 דקות, ואין סימנים לעיכוב בדיבור.", "יש להתקשר להורים אם הוא בוכה יותר מ-20 דקות."],
    ["התקשרו להורים אם הוא נושך, או ספרו לגננת שאין סימנים לעיכוב בדיבור בבית.", "התקשרו להורים אם הוא נושך."],
  ])("an escalation keeps every command and condition; only the asserted add-on goes: %s", (line, out) => {
    const parentText = /[א-ת]/.test(line) ? HARD_MOMENT_HE : HARD_MOMENT_EN;
    expect(withoutHandoffFindings(line, { parentText })).not.toBe(out); // main keeps the add-on (or cuts the line)
    expect(handoffFloor(line, { parentText })).toBe(out);
    for (const command of findEscalationCommands(out)) expect(handoffFloor(line, { parentText })).toContain(command.text);
  });

  it("a reassurance in its own comma chunk goes; the hard moment beside it stays, without the word that joined them", () => {
    expect(handoffFloor("He bit a friend at preschool, and there are no signs of anxiety at drop-off, according to his teacher.")).toBe("He bit a friend at preschool.");
    expect(handoffFloor("הוא נשך חבר, ואין סימנים לחרדה, לדברי הגננת.")).toBe("הוא נשך חבר.");
    expect(handoffFloor("Noa enjoys drawing with a parent. No signs of attention difficulties, according to mom. A short warning before cleanup helps."))
      .toBe("Noa enjoys drawing with a parent. A short warning before cleanup helps.");
    // round 12 (P2): no "While …" / "למרות ש…" fragment is left behind
    expect(handoffFloor("The teacher noted no signs of anxiety, although he threw a chair during circle time.", { parentText: "He threw a chair during circle time" }))
      .toBe("He threw a chair during circle time.");
    expect(handoffFloor("Mom reports no signs of hunger, while he screamed and hit the teacher.", { parentText: "He screamed and hit the teacher at pickup" }))
      .toBe("He screamed and hit the teacher.");
    expect(handoffFloor("הגננת ציינה שאין סימנים לחרדה, למרות שהוא זרק כיסא במפגש.", { parentText: "הוא זרק כיסא במפגש" })).toBe("הוא זרק כיסא במפגש.");
    expect(handoffFloor("אין עדות לקשיי קשב, אבל הוא הרביץ לילד בתור למגלשה.", { parentText: "הוא הרביץ לילד בתור למגלשה. אין עדות לחום." })).toBe("הוא הרביץ לילד בתור למגלשה.");
  });

  /* Round 12 (P1-1): the critic's rows where the reassurance shares its
     chunk with a hard moment or any other clause. Main keeps each sentence;
     so does the wrapper, whole. */
  it.each([
    ["His teacher said there were no signs of separation anxiety before he pushed a boy off the slide.", "He pushed a boy off the slide at recess"],
    ["Mom reports no signs of tiredness after he bit Noa at lunch.", "He bit Noa at lunch on Tuesday"],
    ["He kicked a classmate at drop-off with no signs of anger beforehand.", "He kicked a classmate at drop-off. No signs of a fever."],
    ["Mom reports no signs of hunger while he screamed and hit the teacher.", "He screamed and hit the teacher at pickup"],
    ["There are no signs of a cold and he kicked a classmate at drop-off.", "He kicked a classmate at drop-off. No signs of a cold this week."],
    ["He bit a friend at preschool and there are no signs of anxiety at drop-off, according to his teacher.", ""],
    ["He still cries at drop-off and there are no signs of anxiety.", "The doctor found no signs of an ear infection. He still cries at drop-off."],
    ["There are no signs of anxiety but he bit a friend twice.", "The doctor found no signs of an ear infection. He still cries at drop-off."],
    ["He settled quickly and showed no signs of anxiety, according to his teacher.", ""],
    ["אמא מספרת שאין סימנים לעייפות אחרי שהוא נשך את נועה בארוחת הצהריים.", "הוא נשך את נועה בארוחת הצהריים"],
    ["אמא מספרת שאין סימנים לרעב בזמן שהוא צרח והרביץ לגננת.", "הוא צרח והרביץ לגננת באיסוף"],
    ["הגננת אמרה שלא היו סימנים לחרדת פרידה לפני שהוא דחף ילד מהמגלשה.", "הוא דחף ילד מהמגלשה בהפסקה"],
    ["אין סימנים להצטננות והוא בעט בילד בכניסה לגן.", "הוא בעט בילד בכניסה לגן. אין סימנים להצטננות השבוע."],
    ["הוא נשך חבר ואין סימנים לחרדה.", "הרופאה אמרה שאין סימנים לדלקת אוזניים. הוא עדיין בוכה בבוקר."],
    ["הוא בוכה בבוקר והגננת אומרת שאין סימנים לחרדה.", "הרופאה אמרה שאין סימנים לדלקת אוזניים. הוא עדיין בוכה בבוקר."],
    // round 13 (P1-A): a hard moment joined to the reassurance by and / or / ו / או
    ["His teacher said he showed no signs of distress and bit a classmate during circle time.", "He bit a classmate during circle time"],
    ["The teacher noted no signs of fear and pushed a boy off the slide at recess.", "He pushed a boy off the slide at recess"],
    ["Mom reports no signs of tiredness or hitting at home this week.", "He hit his sister at home this week"],
    ["הגננת אמרה שאין סימנים למצוקה ונשך ילד במפגש.", "הוא נשך ילד במפגש"],
    ["הגננת ציינה שאין סימנים לפחד ודחף ילד מהמגלשה בהפסקה.", "הוא דחף ילד מהמגלשה בהפסקה"],
    ["אמא מספרת שאין סימנים לעייפות או למכות בבית השבוע.", "הוא הרביץ לאחותו בבית השבוע"],
    ["אמא מספרת שאין סימנים לחרדה בפרידה והוא נשך חבר בגן.", "הוא נשך חבר בגן"],
  ])("kept whole, as main keeps it: %s", (line, parentText) => {
    expect(withoutHandoffFindings(line, { parentText })).toBe(line);
    expect(handoffFloor(line, { parentText })).toBe(line);
  });
});

describe("everything else is main's output byte-for-byte", () => {
  it.each([
    "The parent reports that Noa cries at drop-off most mornings.",
    "Mom reports no sleep difficulties since the new routine.",
    "Shows no hesitation joining group games.",
    "She did not wait for signs of tiredness before bed.",
    "He was observed biting Lily at preschool.",
    "Teachers can check in briefly; there is no evidence of a learning difficulty.",
    "Call the family if he cries, because this is a sign of separation anxiety.",
    "Persistent or worsening difficulty that disrupts daily life is a reason to talk with a professional.",
    "הוא נצפה נושך חבר בגן בזמן ריב על צעצוע.",
    "נצפתה אינטראקציה חיובית סביב ציור משותף חופשי; מומלץ להמשיך לעודד פעילויות מבוססות קשר וויסות הדדי.",
    "",
  ])("%s", (line) => {
    for (const parentText of ["", HARD_MOMENT_EN, HARD_MOMENT_HE]) {
      expect(handoffFloor(line, { parentText })).toBe(withoutHandoffFindings(line, { parentText }));
    }
  });
});

describe("escalation commands (EN + HE)", () => {
  it("finds the command with its recipient; a narrated or past-tense verb is not one", () => {
    expect(findEscalationCommands("If it persists, talk with your pediatrician.").map((c) => c.text)).toEqual(["talk with your pediatrician"]);
    expect(findEscalationCommands("Call 112 right away.").map((c) => c.text)).toEqual(["Call 112"]);
    expect(findEscalationCommands("אם זה נמשך, כדאי להתייעץ עם פסיכולוג גן.").map((c) => c.text)).toEqual(["כדאי להתייעץ", "להתייעץ עם פסיכולוג"]);
    expect(findEscalationCommands("יש להתקשר מיד.").length).toBe(1);
    expect(findEscalationCommands("We talked with the pediatrician last week.")).toEqual([]);
    expect(findEscalationCommands("He gets to tell his parents about his day.")).toEqual([]);
    expect(findEscalationCommands("אתמול פנו ההורים לרופאה.")).toEqual([]);
    expect(findEscalationCommands("התקשרו אלינו מהגן.")).toEqual([]);
  });
});

describe("scrubHandoffBrief — the wrapper over a School Brief draft", () => {
  it("the escalation strategy main empties comes back; the crisis line is never touched; an emptied item goes", () => {
    const draft = () => ({
      title: "School note",
      overview: "Noa does best with a warning. There is no evidence of attention difficulties, according to the family.",
      keyStrengths: ["Curious", "No signs of anxiety at drop-off, according to her teacher."],
      suggestedTeacherStrategies: ["Give a two-minute warning", "When he shows no signs of calming after 20 minutes, call the family."],
      crisisEscalationTrigger: "No signs of distress so far; contact the family the same day if that changes.",
    } as Record<string, unknown>);
    const main = draft();
    scrubHandoffBriefFindings(main, { parentText: ASK_EN });
    expect(main.suggestedTeacherStrategies).toEqual(["Give a two-minute warning"]); // negative control: main loses the escalation
    const brief = draft();
    expect(scrubHandoffBrief(brief, { parentText: ASK_EN })).toBe(2);
    expect(brief).toEqual({
      title: "School note",
      overview: "Noa does best with a warning.",
      keyStrengths: ["Curious"],
      suggestedTeacherStrategies: ["Give a two-minute warning", "When he shows no signs of calming after 20 minutes, call the family."],
      crisisEscalationTrigger: "No signs of distress so far; contact the family the same day if that changes.",
    });
    const clean = { overview: "Mia does best with a warning.", keyStrengths: ["Curious"] };
    expect(scrubHandoffBrief(clean)).toBe(0);
    expect(clean).toEqual({ overview: "Mia does best with a warning.", keyStrengths: ["Curious"] });
  });
});
