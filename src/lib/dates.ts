const pad = (n: number) => String(n).padStart(2, "0");

export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toDateStr(new Date());
export const parseDate = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const shiftDate = (s: string, n: number) => toDateStr(addDays(parseDate(s), n));

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole days from today until the given YYYY-MM-DD (negative = past). */
export function daysUntil(s: string) {
  return Math.round((parseDate(s).getTime() - startOfDay().getTime()) / 86_400_000);
}

const weekday = new Intl.DateTimeFormat("en", { weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat("en", { weekday: "long" });
const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" });

export const fmtWeekday = (s: string) => weekday.format(parseDate(s));
export const fmtMonthDay = (s: string) => monthDay.format(parseDate(s));
export const fmtFullDate = (d = new Date()) => fullDate.format(d);

/** "Today", "Tomorrow", "Yesterday", "Thursday", "Mon, Nov 24". */
export function relativeDay(s: string) {
  const n = daysUntil(s);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return weekdayLong.format(parseDate(s));
  return `${fmtWeekday(s)}, ${fmtMonthDay(s)}`;
}

/** "in 3 days", "tomorrow", "today", "2 days ago". */
export function countdown(s: string) {
  const n = daysUntil(s);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function fmtMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export function fmtClock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

export function timeAgo(iso: string) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const d = Math.floor(sec / 86400);
  return d < 30 ? `${d}d ago` : monthDay.format(new Date(iso));
}

/** Saturday-based week start (Egyptian week). */
export function weekStart(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 1) % 7));
  return x;
}
