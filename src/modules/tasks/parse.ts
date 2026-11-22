import { addDays, toDateStr, weekStart } from "@/lib/dates";
import type { Priority, Repeat, Subject } from "@/lib/types";

export interface ParsedTask {
  title: string;
  due_date?: string | null;
  priority?: Priority;
  estimate_min?: number;
  repeat?: Repeat;
  subject_id?: string;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Quick-add syntax: "Solve limits sheet tomorrow 45m !high #math every day".
 * Tokens: today/tomorrow/tmr/weekday names/next week, 30m/1h/1.5h, !high !med !low (or !!! / !!), #subject, daily/every day/weekly.
 */
export function parseQuickTask(input: string, subjects: Subject[] = []): ParsedTask {
  let s = ` ${input} `;
  const out: ParsedTask = { title: "" };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(m[0], " ");
    }
  };
  const now = new Date();
  take(/\s(today|tod)\s/i, () => (out.due_date = toDateStr(now)));
  take(/\s(tomorrow|tmr|tmrw)\s/i, () => (out.due_date = toDateStr(addDays(now, 1))));
  take(/\snext week\s/i, () => (out.due_date = toDateStr(addDays(weekStart(now), 7))));
  take(/\s(?:on\s)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s/i, (m) => {
    const target = DAYS.indexOf(m[1].toLowerCase());
    const diff = (target - now.getDay() + 7) % 7 || 7;
    out.due_date = toDateStr(addDays(now, diff));
  });
  take(/\s(\d+(?:\.\d+)?)\s?(h|hr|hrs|hours?)\s/i, (m) => (out.estimate_min = Math.round(parseFloat(m[1]) * 60)));
  take(/\s(\d+)\s?(m|min|mins|minutes?)\s/i, (m) => (out.estimate_min = parseInt(m[1])));
  take(/\s(!high|!h|!!!)\s/i, () => (out.priority = "high"));
  take(/\s(!medium|!med|!m|!!)\s/i, () => (out.priority = "medium"));
  take(/\s(!low|!l|!)\s/i, () => (out.priority = "low"));
  take(/\s(daily|every ?day)\s/i, () => (out.repeat = "daily"));
  take(/\s(weekly|every ?week)\s/i, () => (out.repeat = "weekly"));
  take(/\s#([^\s#]+)\s/, (m) => {
    const q = m[1].toLowerCase();
    const hit = subjects.find((x) => x.name.toLowerCase().startsWith(q));
    if (hit) out.subject_id = hit.id;
  });
  out.title = s.replace(/\s+/g, " ").trim();
  return out;
}
