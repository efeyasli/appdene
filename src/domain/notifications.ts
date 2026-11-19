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
const signature = (n: Notice) => `${n.at}|${n.title}|${n.body}`;
// What this app scheduled per driver, so unchanged notifications are not
// cancelled and rescheduled on every edit. Empty after a restart, which makes
// the first reconcile rebuild the whole queue (the safe default).
const scheduled = new WeakMap<NotificationDriver, Map<string, string>>();
export async function reconcile(
  driver: NotificationDriver,
  state: State,
  now: Date,
): Promise<{ overflow: number; denied: boolean }> {
  const { notices, overflow } = notificationPlan(state, now);
  const cache = scheduled.get(driver) ?? new Map<string, string>();
  scheduled.set(driver, cache);
  // Reconcile the complete app-owned queue, including orphan IDs after interrupted writes.
  const owned = (await driver.pending()).filter(
    (id) => id.startsWith("task:") || id.startsWith("summary:"),
  );
  const enabled = state.settings.notifications;
  const denied = enabled && !(await driver.allowed());
  const wanted = new Map(
    enabled && !denied ? notices.map((n) => [n.id, signature(n)]) : [],
  );
  const live = new Set<string>();
  for (const id of owned) {
    if (wanted.has(id) && wanted.get(id) === cache.get(id)) live.add(id);
    else {
      await driver.cancel(id);
      cache.delete(id);
    }
  }
  for (const id of [...cache.keys()]) if (!live.has(id)) cache.delete(id);
  for (const notice of notices) {
    if (!wanted.has(notice.id) || live.has(notice.id)) continue;
    await driver.schedule(notice);
    cache.set(notice.id, signature(notice));
  }
  return { overflow: enabled ? overflow : 0, denied };
}
