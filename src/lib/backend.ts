import type { AppInfo, EntityMap, EntityName, Id, ListQuery, Overview, ReviewGrade } from "./types";

/** Everything the UI needs from storage. Implemented by Tauri (real) and an in-browser mock (dev/tests). */
export interface Backend {
  kind: "tauri" | "mock";
  list<E extends EntityName>(entity: E, query?: ListQuery): Promise<EntityMap[E][]>;
  get<E extends EntityName>(entity: E, id: Id): Promise<EntityMap[E]>;
  create<E extends EntityName>(entity: E, data: Partial<EntityMap[E]>): Promise<EntityMap[E]>;
  update<E extends EntityName>(entity: E, id: Id, patch: Partial<EntityMap[E]>): Promise<EntityMap[E]>;
  remove(entity: EntityName, id: Id): Promise<void>;
  restore<E extends EntityName>(entity: E, id: Id): Promise<EntityMap[E]>;
  reviewMistake(id: Id, grade: ReviewGrade): Promise<EntityMap["mistake"]>;
  overview(): Promise<Overview>;
  settings(): Promise<Record<string, unknown>>;
  setSetting(key: string, value: unknown): Promise<void>;
  saveAttachment(bytes: Uint8Array, ext: string): Promise<string>;
  /** Turns a stored relative path (attachments/x.png) into a displayable URL. */
  fileUrl(rel: string): string;
  appInfo(): Promise<AppInfo>;
  /** Fires when data changed outside this window (e.g. an AI agent via MCP). */
  onExternalChange(cb: () => void): () => void;
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let instance: Backend | null = null;

export async function initBackend(): Promise<Backend> {
  if (instance) return instance;
  instance = isTauri ? await (await import("./backend-tauri")).createTauriBackend() : (await import("./backend-mock")).createMockBackend();
  return instance;
}

export function backend(): Backend {
  if (!instance) throw new Error("backend not initialised");
  return instance;
}
