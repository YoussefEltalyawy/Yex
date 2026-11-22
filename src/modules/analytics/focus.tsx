import { fmtMinutes, fmtMonthDay, fmtWeekday, relativeDay, today } from "@/lib/dates";
import type { Subject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtAxis, minuteTicks, mix, TipLine, useGrow, useTip } from "./charts";
import { type Day, NONE, satIndex, subjectColor, WEEKDAYS } from "./data";

const dayTitle = (s: string) => (s === today() ? "Today" : `${fmtWeekday(s)}, ${fmtMonthDay(s)}`);

export function FocusChart({ days, stacked, subjects }: { days: Day[]; stacked: boolean; subjects: Subject[] }) {
  const tip = useTip();
  const grow = useGrow(days.length);
  const n = days.length;
  const max = Math.max(...days.map((d) => d.total));
  const { top, ticks } = minuteTicks(max);
  const avg = days.reduce((a, d) => a + d.total, 0) / n;
  const now = today();
  const every = n <= 7 ? 1 : n <= 30 ? 5 : 15;
  const order = [...subjects.map((s) => s.id), NONE];
  const byId = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const gap = n <= 7 ? "gap-4" : n <= 30 ? "gap-[5px]" : "gap-[2px]";
  const radius = n <= 30 ? 4 : 2;

  const tipFor = (d: Day) => (
    <div className="min-w-[120px]">
      <TipLine title={dayTitle(d.date)} />
      {stacked && d.total > 0 ? (
        order.filter((k) => d.bySubject[k]).map((k) => <TipLine key={k} title={byId[k]?.name ?? "No subject"} value={fmtMinutes(d.bySubject[k])} color={subjectColor(byId[k])} />)
      ) : (
        <div className="opacity-70">{d.total ? `${fmtMinutes(d.total)} · ${d.count} ${d.count === 1 ? "session" : "sessions"}` : "No focus"}</div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-[220px] flex-1 flex-col pl-10">
      <div ref={tip.ref} className="relative min-h-0 flex-1" onMouseLeave={tip.hide}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-stroke" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="absolute -left-10 w-8 -translate-y-1/2 text-right text-2xs tabular text-fg-4">{fmtAxis(t)}</span>
          </div>
        ))}
        {avg > 0 && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-fg-4 transition-[bottom] duration-500 ease-out" style={{ bottom: grow ? `${(avg / top) * 100}%` : 0 }}>
            <span className="absolute -top-2 right-0 rounded bg-surface px-1 text-2xs font-medium leading-4 text-fg-3">avg {fmtMinutes(avg)}</span>
          </div>
        )}
        <div className={cn("absolute inset-0 flex items-end", gap)}>
          {days.map((d) => {
            const isToday = d.date === now;
            const h = grow ? (d.total / top) * 100 : 0;
            return (
              <div key={d.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" onMouseEnter={(e) => tip.show(e.currentTarget.firstElementChild!, tipFor(d))}>
                <div
                  className={cn("flex w-full flex-col-reverse gap-px overflow-hidden transition-[height] duration-500 ease-out", n <= 7 && "max-w-[44px]")}
                  style={{ height: `${h}%`, minHeight: d.total > 0 ? 2 : 0, borderRadius: `${radius}px ${radius}px 1px 1px` }}
                >
                  {stacked ? (
                    order
                      .filter((k) => d.bySubject[k])
                      .map((k) => <div key={k} className="w-full transition-opacity group-hover:opacity-80" style={{ flexGrow: d.bySubject[k], flexBasis: 0, background: subjectColor(byId[k]) }} />)
                  ) : (
                    <div className={cn("h-full w-full transition-colors duration-150", !isToday && "group-hover:!bg-[color-mix(in_srgb,var(--accent)_75%,transparent)]")} style={{ background: isToday ? "var(--accent)" : mix("var(--accent)", 50) }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {tip.node}
      </div>
      <div className={cn("mt-2 flex h-4", gap)}>
        {days.map((d, i) => (
          <div key={d.date} className="relative min-w-0 flex-1">
            {(n - 1 - i) % every === 0 && (
              <span className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xs tabular", d.date === now ? "font-medium text-fg-2" : "text-fg-4")}>
                {n <= 7 ? (d.date === now ? "Today" : fmtWeekday(d.date)) : d.date === now ? "Today" : fmtMonthDay(d.date)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const LEVELS = [0, 1, 45, 90, 150];
const levelOf = (m: number) => LEVELS.reduce((l, t, i) => (m >= t && t > 0 ? i : l), 0);
const levelColor = (l: number) => (l === 0 ? "var(--color-hover)" : mix("var(--accent)", [0, 24, 46, 70, 100][l]));

export function Heatmap({ dates, map }: { dates: string[]; map: Map<string, Day> }) {
  const tip = useTip();
  const now = today();
  const weeks = Math.ceil(dates.length / 7);
  const cols = Array.from({ length: weeks }, (_, w) => dates.slice(w * 7, w * 7 + 7));
  return (
    <div className="shrink-0">
      <div ref={tip.ref} className="relative" onMouseLeave={tip.hide}>
        <div className="mb-1.5 ml-8 flex h-3 gap-[3px]">
          {cols.map((c, i) => {
            const m = c[0].slice(5, 7);
            const show = i === 0 ? Number(c[0].slice(8)) <= 14 : m !== cols[i - 1][0].slice(5, 7);
            return (
              <div key={i} className="relative w-3.5">
                {show && <span className="absolute left-0 whitespace-nowrap text-2xs leading-3 text-fg-4">{fmtMonthDay(c[0]).split(" ")[0]}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex">
          <div className="mr-2 grid w-6 grid-rows-7 gap-[3px] text-2xs leading-[14px] text-fg-4">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className="h-3.5">
                {i % 2 === 1 ? w : ""}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {cols.map((c, w) => (
              <div key={w} className="grid grid-rows-7 gap-[3px]">
                {c.map((s) => {
                  const m = map.get(s)?.total ?? 0;
                  const future = s > now;
                  return (
                    <div
                      key={s}
                      className={cn("size-3.5 rounded-[3px] transition-[box-shadow]", future ? "opacity-0" : "hover:shadow-[0_0_0_1.5px_var(--color-fg-3)]", s === now && "shadow-[0_0_0_1.5px_var(--color-fg-4)]")}
                      style={{ background: levelColor(levelOf(m)), gridRowStart: satIndex(s) + 1 }}
                      onMouseEnter={(e) => !future && tip.show(e.currentTarget, <TipLine title={relativeDay(s)} value={m ? fmtMinutes(m) : "—"} />)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {tip.node}
      </div>
      <div className="ml-8 mt-3 flex items-center gap-1 text-2xs text-fg-4">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-2.5 rounded-[3px]" style={{ background: levelColor(l) }} />
        ))}
        More
      </div>
    </div>
  );
}
