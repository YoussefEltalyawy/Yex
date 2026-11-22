import { Target02Icon } from "@hugeicons/core-free-icons";
import { type InputHTMLAttributes, useEffect, useRef, useState } from "react";
import { countdown, daysUntil, parseDate, shiftDate, today } from "@/lib/dates";
import { useCreate, useUpdate } from "@/lib/query";
import { navigate } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Exam, ExamKind, ExamStatus } from "@/lib/types";
import { cn, pct } from "@/lib/utils";
import { BareInput, Button, type ButtonProps } from "@/ui/core";
import { Popover, usePopover } from "@/ui/overlay";

export type KindFilter = "all" | "quiz" | "trial" | "other";
export const matchesKind = (k: ExamKind, f: KindFilter) => f === "all" || (f === "other" ? k !== "quiz" && k !== "trial" : k === f);

export const STATUS_LABEL: Record<ExamStatus, string> = { upcoming: "Upcoming", done: "Done", missed: "Missed", cancelled: "Cancelled" };
export const KIND_EMOJI: Record<ExamKind, string> = { quiz: "✏️", trial: "📝", exam: "🎓", homework: "📚", other: "📌" };

/** Exam still marked upcoming although its day has passed. */
export const needsScore = (e: Exam) => e.status === "upcoming" && e.date < today();

export const scoreTint = (p: number) => (p >= 85 ? "mint" : p >= 65 ? "butter" : "rose");

const month = new Intl.DateTimeFormat("en", { month: "short" });

export function DateTile({ date, color = "sand", muted, large }: { date: string; color?: string; muted?: boolean; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-lg tint-bg transition-opacity",
        `tint-${color}`,
        large ? "h-[60px] w-[54px] rounded-xl" : "h-[42px] w-11",
        muted && "opacity-55 saturate-50",
      )}
    >
      <span className={cn("font-semibold uppercase tint-text", large ? "text-xs" : "text-2xs")}>{month.format(parseDate(date))}</span>
      <span className={cn("font-display font-medium leading-none tabular", large ? "text-[26px]" : "text-lg")}>{Number(date.slice(8))}</span>
    </div>
  );
}

export function CountdownPill({ date, className }: { date: string; className?: string }) {
  const n = daysUntil(date);
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-xs font-medium tabular",
        n <= 1 ? "bg-danger-soft text-danger" : n <= 3 ? "bg-[color-mix(in_srgb,var(--butter)_45%,transparent)] text-[var(--butter-fg)]" : "text-fg-3",
        className,
      )}
    >
      {countdown(date)}
    </span>
  );
}

export function ScorePill({ exam, className }: { exam: Exam; className?: string }) {
  const p = pct(exam.score, exam.max_score);
  if (exam.score == null) return null;
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-xs text-fg-3 tabular">
        {fmtNum(exam.score)}
        {exam.max_score ? `/${fmtNum(exam.max_score)}` : ""}
      </span>
      {p != null && (
        <span className={cn("inline-flex h-5 min-w-[42px] items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular tint-bg tint-text", `tint-${scoreTint(p)}`, className)}>
          {p}%
        </span>
      )}
    </span>
  );
}

export const fmtNum = (n: number) => String(Math.round(n * 100) / 100);

export function StatusBadge({ status }: { status: ExamStatus }) {
  if (status !== "missed" && status !== "cancelled") return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-xs font-medium",
        status === "missed" ? "bg-danger-soft text-danger" : "bg-hover text-fg-3 line-through decoration-fg-4",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200", checked ? "bg-accent" : "bg-press shadow-[inset_0_0_0_1px_var(--color-stroke)]")}
    >
      <span
        className={cn("absolute left-0 top-[2px] size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-out", checked ? "translate-x-[16px]" : "translate-x-[2px]")}
        style={{ transitionTimingFunction: "var(--ease-spring)" }}
      />
    </button>
  );
}

/** Input with local state that commits on blur / Enter and resyncs with outside changes. */
export function DraftInput({
  value,
  onCommit,
  normalize = (v) => v,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onCommit: (v: string) => void; normalize?: (v: string) => string | null }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const commit = () => {
    const v = normalize(draft);
    setDraft(v ?? value);
    if (v != null && v !== value) onCommit(v);
  };
  return (
    <BareInput
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.stopPropagation();
          setDraft(value);
          focused.current = false;
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

export const parseNum = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

const numBox =
  "h-8 w-full rounded-lg bg-surface px-2.5 text-center text-md font-medium tabular text-fg shadow-[inset_0_0_0_1px_var(--color-stroke-strong)] outline-none transition-shadow placeholder:font-normal placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-soft)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

export function LogScoreButton({ exam, defaultMax, label = "Log score", ...btn }: Omit<ButtonProps, "onClick"> & { exam: Exam; defaultMax?: number | null; label?: string }) {
  const p = usePopover();
  const update = useUpdate("exam");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!p.open) return;
    const id = setTimeout(() => first.current?.select(), 30);
    return () => clearTimeout(id);
  }, [p.open]);
  const open = () => {
    setScore(exam.score != null ? fmtNum(exam.score) : "");
    setMax(fmtNum(exam.max_score ?? defaultMax ?? 20));
    p.toggle();
  };
  const s = parseNum(score);
  const m = parseNum(max);
  const live = pct(s, m);
  const save = () => {
    if (s == null) return;
    update.mutate({ id: exam.id, patch: { score: s, max_score: m } });
    toast(live != null && live >= 85 ? `Logged ${live}% — great work ✨` : `Score logged for ${exam.title}`);
    p.close();
  };
  return (
    <>
      <Button
        ref={p.ref}
        {...btn}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
      >
        {label}
      </Button>
      <Popover open={p.open} onClose={p.close} anchor={p.ref} align="end" className="w-[248px] p-3">
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Enter" && save()}>
          <div className="mb-0.5 truncate text-sm font-semibold" dir="auto">
            {exam.title}
          </div>
          <div className="mb-3 text-xs text-fg-3">How did it go?</div>
          <div className="flex items-center gap-2">
            <input ref={first} inputMode="decimal" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} className={numBox} />
            <span className="font-display text-lg text-fg-4">/</span>
            <input inputMode="decimal" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} className={numBox} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className={cn("text-sm font-semibold tabular transition-colors", live == null ? "text-fg-4" : `tint-${scoreTint(live)} tint-text`)}>{live == null ? "—" : `${live}%`}</span>
            <Button size="sm" variant="solid" disabled={s == null} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
}

export function usePrepare() {
  const create = useCreate("task");
  return async (exam: Exam) => {
    const t = today();
    const due = exam.date > t ? shiftDate(exam.date, -1) : t;
    const task = await create.mutateAsync({
      title: `Prepare for ${exam.title}`,
      exam_id: exam.id,
      subject_id: exam.subject_id,
      due_date: due < t ? t : due,
      priority: daysUntil(exam.date) <= 3 ? "high" : "medium",
    });
    toast("Prep task added", { action: { label: "Open", run: () => navigate("tasks", { task: task.id }) } });
  };
}

export function PrepareButton({ exam, ...btn }: Omit<ButtonProps, "onClick"> & { exam: Exam }) {
  const prepare = usePrepare();
  return (
    <Button
      icon={Target02Icon}
      {...btn}
      onClick={(e) => {
        e.stopPropagation();
        prepare(exam);
      }}
    >
      Prepare
    </Button>
  );
}

/** "9" → 09:00, "930" → 09:30, "17.30" → 17:30; null if not a valid time. */
export function parseTime(s: string): string | null {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})[:.\s](\d{1,2})$/) ?? t.match(/^(\d{1,2})(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : null;
}
