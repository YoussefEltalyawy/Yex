import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Backend } from "./backend";
import type { AppInfo } from "./types";

export async function createTauriBackend(): Promise<Backend> {
  const { data_dir: dataDir } = await invoke<AppInfo>("app_info");
  return {
    kind: "tauri",
    list: (entity, query) => invoke("db_list", { entity, query: query ?? null }),
    get: (entity, id) => invoke("db_get", { entity, id }),
    create: (entity, data) => invoke("db_create", { entity, data }),
    update: (entity, id, patch) => invoke("db_update", { entity, id, patch }),
    remove: (entity, id) => invoke("db_delete", { entity, id }),
    restore: (entity, id) => invoke("db_restore", { entity, id }),
    reviewMistake: (id, grade) => invoke("mistake_review", { id, grade }),
    overview: () => invoke("get_overview"),
    settings: () => invoke("settings_all"),
    setSetting: (key, value) => invoke("setting_set", { key, value }),
    saveAttachment: (bytes, ext) => invoke("save_attachment", bytes, { headers: { "x-ext": ext } }),
    fileUrl: (rel) => (/^(https?:|data:|blob:)/.test(rel) ? rel : convertFileSrc(`${dataDir}\\${rel.replace(/\//g, "\\")}`)),
    appInfo: () => invoke("app_info"),
    onExternalChange(cb) {
      const un = listen("db-changed", cb);
      return () => void un.then((f) => f());
    },
  };
}
