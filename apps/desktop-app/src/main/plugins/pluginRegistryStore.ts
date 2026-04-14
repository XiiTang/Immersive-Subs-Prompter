import { promises as fs } from "fs";
import path from "path";
import type { InstalledPluginRecord, PluginRegistryState } from "./pluginTypes.js";

function createEmptyRegistry(): PluginRegistryState {
  return { plugins: {} };
}

export class PluginRegistryStore {
  private readonly registryPath: string;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
  }

  async read(): Promise<PluginRegistryState> {
    try {
      const raw = await fs.readFile(this.registryPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.plugins) {
        return parsed as PluginRegistryState;
      }
      return createEmptyRegistry();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createEmptyRegistry();
      }
      throw error;
    }
  }

  async readPlugin(id: string): Promise<InstalledPluginRecord | null> {
    const state = await this.read();
    return state.plugins[id] ?? null;
  }

  async writePlugin(record: InstalledPluginRecord): Promise<void> {
    const state = await this.read();
    state.plugins[record.id] = record;
    await this.write(state);
  }

  async deletePlugin(id: string): Promise<void> {
    const state = await this.read();
    delete state.plugins[id];
    await this.write(state);
  }

  async listPlugins(): Promise<InstalledPluginRecord[]> {
    const state = await this.read();
    return Object.values(state.plugins);
  }

  async write(state: PluginRegistryState): Promise<void> {
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    await fs.writeFile(this.registryPath, JSON.stringify(state, null, 2), "utf-8");
  }

}
