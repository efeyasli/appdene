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
export function parseTurkish(text: string, now = new Date()): Parsed {
  const s = normalize(text);
  const result: Parsed = {};
  // Explicit dates take precedence; validate before constructing rolled calendar dates.
  const numeric = s.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\b/);
  const named = s.match(
    new RegExp(`\\b(\\d{1,2})\\s+(${months.join("|")})(?:\\s+(\\d{4}))?\\b`),
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
  } else if (/\bobur gun\b/.test(s)) result.dueDate = dayKey(addDays(now, 2));
  else if (/\byarin\b/.test(s)) result.dueDate = dayKey(addDays(now, 1));
  else if (/\bbugun\b/.test(s)) result.dueDate = dayKey(now);
  else {
    const weekday = days.findIndex((d) => new RegExp(`\\b${d}\\b`).test(s));
    if (weekday >= 0) {
      const next = /\b(haftaya|gelecek hafta)\b/.test(s);
      const delta = next
        ? 7 - ((now.getDay() + 6) % 7) + ((weekday + 6) % 7)
        : (weekday - now.getDay() + 7) % 7;
      result.dueDate = dayKey(addDays(now, delta));
    }
  }
  const time =
    s.match(/\b(\d{1,2}):(\d{2})\b/) ||
    s.match(/\bsaat\s+(\d{1,2})(?:[.](\d{2}))?\b/);
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
