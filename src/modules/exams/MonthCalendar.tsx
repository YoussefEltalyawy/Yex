import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { addDays, parseDate, toDateStr, today, weekStart } from "@/lib/dates";
import type { Exam, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Icon } from "@/ui/core";

const monthFmt = new Intl.DateTimeFormat("en", { month: "long" });

export function MonthCalendar({ exams, subjects, day, onDay }: { exams: Exam[]; subjects: Record<string, Subject>; day: string | null; onDay: (d: string | null) => void }) {
  const t = today();
  const [month, setMonth] = useState(() => {
    const d = parseDate(day ?? t);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const byDay = useMemo(() => {
    const m: Record<string, Exam[]> = {};
    for (const e of exams) if (e.status !== "cancelled") (m[e.date] ??= []).push(e);
    return m;
  }, [exams]);
  const start = weekStart(month);
  const rows = addDays(start, 35).getMonth() === month.getMonth() ? 6 : 5;
  const days = Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const isCurrent = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
  const inMonth = exams.filter((e) => e.date.slice(0, 7) === toDateStr(month).slice(0, 7) && e.status !== "cancelled").length;

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center gap-1 pl-1">
        <span className="font-display text-lg font-medium">{monthFmt.format(month)}</span>
        <span className="text-lg font-light text-fg-4 tabular">{month.getFullYear()}</span>
        <div className="flex-1" />
        {!isCurrent && (
          <button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="mr-0.5 h-6 rounded-md px-1.5 text-xs font-medium text-fg-3 hover:bg-hover hover:text-fg">
            Today
          </button>
        )}
        <button aria-label="Previous month" className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg" onClick={() => shift(-1)}>
          <Icon icon={ArrowLeft01Icon} size={14} />
        </button>
        <button aria-label="Next month" className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-hover hover:text-fg" onClick={() => shift(1)}>
          <Icon icon={ArrowRight01Icon} size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-2xs font-medium text-fg-4">
        {["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"].map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const s = toDateStr(d);
          const list = byDay[s] ?? [];
          const other = d.getMonth() !== month.getMonth();
          const selected = s === day;
          const past = s < t;
          return (
            <button
              key={s}
              onClick={() => onDay(selected ? null : s)}
              title={list.map((e) => e.title).join("\n") || undefined}
              className={cn(
                "group relative mx-auto flex h-9 w-full max-w-9 flex-col items-center justify-center rounded-lg text-sm tabular transition-colors",
                selected ? "bg-fg text-canvas" : "hover:bg-hover",
                !selected && (s === t ? "font-semibold text-accent" : other ? "text-fg-4" : past ? "text-fg-3" : "text-fg"),
                list.length > 0 && !selected && !other && "font-medium",
              )}
            >
              {s === t && !selected && <span className="absolute inset-0.5 rounded-[7px] shadow-[inset_0_0_0_1.5px_var(--color-accent)] opacity-40" />}
              <span className="leading-none">{d.getDate()}</span>
              <span className="mt-[3px] flex h-[5px] gap-[2px]">
                {list.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={cn("size-[5px] rounded-full", selected ? "bg-canvas" : "bg-[var(--tint-fg)]", `tint-${(e.subject_id && subjects[e.subject_id]?.color) || "sand"}`, (past || other) && !selected && "opacity-35")}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 px-1 text-xs text-fg-3">{inMonth ? `${inMonth} ${inMonth === 1 ? "exam" : "exams"} in ${monthFmt.format(month)}` : `Nothing scheduled in ${monthFmt.format(month)}`}</div>
    </div>
  );
}
