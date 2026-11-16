/**
 * MODEL_PROVIDER=mock: a deterministic reading of a school message for the
 * family_plan_extract prompt, so the sandbox (and the rendered sweep) can
 * review real items from whatever message is pasted, with zero model calls.
 *
 * It is a plain pattern reader, not a model: a line with a day (a weekday, a
 * "19 November", a 19/11, tomorrow; EN and HE) becomes a dated item, a line
 * asking a parent to come becomes a join, a line with a "bring"/"return" ask
 * and no day becomes a note. Titles are the line's own words, shortened.
 * Never used in production (config/env.ts refuses the mock provider there).
 */

const EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const EN_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function nextWeekday(today: Date, weekday: number): Date {
  const d = new Date(today);
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** The day a line names, relative to today, or "" when it names none. */
export function mockDayOf(line: string, today: Date): string {
  const lower = line.toLowerCase();
  const year = today.getFullYear();
  const withYear = (m: number, d: number) => {
    let dt = new Date(year, m, d);
    if (dt.getTime() < today.getTime() - 60 * 86400000) dt = new Date(year + 1, m, d);
    return dt.getMonth() === m && dt.getDate() === d ? key(dt) : "";
  };
  const enMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${EN_MONTHS.join("|")})\\b|\\b(${EN_MONTHS.join("|")})\\s+(\\d{1,2})\\b`).exec(lower);
  if (enMonth) {
    const m = EN_MONTHS.indexOf(enMonth[2] ?? enMonth[3]);
    const d = Number(enMonth[1] ?? enMonth[4]);
    return withYear(m, d);
  }
  const heMonth = new RegExp(`(\\d{1,2})\\s*(?:ב|ל)?(${HE_MONTHS.join("|")})`).exec(line);
  if (heMonth) return withYear(HE_MONTHS.indexOf(heMonth[2]), Number(heMonth[1]));
  const slash = /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/.exec(lower);
  if (slash && !/\d:\d/.test(slash[0])) return withYear(Number(slash[2]) - 1, Number(slash[1]));
  if (/\btomorrow\b|מחר/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return key(d);
  }
  const en = EN_DAYS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(lower));
  if (en >= 0) return key(nextWeekday(today, en));
  const he = HE_DAYS.findIndex((w) => new RegExp(`(?:^|\\s|ב|יום\\s)${w}(?:\\s|$|[.,])`).test(line));
  if (he >= 0) return key(nextWeekday(today, he));
  return "";
}

export function mockTimeOf(line: string): string {
  const m = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/.exec(line);
  return m ? `${pad(Number(m[1]))}:${m[2]}` : "";
}

const JOIN = /\b(join|help|accompany|volunteer|one parent|a parent)\b|הורה|להצטרף|ללוות|מתנדב/i;
const DEADLINE = /\b(by|return|due|until|sign|send back|deadline)\b|עד|להחזיר|לחתום|להגיש/i;
const ASK = /\b(bring|please|remember|wear|pack)\b|להביא|נא|לזכור|ללבוש|יש להגיע/i;

function titleOf(line: string): string {
  // The line up to where its day or time starts ("…garden is on Thursday at 10:00" → "…garden").
  const cut = line.split(/\s+(?:is|are|will be)?\s*(?:on|at|by|until)\s+|\s+(?:ב?יום|בשעה|עד)\s+/i)[0] || line;
  const words = cut.replace(/^(?:our|the|please|update:)\s+/i, "").replace(/^ב?יום\s+\S+\s+(?:בשעה\s+\S+\s+)?(?:יש\s+)?/, "").replace(/["“”„«»]/g, "").replace(/\s+/g, " ").trim().split(" ");
  const joined = words.slice(0, 9).join(" ");
  const short = joined.charAt(0).toLocaleUpperCase() + joined.slice(1);
  return (short.length > 80 ? short.slice(0, 80) : short).replace(/[.,:;!?-]+$/, "");
}

/** The deterministic {items} answer for one family_plan_extract prompt. */
export function mockFamilyPlanItems(prompt: string): { items: Array<{ line: number; quote: string; kind: string; title: string; date: string; time: string }> } {
  const todayMatch = /Today is (\d{4})-(\d{2})-(\d{2})/.exec(prompt);
  const today = todayMatch ? new Date(Number(todayMatch[1]), Number(todayMatch[2]) - 1, Number(todayMatch[3])) : new Date();
  const block = /"""\n([\s\S]*?)\n"""/.exec(prompt)?.[1] ?? "";
  const items: Array<{ line: number; quote: string; kind: string; title: string; date: string; time: string }> = [];
  for (const raw of block.split("\n")) {
    const m = /^(\d+)\. (.*)$/.exec(raw);
    if (!m) continue;
    const line = Number(m[1]);
    const text = m[2];
    const date = mockDayOf(text, today);
    const time = date ? mockTimeOf(text) : "";
    let kind: string | null = null;
    if (date && JOIN.test(text)) kind = "join";
    else if (date && DEADLINE.test(text)) kind = "deadline";
    else if (date) kind = "event";
    else if (ASK.test(text) || DEADLINE.test(text)) kind = "note";
    if (!kind) continue;
    items.push({ line, quote: text, kind, title: titleOf(text), date, time });
    if (items.length >= 12) break;
  }
  return { items };
}
