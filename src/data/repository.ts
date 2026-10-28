import { State, emptyState } from "../domain/model";
export interface Storage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
export class Repository {
  constructor(private storage: Storage) {}
  async load(): Promise<State> {
    const raw = await this.storage.read();
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.tasks) || !data.settings)
      throw new Error("Veri sürümü desteklenmiyor. Veriler silinmedi.");
    return data;
  }
  async save(state: State): Promise<void> {
    await this.storage.write(JSON.stringify(state));
  }
}
