import * as SQLite from "expo-sqlite";
import { Repository } from "./repository";
export async function openRepository(): Promise<Repository> {
  const db = await SQLite.openDatabaseAsync("islerim.db");
  await db.execAsync(
    "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);",
  );
  return new Repository({
    read: async () =>
      (
        await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM app_state WHERE id=1",
        )
      )?.value ?? null,
    write: async (value) => {
      await db.runAsync(
        "INSERT INTO app_state(id,value) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        value,
      );
    },
  });
}
