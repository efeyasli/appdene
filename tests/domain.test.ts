import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTurkish as parse } from "../src/domain/parse";
import {
  addDays,
  createTask,
  dayKey,
  defaultReminder,
  emptyState,
  localDate,
  Task,
} from "../src/domain/model";
import { attention, inTab, list } from "../src/domain/selectors";
import {
  notificationPlan,
  reconcile,
  Notice,
  NotificationDriver,
} from "../src/domain/notifications";
import { Repository } from "../src/data/repository";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const now = localDate("2026-10-27", "12:00"),
  settings = emptyState().settings;
const task = (text: string): Task =>
  createTask(text, parse(text, now), settings, now);
test("Turkish characters, weekday includes today, next calendar week starts Monday", () => {
  assert.equal(parse("Cuma ACCT quiz var", now).dueDate, "2026-10-30");
  assert.equal(parse("cuma", localDate("2026-10-30")).dueDate, "2026-10-30");
  assert.equal(parse("haftaya cuma", now).dueDate, "2026-11-06");
  assert.equal(
    parse("gelecek hafta pazartesi", localDate("2026-11-01")).dueDate,
    "2026-11-02",
  );
  assert.equal(parse("carsamba", now).dueDate, "2026-10-28");
  assert.equal(parse("Yarın 14:00’te mail at", now).dueTime, "14:00");
  assert.equal(parse("yarin", now).dueDate, "2026-10-28");
  assert.equal(parse("öbür gün", now).dueDate, "2026-10-29");
});
test("month/year boundaries, explicit years and invalid dates", () => {
  assert.equal(parse("yarın", localDate("2026-12-31")).dueDate, "2027-01-01");
  assert.equal(
    parse("öbür gün", localDate("2026-01-30")).dueDate,
    "2026-02-01",
  );
  assert.equal(parse("2 Kasım teslim", now).dueDate, "2026-11-02");
  assert.equal(parse("2 Ocak", now).dueDate, "2027-01-02");
  assert.equal(parse("02.11.2026", now).dueDate, "2026-11-02");
  assert.equal(parse("2 Ocak 2025", now).dueDate, "2025-01-02");
  for (const text of [
    "31 Nisan",
    "31/02/2026",
    "29 Şubat 2027",
    "32.12.2026",
  ]) {
    assert.equal(parse(text, now).dueDate, undefined);
    assert.ok(parse(text, now).warning);
  }
  assert.equal(parse("29 Şubat 2028", now).dueDate, "2028-02-29");
});
test("no artificial due times; ambiguous phrases and invalid/past hours are visible", () => {
  assert.equal(
    parse("Pazar akşamına kadar 3 startup bul", now).dueTime,
    undefined,
  );
  assert.equal(parse("bu hafta bak", now).dueDate, undefined);
  assert.ok(parse("bugün 09:00", now).warning);
  assert.ok(parse("yarın 25:90", now).warning);
  assert.equal(parse("yarın 25:90", now).dueTime, undefined);
  assert.equal(
    defaultReminder("2026-10-30", undefined, settings, now),
    localDate("2026-10-29", "18:00").toISOString(),
  );
  assert.equal(
    defaultReminder("2026-10-28", "14:00", settings, now),
    localDate("2026-10-28", "13:00").toISOString(),
  );
  assert.equal(
    defaultReminder("2026-10-27", undefined, settings, now),
    undefined,
  );
  assert.equal(defaultReminder(undefined, undefined, settings, now), undefined);
  assert.throws(() => task("  "));
});
test("planned day and deadline stay independent; no unfinished task disappears", () => {
  const t = { ...task("cuma quiz"), plannedDate: dayKey(now) };
  assert.ok(inTab(t, "Bugün", now));
  assert.ok(inTab(t, "Yaklaşan", now));
  assert.equal(t.dueDate, "2026-10-30");
  const overdue = { ...task("mail"), dueDate: "2026-10-26" };
  const leftover = { ...task("araştır"), plannedDate: "2026-10-26" };
  const later = task("programlara bak");
  const all = [
    t,
    overdue,
    leftover,
    later,
    { ...task("haftaya cuma"), plannedDate: "2026-10-29" },
  ];
  for (const x of all)
    assert.ok(
      ["Bugün", "Yaklaşan", "Sonra"].some((tab) => inTab(x, tab as any, now)),
    );
  assert.equal(list(all, "Sonra", now)[0].id, later.id);
  assert.ok(!inTab({ ...t, completedAt: now.toISOString() }, "Bugün", now));
  assert.equal(
    list([task("haftaya cuma"), task("yarın")], "Yaklaşan", now)[0].dueDate,
    "2026-10-28",
  );
});
test("explainable priority and snooze suppression", () => {
  const overdue = { ...task("dün"), dueDate: "2026-10-26" };
  const near = task("yarın quiz"),
    important = { ...task("araştır"), important: true };
  assert.equal(attention([important, near, overdue], now)?.id, overdue.id);
  assert.equal(
    attention(
      [{ ...overdue, completedAt: now.toISOString() }, near, important],
      now,
    )?.id,
    near.id,
  );
  assert.equal(
    attention(
      [{ ...near, snoozedUntil: addDays(now, 1).toISOString() }, important],
      now,
    )?.id,
    important.id,
  );
  assert.equal(attention([task("program bak")], now), undefined);
});
test("persistent CRUD survives closing and reopening SQLite; failed writes reject", async () => {
  const dir = await mkdtemp(join(tmpdir(), "islerim-"));
  const path = join(dir, "state.db");
  const open = () => {
    const db = new DatabaseSync(path);
    db.exec("CREATE TABLE IF NOT EXISTS state(value TEXT)");
    return {
      db,
      repo: new Repository({
        read: async () =>
          (
            db.prepare("SELECT value FROM state").get() as
              { value: string } | undefined
          )?.value ?? null,
        write: async (value) => {
          db.prepare("DELETE FROM state").run();
          db.prepare("INSERT INTO state VALUES (?)").run(value);
        },
      }),
    };
  };
  try {
    let { db, repo } = open();
    let state = await repo.load();
    const t = task("cuma quiz");
    state.tasks = [t];
    await repo.save(state);
    db.close();
    ({ db, repo } = open());
    state = await repo.load();
    assert.equal(state.tasks[0].title, "cuma quiz");
    assert.equal(state.tasks[0].originalText, "cuma quiz");
    state.tasks[0] = {
      ...state.tasks[0],
      title: "Yeni başlık",
      plannedDate: "2026-10-27",
      completedAt: now.toISOString(),
    };
    await repo.save(state);
    db.close();
    ({ db, repo } = open());
    assert.equal((await repo.load()).tasks[0].dueDate, "2026-10-30");
    assert.ok((await repo.load()).tasks[0].completedAt);
    state.tasks = [];
    await repo.save(state);
    assert.equal((await repo.load()).tasks.length, 0);
    db.close();
    const fail = new Repository({
      read: async () => null,
      write: async () => {
        throw new Error("disk full");
      },
    });
    await assert.rejects(fail.save(state));
    const future = new Repository({
      read: async () => '{"version":2,"tasks":[]}',
      write: async () => {},
    });
    await assert.rejects(future.load());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("notification creation, reschedule, completion, deletion, undo, denied permission and duplicate prevention", async () => {
  const pending = new Map<string, Notice>();
  let permission = true;
  const d: NotificationDriver = {
    allowed: async () => permission,
    pending: async () => [...pending.keys()],
    cancel: async (id) => {
      pending.delete(id);
    },
    schedule: async (n) => {
      pending.set(n.id, n);
    },
  };
  const state = emptyState();
  state.settings.notifications = true;
  const t = task("cuma quiz");
  state.tasks = [t];
  await reconcile(d, state, now);
  await reconcile(d, state, now);
  assert.equal(pending.size, 1);
  const at = localDate("2026-10-28", "09:00").toISOString();
  state.tasks = [{ ...t, reminderAt: at, snoozedUntil: at }];
  await reconcile(d, state, now);
  assert.equal([...pending.values()][0].at, at);
  assert.equal(state.tasks[0].dueDate, "2026-10-30");
  state.tasks = [{ ...t, completedAt: now.toISOString() }];
  await reconcile(d, state, now);
  assert.equal(pending.size, 0);
  state.tasks = [t];
  await reconcile(d, state, now);
  assert.equal(pending.size, 1);
  state.tasks = [];
  await reconcile(d, state, now);
  assert.equal(pending.size, 0);
  state.tasks = [t];
  permission = false;
  assert.equal((await reconcile(d, state, now)).denied, true);
  assert.equal(pending.size, 0);
  assert.equal(state.tasks.length, 1);
  permission = true;
  state.settings.notifications = false;
  await reconcile(d, state, now);
  assert.equal(pending.size, 0);
});
test("summary omits empty days, uses a finite horizon, capacity and future-only scheduling", () => {
  const state = emptyState();
  state.settings.notifications = true;
  state.settings.summary = true;
  assert.equal(notificationPlan(state, now).notices.length, 0);
  state.tasks = [{ ...task("bak"), important: true }];
  const p = notificationPlan(state, now);
  assert.equal(p.notices.length, 6);
  assert.ok(p.notices.every((n) => new Date(n.at) > now));
  state.tasks = Array.from({ length: 70 }, (_, i) => ({
    ...task("cuma"),
    id: String(i),
  }));
  const capacity = notificationPlan(state, now);
  assert.equal(capacity.notices.length, 50);
  assert.ok(capacity.overflow > 0);
});
