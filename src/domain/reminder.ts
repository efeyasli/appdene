import { addDays, dayKey, localDate } from "./model";
export const reminderDays = [0, 1, 2, 3, 7] as const;
export function reminderFromOffset(
  dueDate: string,
  days: number,
  time: string,
): string {
  return localDate(
    dayKey(addDays(localDate(dueDate), -days)),
    time,
  ).toISOString();
}
export function calendarDays(month: string): string[] {
  const first = localDate(month.slice(0, 7) + "-01");
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => dayKey(addDays(start, i)));
}
