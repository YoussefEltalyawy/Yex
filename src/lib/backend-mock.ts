/**
 * In-browser implementation of the Backend that mirrors yex-core semantics
 * (defaults, validation, inherit, cascade, hooks) using the generated schema.
 * Used for `npm run dev` in a normal browser and for automated screenshots.
 */
import type { Backend } from "./backend";
import type { EntityName, ListQuery, Mistake, Overview, ReviewGrade, Task } from "./types";
import schemaJson from "./schema.json";
import { seedDemo } from "./demo-seed";
import { addDays, toDateStr } from "./dates";

type Rec = Record<string, unknown> & { id: string; created_at: string; updated_at: string; deleted_at: string | null };
interface FieldDef { name: string; kind: string; refs?: string; options?: string[]; required: boolean; default?: string; cascade?: boolean }
interface EntityDef { name: string; title_field: string; default_order: string; search: string[]; fields: FieldDef[]; inherit?: { target: string; via: string; source: string }[] }

const schema = schemaJson as unknown as EntityDef[];
const KEY = "yex-mock-v1";
const META = ["id", "created_at", "updated_at", "deleted_at"];

interface Store { rows: Record<string, Rec[]>; settings: Record<string, unknown> }

const now = () => new Date().toISOString();
const def = (name: string) => {
  const e = schema.find((x) => x.name === name);
  if (!e) throw new Error(`unknown entity '${name}'`);
  return e;
};

function cmp(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return a < b ? -1 : 1;
}

export function createMockBackend(): Backend {
  const params = new URLSearchParams(location.search);
  let store: Store;
  const saved = !params.has("reset") && localStorage.getItem(KEY);
  if (saved) store = JSON.parse(saved);
  else {
    store = { rows: Object.fromEntries(schema.map((e) => [e.name, []])), settings: {} };
  }
  let saveTimer = 0;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => localStorage.setItem(KEY, JSON.stringify(store)), 150);
  };
  const table = (e: string) => (store.rows[e] ??= []);
  const live = (e: string, id: unknown) => table(e).find((r) => r.id === id && !r.deleted_at);

  function list(entity: string, q: ListQuery = {}): Rec[] {
    const e = def(entity);
    let rows = table(entity).filter((r) => q.include_deleted || !r.deleted_at);
    for (const [k, v] of Object.entries(q.filter ?? {})) {
      if (!META.includes(k) && !e.fields.some((f) => f.name === k)) throw new Error(`unknown field '${k}' on ${entity}`);
      if (v === null) rows = rows.filter((r) => r[k] === null || r[k] === undefined);
      else if (typeof v === "object" && !Array.isArray(v)) {
        for (const [op, val] of Object.entries(v as Record<string, unknown>)) {
          rows = rows.filter((r) => {
            const x = r[k];
            switch (op) {
              case "eq": return x === val;
              case "ne": return x !== val;
              case "lt": return x !== null && x !== undefined && cmp(x, val) < 0;
              case "lte": return x !== null && x !== undefined && cmp(x, val) <= 0;
              case "gt": return x !== null && x !== undefined && cmp(x, val) > 0;
              case "gte": return x !== null && x !== undefined && cmp(x, val) >= 0;
              case "in": return (val as unknown[]).includes(x);
              case "like": return String(x ?? "").toLowerCase().includes(String(val).replace(/%/g, "").toLowerCase());
              case "is_null": return (x === null || x === undefined) === (val ?? true);
              default: throw new Error(`unknown filter operator '${op}'`);
            }
          });
        }
      } else rows = rows.filter((r) => r[k] === v);
    }
    const s = q.search?.trim().toLowerCase();
    if (s) rows = rows.filter((r) => e.search.some((f) => String(r[f] ?? "").toLowerCase().includes(s)));
    const order = (q.order_by ?? e.default_order).split(",").map((p) => p.trim()).filter(Boolean);
    rows = [...rows].sort((a, b) => {
      for (const p of order) {
        const desc = p.startsWith("-");
        const f = desc ? p.slice(1) : p;
        const c = cmp(a[f], b[f]);
        if (c) return desc ? -c : c;
      }
      return 0;
    });
    const off = q.offset ?? 0;
    return rows.slice(off, q.limit && q.limit > 0 ? off + q.limit : undefined).map((r) => ({ ...r }));
  }

  function validate(e: EntityDef, data: Record<string, unknown>) {
    for (const [k, v] of Object.entries(data)) {
      if (META.includes(k)) continue;
      const f = e.fields.find((x) => x.name === k);
      if (!f) throw new Error(`unknown field '${k}' on ${e.name}`);
      if (v === null || v === undefined) {
        if (f.required) throw new Error(`field '${k}' is required`);
        continue;
      }
      if (f.options?.length && !f.options.includes(v as string)) throw new Error(`field '${k}' must be one of: ${f.options.join(", ")}`);
      if (f.refs && !live(f.refs, v)) throw new Error(`field '${k}' references missing ${f.refs} '${v}'`);
    }
  }

  function inherit(e: EntityDef, data: Record<string, unknown>, explicit: string[]) {
    for (const i of e.inherit ?? []) {
      if (!(i.via in data)) continue;
      if (explicit.includes(i.target) && data[i.target] != null) continue;
      const viaEntity = e.fields.find((f) => f.name === i.via)?.refs;
      const parent = viaEntity && data[i.via] ? live(viaEntity, data[i.via]) : undefined;
      if (parent) data[i.target] = parent[i.source] ?? null;
    }
  }

  function beforeWrite(entity: string, data: Record<string, unknown>, before?: Rec) {
    if (entity === "task" && typeof data.done === "boolean") {
      if (data.done && !before?.done && !("done_at" in data)) data.done_at = now();
      else if (!data.done) data.done_at = null;
    }
    if (entity === "lesson" && "notes" in data && !("notes_updated_at" in data)) data.notes_updated_at = now();
    if (entity === "exam" && data.score != null && !("status" in data) && (!before || before.status === "upcoming")) data.status = "done";
    if (entity === "mistake" && !before && !("next_review_at" in data)) data.next_review_at = toDateStr(addDays(new Date(), 1));
  }

  function create(entity: string, input: Record<string, unknown>, silent = false): Rec {
    const e = def(entity);
    const data: Record<string, unknown> = { ...input };
    for (const m of META) if (m !== "id") delete data[m];
    const explicit = Object.keys(data);
    inherit(e, data, explicit);
    beforeWrite(entity, data);
    for (const f of e.fields) {
      if (data[f.name] === undefined || (data[f.name] === null && f.default)) data[f.name] = f.default ? JSON.parse(f.default) : null;
      if (f.required && data[f.name] == null) throw new Error(`field '${f.name}' is required to create a ${entity}`);
    }
    validate(e, data);
    const t = now();
    const row = { ...data, id: (data.id as string) || crypto.randomUUID(), created_at: t, updated_at: t, deleted_at: null } as Rec;
    table(entity).push(row);
    if (!silent) persist();
    return { ...row };
  }

  function update(entity: string, id: string, input: Record<string, unknown>): Rec {
    const e = def(entity);
    const row = live(entity, id);
    if (!row) throw new Error(`${entity} '${id}' not found`);
    const before = { ...row };
    const patch: Record<string, unknown> = { ...input };
    for (const m of META) delete patch[m];
    inherit(e, patch, Object.keys(patch));
    beforeWrite(entity, patch, before);
    validate(e, patch);
    Object.assign(row, patch, { updated_at: now() });
    if (entity === "task" && row.done && !before.done && row.repeat !== "none") {
      const base = row.due_date ? new Date(`${row.due_date}T00:00`) : new Date();
      const step = row.repeat === "weekly" ? 7 : 1;
      let next = addDays(base, step);
      while (row.repeat === "weekdays" && next.getDay() === 5) next = addDays(next, 1);
      while (toDateStr(next) < toDateStr(new Date())) next = addDays(next, step);
      const { title, notes, priority, estimate_min, repeat, subject_id, lesson_id, position } = row as unknown as Task;
      create("task", { title, notes, priority, estimate_min, repeat, subject_id, lesson_id, position, due_date: toDateStr(next) });
    }
    persist();
    return { ...row };
  }

  function setDeleted(entity: string, id: string, ts: string | null, match: string | null) {
    const row = table(entity).find((r) => r.id === id && (match ? r.deleted_at === match : !r.deleted_at));
    if (!row) return false;
    row.deleted_at = ts;
    row.updated_at = now();
    for (const child of schema)
      for (const f of child.fields.filter((f) => f.cascade && f.refs === entity))
        for (const c of table(child.name).filter((r) => r[f.name] === id && (match ? r.deleted_at === match : !r.deleted_at)))
          setDeleted(child.name, c.id, ts, match);
    return true;
  }

  const wrap = <T,>(fn: () => T): Promise<T> => {
    try {
      return Promise.resolve(structuredClone(fn()));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err.message : String(err));
    }
  };

  if (!saved) {
    seedDemo({ create: (e, d) => create(e, d, true), settings: store.settings });
    persist();
  }

  return {
    kind: "mock",
    list: (entity, q) => wrap(() => list(entity, q)) as never,
    get: (entity, id) =>
      wrap(() => {
        const r = live(entity, id);
        if (!r) throw new Error(`${entity} '${id}' not found`);
        return r;
      }) as never,
    create: (entity, data) => wrap(() => create(entity, data as Record<string, unknown>)) as never,
    update: (entity, id, patch) => wrap(() => update(entity, id, patch as Record<string, unknown>)) as never,
    remove: (entity, id) =>
      wrap(() => {
        if (!setDeleted(entity, id, now(), null)) throw new Error(`${entity} '${id}' not found`);
        persist();
      }),
    restore: (entity: EntityName, id) =>
      wrap(() => {
        const r = table(entity).find((x) => x.id === id);
        if (r?.deleted_at) setDeleted(entity, id, null, r.deleted_at);
        persist();
        return r;
      }) as never,
    reviewMistake: (id, grade: ReviewGrade) =>
      wrap(() => {
        const ladder = [1, 3, 7, 14, 30, 60];
        const m = live("mistake", id) as unknown as Mistake;
        if (!m) throw new Error(`mistake '${id}' not found`);
        const c = m.review_count ?? 0;
        const stage = (n: number) => ladder[Math.min(Math.max(n, 0), ladder.length - 1)];
        const [count, days] =
          grade === "again" ? [0, 1] : grade === "hard" ? [c, Math.min(stage(c), 3)] : grade === "good" ? [c + 1, stage(c)] : [c + 2, stage(c + 1)];
        return update("mistake", id, {
          review_count: count,
          last_reviewed_at: now(),
          next_review_at: toDateStr(addDays(new Date(), days)),
          status: count >= 4 && grade !== "again" ? "mastered" : "reviewing",
        });
      }) as never,
    overview: () =>
      wrap((): Overview => {
        const today = toDateStr(new Date());
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const weekStart = addDays(start, -6).toISOString();
        const sessions = list("focus_session", { filter: { kind: "focus", started_at: { gte: weekStart } } });
        const sum = (xs: Rec[]) => Math.floor(xs.reduce((a, s) => a + (s.duration_sec as number), 0) / 60);
        return {
          today,
          tasks_today: list("task", { filter: { due_date: today } }) as never,
          overdue_tasks: list("task", { filter: { done: false, due_date: { lt: today } }, order_by: "due_date" }) as never,
          upcoming_exams: list("exam", { filter: { status: "upcoming", date: { gte: today, lte: toDateStr(addDays(new Date(), 21)) } } }) as never,
          mistakes_due_for_review: list("mistake", { filter: { status: { ne: "mastered" }, next_review_at: { lte: today } }, order_by: "next_review_at", limit: 50 }) as never,
          focus_minutes_today: sum(sessions.filter((s) => (s.started_at as string) >= start.toISOString())),
          focus_minutes_last_7_days: sum(sessions),
        };
      }),
    settings: () => wrap(() => store.settings),
    setSetting: (key, value) =>
      wrap(() => {
        store.settings[key] = value;
        persist();
      }),
    saveAttachment: (bytes, ext) =>
      new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(new Blob([bytes as BlobPart], { type: ext === "svg" ? "image/svg+xml" : `image/${ext}` }));
      }),
    fileUrl: (rel) => rel,
    appInfo: async () => ({ version: "0.1.0-web", data_dir: "(browser storage)", db_path: "(browser storage)", mcp_path: null, mcp_expected_path: "C:\\Program Files\\YEX\\yex-mcp.exe" }),
    onExternalChange: () => () => {},
  };
}
