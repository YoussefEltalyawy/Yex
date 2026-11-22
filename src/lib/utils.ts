export type ClassValue = string | false | null | undefined | 0;
export const cn = (...xs: ClassValue[]) => xs.filter(Boolean).join(" ");

export const pct = (score: number | null, max: number | null) => (score != null && max ? Math.round((score / max) * 100) : null);

export function groupBy<T, K extends string>(xs: T[], key: (x: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const x of xs) (out[key(x)] ??= []).push(x);
  return out;
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Position between two neighbours for manual ordering. */
export const between = (a?: number, b?: number) => (a == null && b == null ? 0 : a == null ? b! - 1 : b == null ? a + 1 : (a + b) / 2);

export const isRtl = (s: string | null | undefined) => !!s && /[\u0590-\u08FF]/.test(s.slice(0, 80));

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const MISTAKE_KINDS: Record<string, string> = {
  concept: "Concept",
  careless: "Careless",
  calculation: "Calculation",
  misread: "Misread",
  memory: "Memory",
  time: "Time pressure",
  other: "Other",
};

export const EXAM_KINDS: Record<string, string> = { quiz: "Quiz", trial: "Trial", exam: "Exam", homework: "Homework", other: "Other" };

export const PROGRESS_LABEL: Record<string, string> = { not_started: "Not started", in_progress: "In progress", done: "Done", revised: "Revised" };
