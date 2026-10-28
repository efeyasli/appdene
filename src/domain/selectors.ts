import { Task, dayKey, addDays } from "./model";
export type Tab = "Bugün" | "Yaklaşan" | "Sonra";
export function futureDate(t: Task, today: string): string | undefined {
  return [t.dueDate, t.plannedDate]
    .filter((d): d is string => !!d && d > today)
    .sort()[0];
}
export function inTab(t: Task, tab: Tab, now: Date): boolean {
  if (t.completedAt) return false;
  const today = dayKey(now);
  if (tab === "Bugün")
    return !!(
      (t.dueDate && t.dueDate <= today) ||
      (t.plannedDate && t.plannedDate <= today)
    );
  if (tab === "Yaklaşan") return !!futureDate(t, today);
  return !t.dueDate && !t.plannedDate;
}
export function list(tasks: Task[], tab: Tab, now: Date): Task[] {
  return tasks
    .filter((t) => inTab(t, tab, now))
    .sort(
      (a, b) =>
        (tab === "Yaklaşan"
          ? futureDate(a, dayKey(now)) || ""
          : a.dueDate || a.plannedDate || "9999"
        ).localeCompare(
          tab === "Yaklaşan"
            ? futureDate(b, dayKey(now)) || ""
            : b.dueDate || b.plannedDate || "9999",
        ) ||
        Number(b.important) - Number(a.important) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}
export function attention(tasks: Task[], now: Date): Task | undefined {
  const today = dayKey(now),
    near = dayKey(addDays(now, 3));
  const rank = (t: Task) =>
    t.dueDate && t.dueDate < today
      ? 0
      : t.dueDate && t.dueDate <= near
        ? 1
        : t.important
          ? 2
          : 3;
  return tasks
    .filter(
      (t) =>
        !t.completedAt &&
        (!t.snoozedUntil || new Date(t.snoozedUntil) <= now) &&
        rank(t) < 3,
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        a.updatedAt.localeCompare(b.updatedAt),
    )[0];
}
export function status(t: Task, now: Date): string {
  const today = dayKey(now);
  if (t.dueDate && t.dueDate < today) return "Gecikmiş";
  if (t.plannedDate && t.plannedDate < today) return "Önceki günden kaldı";
  return "";
}
