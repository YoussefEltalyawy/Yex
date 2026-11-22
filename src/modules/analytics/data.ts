import { addDays, parseDate, startOfDay, toDateStr } from "@/lib/dates";
import type { FocusSession, Subject } from "@/lib/types";

export type Range = "7" | "30" | "90";
export const NONE = "_none";

export interface Day {
  date: string;
  total: number;
  count: number;
  bySubject: Record<string, number>;
}

export const emptyDay = (date: string): Day => ({ date, total: 0, count: 0, bySubject: {} });

export function bucketDays(sessions: FocusSession[]) {
  const map = new Map<string, Day>();
  for (const s of sessions) {
    const date = toDateStr(new Date(s.started_at));
    let d = map.get(date);
    if (!d) map.set(date, (d = emptyDay(date)));
    const m = s.duration_sec / 60;
    const k = s.subject_id ?? NONE;
    d.total += m;
    d.count++;
    d.bySubject[k] = (d.bySubject[k] ?? 0) + m;
  }
  return map;
}

/** The `n` local dates ending `offset` days before today, oldest first. */
export const lastDays = (n: number, offset = 0) => {
  const end = addDays(startOfDay(), -offset);
  return Array.from({ length: n }, (_, i) => toDateStr(addDays(end, i - n + 1)));
};

export function streaks(map: Map<string, Day>, window: number) {
  const active = (d: Date) => (map.get(toDateStr(d))?.total ?? 0) > 0;
  let cur = 0;
  let d = startOfDay();
  if (!active(d)) d = addDays(d, -1);
  while (active(d)) {
    cur++;
    d = addDays(d, -1);
  }
  let best = 0;
  let run = 0;
  for (const s of lastDays(window)) {
    run = (map.get(s)?.total ?? 0) > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { cur, best };
}

/** Saturday-first weekday index (0 = Sat … 6 = Fri). */
export const satIndex = (s: string) => (parseDate(s).getDay() + 1) % 7;
export const WEEKDAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

export const subjectColor = (s?: Subject) => (s ? `var(--${s.color})` : "var(--color-fg-4)");
export const subjectFg = (s?: Subject) => (s ? `var(--${s.color}-fg)` : "var(--color-fg-3)");

export const scoreTint = (p: number) => (p >= 85 ? "mint" : p >= 70 ? "butter" : p >= 55 ? "peach" : "rose");

export const percentDelta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
