import { addDays, dayKey, localDate } from "./model";
export type Parsed = { dueDate?: string; dueTime?: string; warning?: string };
const normalize = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o");
const days = [
  "pazar",
  "pazartesi",
  "sali",
  "carsamba",
  "persembe",
  "cuma",
  "cumartesi",
];
const months = [
  "ocak",
  "subat",
  "mart",
  "nisan",
  "mayis",
  "haziran",
  "temmuz",
  "agustos",
  "eylul",
  "ekim",
  "kasim",
  "aralik",
];
// Turkish case/possessive suffixes that commonly follow day and month names:
// "cumaya", "pazartesiye", "salı'ya", "kasımda", "yarından", "bugünkü".
const suffix =
  "(?:['’]?(?:ya|ye|a|e|da|de|ta|te|dan|den|tan|ten|ki|ku|nin|nun|in|un))?";
const word = (w: string) => new RegExp(`\\b${w}${suffix}\\b`);
// Longest names first so "pazartesi" is not read as "pazar" + suffix.
const dayOrder = days
  .map((name, index) => ({ name, index }))
  .sort((a, b) => b.name.length - a.name.length);
const times: RegExp[] = [
  /\b(\d{1,2}):(\d{2})(?!\d)/,
  /\bsaat\s+(\d{1,2})(?:[.:](\d{2}))?(?!\d)/,
];
export function parseTurkish(text: string, now = new Date()): Parsed {
  let s = normalize(text);
  const result: Parsed = {};
  // Read the time first and remove it, so "14.30" is never mistaken for a date.
  let time: RegExpMatchArray | null = null;
  for (const re of times) {
    time = s.match(re);
    if (time) {
      s = s.replace(time[0], " ");
      break;
    }
  }
  // Explicit dates take precedence; validate before constructing rolled calendar dates.
  let numeric = s.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?![\d./])/);
  // Without a year, "1.5" or "3/4" is a decimal or fraction, not a date: require a two-digit part.
  if (numeric && !numeric[3] && numeric[1].length < 2 && numeric[2].length < 2)
    numeric = null;
  // Without a year, an impossible dotted date that is a valid clock time ("14.30'da") is a time.
  if (
    numeric &&
    !numeric[3] &&
    !time &&
    numeric[0].includes(".") &&
    numeric[2].length === 2 &&
    Number(numeric[2]) > 12 &&
    Number(numeric[1]) <= 23 &&
    Number(numeric[2]) <= 59
  ) {
    time = numeric;
    numeric = null;
  }
  const named = s.match(
    new RegExp(
      `\\b(\\d{1,2})\\s+(${months.join("|")})${suffix}(?:\\s+(\\d{4}))?\\b`,
    ),
  );
  const match = numeric || named;
  if (match) {
    const day = Number(match[1]),
      month = numeric ? Number(match[2]) - 1 : months.indexOf(match[2]);
    let year = match[3] ? Number(match[3]) : now.getFullYear();
    let date = new Date(year, month, day);
    if (date.getMonth() !== month || date.getDate() !== day)
      return {
        warning:
          "Geçersiz tarih. Tarihsiz kaydedebilir veya tarihi düzeltebilirsin.",
      };
    if (!match[3] && dayKey(date) < dayKey(now)) {
      year++;
      date = new Date(year, month, day);
    }
    if (date.getMonth() !== month || date.getDate() !== day)
      return { warning: "Bu tarih gelecek yılda geçerli değil. Yılı belirt." };
    result.dueDate = dayKey(date);
  } else if (/\bobur gun/.test(s)) result.dueDate = dayKey(addDays(now, 2));
  else if (word("yarin").test(s)) result.dueDate = dayKey(addDays(now, 1));
  else if (word("bugun").test(s)) result.dueDate = dayKey(now);
  else {
    const weekday = dayOrder.find((d) => word(d.name).test(s))?.index ?? -1;
    if (weekday >= 0) {
      const next = /\b(haftaya|gelecek hafta)\b/.test(s);
      const delta = next
        ? 7 - ((now.getDay() + 6) % 7) + ((weekday + 6) % 7)
        : (weekday - now.getDay() + 7) % 7;
      result.dueDate = dayKey(addDays(now, delta));
    }
  }
  if (time) {
    const h = Number(time[1]),
      m = Number(time[2] || 0);
    if (h > 23 || m > 59)
      result.warning = "Geçersiz saat; düzelt veya saatsiz kaydet.";
    else {
      result.dueDate ||= dayKey(now);
      result.dueTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  if (
    result.dueDate &&
    (result.dueTime
      ? localDate(result.dueDate, result.dueTime) < now
      : result.dueDate < dayKey(now))
  )
    result.warning = "Bu tarih veya saat geçmişte. Dokunarak düzeltebilirsin.";
  if (!result.dueDate && !result.warning)
    result.warning = /\b(aksam|bu hafta|sonra|haftaya)\b/.test(s)
      ? "Kesin tarih yok · tarihsiz kaydedilecek."
      : "Tarih algılanmadı · Sonra listesine kaydedilecek.";
  return result;
}
