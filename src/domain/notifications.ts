import { State, addDays, dayKey, localDate } from "./model";
export type Notice = {
  id: string;
  at: string;
  title: string;
  body: string;
  taskId?: string;
};
export function notificationPlan(
  state: State,
  now: Date,
): { notices: Notice[]; overflow: number } {
  if (!state.settings.notifications) return { notices: [], overflow: 0 };
  const notices: Notice[] = state.tasks
    .filter(
      (t) => !t.completedAt && t.reminderAt && new Date(t.reminderAt) > now,
    )
    .map((t) => ({
      id: `task:${t.id}`,
      at: t.reminderAt!,
      title: "İşlerim",
      body: t.title,
      taskId: t.id,
    }));
  if (state.settings.summary) {
    for (let n = 0; n < 7; n++) {
      const day = dayKey(addDays(now, n)),
        at = localDate(day, state.settings.summaryTime);
      if (at <= now) continue;
      const active = state.tasks.filter((t) => !t.completedAt);
      const todays = active.filter(
        (t) =>
          (t.dueDate && t.dueDate <= day) ||
          (t.plannedDate && t.plannedDate <= day),
      );
      const near = active.filter(
        (t) =>
          t.dueDate && t.dueDate > day && t.dueDate <= dayKey(addDays(at, 3)),
      );
      const important = active.filter(
        (t) =>
          t.important &&
          !todays.includes(t) &&
          !near.includes(t) &&
          (!t.snoozedUntil || new Date(t.snoozedUntil) <= at),
      );
      if (!todays.length && !near.length && !important.length) continue;
      notices.push({
        id: `summary:${day}`,
        at: at.toISOString(),
        title: "Günün işleri",
        body: `${todays.length} bugün · ${near.length} yaklaşan · ${important.length} önemli. ${[
          ...todays,
          ...near,
          ...important,
        ]
          .slice(0, 2)
          .map((t) => t.title)
          .join(" · ")}`,
      });
    }
  }
  notices.sort((a, b) => a.at.localeCompare(b.at));
  return {
    notices: notices.slice(0, 50),
    overflow: Math.max(0, notices.length - 50),
  };
}
export interface NotificationDriver {
  allowed(): Promise<boolean>;
  pending(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  schedule(n: Notice): Promise<void>;
}
export async function reconcile(
  driver: NotificationDriver,
  state: State,
  now: Date,
): Promise<{ overflow: number; denied: boolean }> {
  const { notices, overflow } = notificationPlan(state, now);
  // Reconcile the complete app-owned queue, including orphan IDs after interrupted writes.
  const ids = await driver.pending();
  for (const id of ids.filter(
    (id) => id.startsWith("task:") || id.startsWith("summary:"),
  ))
    await driver.cancel(id);
  if (!state.settings.notifications) return { overflow: 0, denied: false };
  if (!(await driver.allowed())) return { overflow, denied: true };
  for (const notice of notices) await driver.schedule(notice);
  return { overflow, denied: false };
}
