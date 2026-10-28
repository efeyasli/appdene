export type Task = {
  id: string;
  title: string;
  originalText: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  important: boolean;
  dueDate?: string;
  dueTime?: string;
  timeZone: string;
  plannedDate?: string;
  reminderAt?: string;
  snoozedUntil?: string;
  notificationIds: string[];
};
export type Settings = {
  notifications: boolean;
  summary: boolean;
  summaryTime: string;
  previousDayTime: string;
  hoursBefore: number;
  daysBefore?: number;
  reduceMotion?: boolean;
};
export type State = { version: 1; tasks: Task[]; settings: Settings };
export const emptyState = (): State => ({
  version: 1,
  tasks: [],
  settings: {
    notifications: false,
    summary: false,
    summaryTime: "09:00",
    previousDayTime: "18:00",
    hoursBefore: 1,
  },
});
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function localDate(day: string, time = "00:00"): Date {
  return new Date(`${day}T${time}:00`);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function dateLabel(day?: string): string {
  return day
    ? localDate(day).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "short",
      })
    : "Tarih yok";
}
export function defaultReminder(
  day: string | undefined,
  time: string | undefined,
  settings: Settings,
  now: Date,
): string | undefined {
  if (!day) return;
  const d = time
    ? new Date(localDate(day, time).getTime() - settings.hoursBefore * 3600000)
    : localDate(
        dayKey(addDays(localDate(day), -(settings.daysBefore ?? 1))),
        settings.previousDayTime,
      );
  return d > now ? d.toISOString() : undefined;
}
export function createTask(
  text: string,
  parsed: { dueDate?: string; dueTime?: string },
  settings: Settings,
  now = new Date(),
): Task {
  if (!text.trim()) throw new Error("Boş görev kaydedilemez.");
  const id = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return {
    id,
    title: text.trim(),
    originalText: text.trim(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    important: false,
    ...parsed,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminderAt: defaultReminder(parsed.dueDate, parsed.dueTime, settings, now),
    notificationIds: [],
  };
}
