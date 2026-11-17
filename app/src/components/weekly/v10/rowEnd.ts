/**
 * The end of Weekly report's pill row (N-Week-D: "Today is Monday 16. Tuesday
 * to Friday are still ahead."): today by weekday and day number, and the days
 * of the shown week still ahead. Only for the current week; a past week (or a
 * week without today) gives "" and the shell keeps its own day and time.
 */
export function weekRowEndText(dayStarts: readonly number[], todayIdx: number, lang: "en" | "he"): string {
  if (todayIdx < 0 || todayIdx > 6 || dayStarts.length !== 7) return "";
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const name = (ms: number) => new Date(ms).toLocaleDateString(locale, { weekday: "long" });
  const today = new Date(dayStarts[todayIdx]);
  const ahead = dayStarts.slice(todayIdx + 1);
  if (lang === "he") {
    const first = `היום ${name(today.getTime())}, ${today.getDate()}.`;
    if (ahead.length === 0) return `${first} זה היום האחרון של השבוע.`;
    if (ahead.length === 1) return `${first} ${name(ahead[0])} עוד לפנינו.`;
    return `${first} ${name(ahead[0])} עד ${name(ahead[ahead.length - 1])} עוד לפנינו.`;
  }
  const first = `Today is ${name(today.getTime())} ${today.getDate()}.`;
  if (ahead.length === 0) return `${first} It’s the last day of the week.`;
  if (ahead.length === 1) return `${first} ${name(ahead[0])} is still ahead.`;
  return `${first} ${name(ahead[0])} to ${name(ahead[ahead.length - 1])} are still ahead.`;
}
