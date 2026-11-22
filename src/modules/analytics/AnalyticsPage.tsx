import {
  ArrowDownRight01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Brain02Icon,
  Calendar03Icon,
  ChartHistogramIcon,
  ChartLineData01Icon,
  CheckListIcon,
  Clock01Icon,
  FireIcon,
  PieChartIcon,
  Target02Icon,
  Timer02Icon,
} from "@hugeicons/core-free-icons";
import { type ReactNode, useMemo, useState } from "react";
import { PageHeader, PageTitle } from "@/app/PageHeader";
import { addDays, fmtMinutes, fmtMonthDay, parseDate, relativeDay, startOfDay, toDateStr, today, weekStart } from "@/lib/dates";
import { useList } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Exam, MistakeStatus, Subject, Task } from "@/lib/types";
import { cn, EXAM_KINDS, MISTAKE_KINDS, pct, plural } from "@/lib/utils";
import type { PageProps } from "@/modules/types";
import { Button, Card, Empty, Icon, type IconType, Progress } from "@/ui/core";
import { Segmented } from "@/ui/overlay";
import { BarRow, Donut, MiniBars, mix, Sparkline, StackBar, TipLine, useGrow } from "./charts";
import { bucketDays, emptyDay, lastDays, NONE, percentDelta, type Range, satIndex, scoreTint, streaks, subjectColor, subjectFg, WEEKDAYS } from "./data";
import { FocusChart, Heatmap } from "./focus";

const WINDOW = 182;
const HEAT_WEEKS = 20;
const RANGES: { value: Range; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];
const STATUS: { key: MistakeStatus; label: string; color: string }[] = [
  { key: "open", label: "Open", color: "var(--rose)" },
  { key: "reviewing", label: "Reviewing", color: "var(--butter)" },
  { key: "mastered", label: "Mastered", color: "var(--mint)" },
];

function CardHeader({ title, icon, sub, action }: { title: string; icon: IconType; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 px-4">
      <Icon icon={icon} size={15} className="text-fg-3" />
      <span className="text-base font-semibold">{title}</span>
      {sub && <span className="truncate text-sm text-fg-3">{sub}</span>}
      <div className="flex-1" />
      {action}
    </div>
  );
}

function Delta({ value, unit = "%", hint, className }: { value: number | null; unit?: string; hint?: string; className?: string }) {
  if (value == null) return <span className={cn("text-fg-4", className)}>{hint ? `No data ${hint}` : "—"}</span>;
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap font-medium tabular", className)} style={{ color: value === 0 ? "var(--color-fg-3)" : up ? "var(--mint-fg)" : "var(--rose-fg)" }}>
      {value !== 0 && <Icon icon={up ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={12} strokeWidth={2} />}
      {up && value > 0 ? "+" : ""}
      {value}
      {unit}
      {hint && <span className="ml-1 font-normal text-fg-3">{hint}</span>}
    </span>
  );
}

function Stat({ label, value, sub, icon, delay, className }: { label: string; value: ReactNode; sub?: ReactNode; icon: IconType; delay: number; className?: string }) {
  return (
    <Card className={cn("anim-rise col-span-2 min-w-0 p-4 lg:col-span-1", className)} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-1.5 truncate text-xs font-medium text-fg-3">
        <Icon icon={icon} size={13} /> {label}
      </div>
      <div className="mt-2 truncate font-display text-[26px] font-medium leading-none tracking-tight tabular">{value}</div>
      {sub && <div className="mt-1.5 truncate text-xs text-fg-3">{sub}</div>}
    </Card>
  );
}

function Metric({ value, label, color }: { value: ReactNode; label: string; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-display text-xl font-medium leading-tight tabular" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="truncate text-xs text-fg-3">{label}</div>
    </div>
  );
}

const Heading = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("mb-2.5 text-xs font-medium text-fg-3", className)}>{children}</div>;

const SubjectBadge = ({ s, size = 24 }: { s?: Subject; size?: number }) => (
  <span className={cn("grid shrink-0 place-items-center rounded-md tint-bg", `tint-${s?.color ?? "sand"}`)} style={{ width: size, height: size, fontSize: size * 0.54 }}>
    {s?.icon ?? "📄"}
  </span>
);

export default function AnalyticsPage(_: PageProps) {
  const [range, setRange] = useState<Range>("30");
  const [stacked, setStacked] = useState<"total" | "subject">("total");
  const [activeSlice, setActiveSlice] = useState<string | null>(null);
  const R = Number(range);
  const since = useMemo(() => addDays(startOfDay(), -WINDOW), []);
  const sinceIso = since.toISOString();
  const sinceDate = toDateStr(since);

  const { data: sessions = [], isSuccess: loaded } = useList("focus_session", { filter: { kind: "focus", started_at: { gte: sinceIso } } });
  const { data: exams = [] } = useList("exam", { filter: { status: "done" }, order_by: "date" });
  const { data: mistakes = [] } = useList("mistake");
  const { data: tasksDue = [] } = useList("task", { filter: { due_date: { gte: sinceDate } } });
  const { data: tasksDone = [] } = useList("task", { filter: { done_at: { gte: sinceIso } } });
  const { data: subjects = [] } = useList("subject");
  const grow = useGrow(range);

  const byId = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const map = useMemo(() => bucketDays(sessions), [sessions]);
  const now = today();

  const focus = useMemo(() => {
    const dates = lastDays(R);
    const days = dates.map((d) => map.get(d) ?? emptyDay(d));
    const prev = lastDays(R, R).reduce((a, d) => a + (map.get(d)?.total ?? 0), 0);
    const total = days.reduce((a, d) => a + d.total, 0);
    const count = days.reduce((a, d) => a + d.count, 0);
    const bestDay = days.reduce((b, d) => (d.total > b.total ? d : b), days[0]);
    const per: Record<string, number> = {};
    for (const d of days) for (const [k, m] of Object.entries(d.bySubject)) per[k] = (per[k] ?? 0) + m;
    const slices = Object.entries(per)
      .map(([key, value]) => ({ key, value, color: subjectColor(byId[key]) }))
      .sort((a, b) => b.value - a.value);
    const wd = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const d of days) {
      const w = wd[satIndex(d.date)];
      w.sum += d.total;
      w.n++;
    }
    const rhythm = wd.map((w) => (w.n ? w.sum / w.n : 0));
    const start = dates[0];
    const heatStart = addDays(weekStart(), -7 * (HEAT_WEEKS - 1));
    const heat = Array.from({ length: HEAT_WEEKS * 7 }, (_, i) => toDateStr(addDays(heatStart, i)));
    return { days, start, total, prev, count, bestDay, slices, rhythm, active: days.filter((d) => d.total > 0).length, heat, ...streaks(map, WINDOW) };
  }, [map, R, byId]);

  const exam = useMemo(() => {
    const scored = exams
      .map((e) => ({ e, p: pct(e.score, e.max_score) }))
      .filter((x): x is { e: Exam; p: number } => x.p != null)
      .sort((a, b) => a.e.date.localeCompare(b.e.date));
    const avg = (xs: typeof scored) => (xs.length ? Math.round(xs.reduce((a, x) => a + x.p, 0) / xs.length) : null);
    const prevStart = toDateStr(addDays(parseDate(focus.start), -R));
    const inRange = scored.filter((x) => x.e.date >= focus.start);
    const cur = avg(inRange);
    const prev = avg(scored.filter((x) => x.e.date >= prevStart && x.e.date < focus.start));
    const t0 = scored.length ? parseDate(scored[0].e.date).getTime() : 0;
    const span = scored.length ? parseDate(scored[scored.length - 1].e.date).getTime() - t0 : 0;
    const lo = Math.min(50, Math.floor((Math.min(100, ...scored.map((x) => x.p)) - 5) / 10) * 10);
    const groups = new Map<string, typeof scored>();
    for (const x of scored) {
      const k = x.e.subject_id ?? NONE;
      groups.set(k, [...(groups.get(k) ?? []), x]);
    }
    const order = [...subjects.map((s) => s.id), NONE];
    const trends = [...groups.entries()]
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([k, xs]) => ({
        subject: byId[k] as Subject | undefined,
        latest: xs[xs.length - 1].p,
        delta: xs.length > 1 ? xs[xs.length - 1].p - xs[xs.length - 2].p : null,
        points: xs.map(({ e, p }) => ({
          t: span ? (parseDate(e.date).getTime() - t0) / span : 0.5,
          v: p,
          tip: <TipLine title={`${e.title} · ${fmtMonthDay(e.date)}`} value={`${p}%`} />,
        })),
      }));
    return { cur, delta: cur != null && prev != null ? cur - prev : null, inRange: inRange.length, lo, trends, recent: scored.slice(-4).reverse(), count: scored.length };
  }, [exams, subjects, byId, focus.start, R]);

  const mist = useMemo(() => {
    const count = <K extends string>(key: (m: (typeof mistakes)[number]) => K) => {
      const out: Partial<Record<K, number>> = {};
      for (const m of mistakes) out[key(m)] = (out[key(m)] ?? 0) + 1;
      return Object.entries(out) as [K, number][];
    };
    const status = Object.fromEntries(count((m) => m.status)) as Partial<Record<MistakeStatus, number>>;
    return {
      total: mistakes.length,
      status,
      kinds: count((m) => m.kind).sort((a, b) => b[1] - a[1]),
      subjects: count((m) => m.subject_id ?? NONE).sort((a, b) => b[1] - a[1]),
      recent: mistakes.filter((m) => m.created_at.slice(0, 10) >= focus.start).length,
      due: mistakes.filter((m) => m.status !== "mastered" && m.next_review_at && m.next_review_at <= now).length,
      reviews: mistakes.reduce((a, m) => a + m.review_count, 0),
    };
  }, [mistakes, focus.start, now]);

  const tasks = useMemo(() => {
    const all = new Map<string, Task>();
    for (const t of [...tasksDue, ...tasksDone]) all.set(t.id, t);
    const list = [...all.values()];
    const planned = list.filter((t) => t.due_date && t.due_date >= focus.start && t.due_date <= now);
    const done = planned.filter((t) => t.done);
    const onTime = done.filter((t) => t.done_at && toDateStr(new Date(t.done_at)) <= t.due_date!).length;
    const perDay = new Map<string, number>();
    for (const t of list) if (t.done && t.done_at) perDay.set(toDateStr(new Date(t.done_at)), (perDay.get(toDateStr(new Date(t.done_at))) ?? 0) + 1);
    const completions = focus.days.map((d) => perDay.get(d.date) ?? 0);
    return {
      planned: planned.length,
      done: done.length,
      onTime,
      late: done.length - onTime,
      overdue: list.filter((t) => !t.done && t.due_date && t.due_date < now).length,
      completions,
      completed: completions.reduce((a, b) => a + b, 0),
      rate: planned.length ? Math.round((done.length / planned.length) * 100) : null,
    };
  }, [tasksDue, tasksDone, focus.start, focus.days, now]);

  const slice = focus.slices.find((s) => s.key === activeSlice);
  const bestWd = focus.rhythm.indexOf(Math.max(...focus.rhythm));
  const rangeLabel = `the last ${R} days`;
  const mastered = mist.status.mastered ?? 0;

  return (
    <>
      <PageHeader crumbs={[{ label: "Analytics" }]} actions={<Segmented size="sm" value={range} options={RANGES} onChange={setRange} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1120px] px-8 pb-16 pt-6">
          <PageTitle
            sub={
              <>
                {fmtMonthDay(focus.start)} – {fmtMonthDay(now)}
                {loaded && <> · {focus.total ? `${fmtMinutes(focus.total)} of focus across ${plural(focus.active, "day")}` : `No focus logged in ${rangeLabel}`}</>}
              </>
            }
          >
            Analytics
          </PageTitle>

          <div className="grid grid-cols-6 gap-4 lg:grid-cols-5">
            <Stat label="Focus time" icon={Timer02Icon} delay={0} value={fmtMinutes(focus.total)} sub={focus.prev ? <Delta value={percentDelta(focus.total, focus.prev)} hint="vs prev" /> : `${plural(focus.active, "active day")}`} />
            <Stat label="Daily average" icon={Clock01Icon} delay={30} value={fmtMinutes(focus.total / R)} sub={focus.bestDay?.total ? `Best ${fmtMinutes(focus.bestDay.total)} · ${fmtMonthDay(focus.bestDay.date)}` : "No sessions yet"} />
            <Stat label="Sessions" icon={FireIcon} delay={60} value={focus.count} sub={focus.count ? `≈ ${fmtMinutes(focus.total / focus.count)} each` : "Start a timer"} />
            <Stat
              className="col-span-3"
              label="Exam average"
              icon={Target02Icon}
              delay={90}
              value={exam.cur != null ? `${exam.cur}%` : "—"}
              sub={exam.delta != null ? <Delta value={exam.delta} unit=" pts" hint="vs prev" /> : exam.cur != null ? `${plural(exam.inRange, "exam")} in range` : "No graded exams"}
            />
            <Stat className="col-span-3" label="Mastered" icon={Brain02Icon} delay={120} value={`${mastered}/${mist.total}`} sub={mist.recent ? `+${mist.recent} logged in range` : `${mist.status.open ?? 0} still open`} />
          </div>

          <div className="mt-4 grid grid-cols-12 gap-4">
            <Card className="anim-rise col-span-12 flex flex-col lg:col-span-8" style={{ animationDelay: "150ms" }}>
              <CardHeader
                title="Focus time"
                icon={ChartHistogramIcon}
                sub={`last ${R} days`}
                action={
                  <Segmented
                    size="sm"
                    value={stacked}
                    onChange={setStacked}
                    options={[
                      { value: "total", label: "Total" },
                      { value: "subject", label: "By subject" },
                    ]}
                  />
                }
              />
              {focus.total > 0 ? (
                <div className="flex flex-1 flex-col px-4 pb-3 pt-2">
                  <FocusChart key={range} days={focus.days} stacked={stacked === "subject"} subjects={subjects} />
                </div>
              ) : (
                <Empty className="flex-1" icon="⏱️" title="No focus yet" hint={`Sessions you finish with the focus timer in ${rangeLabel} show up here.`} action={<Button variant="outline" size="sm" onClick={() => navigate("focus")}>Open focus</Button>} />
              )}
            </Card>

            <Card className="anim-rise col-span-12 flex flex-col lg:col-span-4" style={{ animationDelay: "180ms" }}>
              <CardHeader title="By subject" icon={PieChartIcon} sub={focus.slices.length ? plural(focus.slices.length, "subject") : undefined} />
              {focus.slices.length ? (
                <div className="flex flex-1 flex-col items-center px-3 pb-3 pt-1">
                  <Donut key={range} slices={focus.slices} size={148} stroke={15} active={activeSlice} onActive={setActiveSlice}>
                    {slice ? (
                      <>
                        <span className="text-[18px] leading-none">{byId[slice.key]?.icon ?? "📄"}</span>
                        <span className="mt-1 font-display text-xl font-medium leading-tight tabular">{fmtMinutes(slice.value)}</span>
                        <span className="text-2xs text-fg-3">{Math.round((slice.value / focus.total) * 100)}%</span>
                      </>
                    ) : (
                      <>
                        <span className="font-display text-[22px] font-medium leading-tight tabular">{fmtMinutes(focus.total)}</span>
                        <span className="text-2xs text-fg-3">focused</span>
                      </>
                    )}
                  </Donut>
                  <div className="mt-3 w-full" onMouseLeave={() => setActiveSlice(null)}>
                    {focus.slices.map((s) => {
                      const sub = byId[s.key];
                      return (
                        <div
                          key={s.key}
                          onMouseEnter={() => setActiveSlice(s.key)}
                          className={cn("flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors", activeSlice === s.key && "bg-hover")}
                        >
                          <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                          <span className="text-[13px] leading-none">{sub?.icon ?? "📄"}</span>
                          <span className="min-w-0 flex-1 truncate font-medium">{sub?.name ?? "No subject"}</span>
                          <span className="tabular text-fg-2">{fmtMinutes(s.value)}</span>
                          <span className="w-9 text-right text-xs tabular text-fg-4">{Math.round((s.value / focus.total) * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Empty className="flex-1" icon="🎨" title="Nothing to split" hint="Pick a subject when you start a timer to see where your time goes." />
              )}
            </Card>

            <Card className="anim-rise col-span-12 lg:col-span-8" style={{ animationDelay: "210ms" }}>
              <CardHeader title="Consistency" icon={Calendar03Icon} sub={`last ${HEAT_WEEKS} weeks`} />
              <div className="flex flex-wrap items-start gap-x-10 gap-y-6 px-4 pb-4 pt-1">
                <Heatmap dates={focus.heat} map={map} />
                <div className="min-w-[220px] flex-1">
                  <div className="grid grid-cols-3 gap-3">
                    <Metric value={plural(focus.cur, "day")} label="Current streak" />
                    <Metric value={plural(focus.best, "day")} label="Longest streak" />
                    <Metric value={`${focus.active}/${R}`} label="Active days" />
                  </div>
                  <Heading className="mt-5">Weekly rhythm · avg per day</Heading>
                  <MiniBars
                    key={range}
                    values={focus.rhythm}
                    labels={WEEKDAYS}
                    highlight={focus.rhythm[bestWd] > 0 ? bestWd : undefined}
                    height={52}
                    tips={(i) => <TipLine title={WEEKDAYS[i]} value={fmtMinutes(focus.rhythm[i])} />}
                  />
                </div>
              </div>
            </Card>

            <Card className="anim-rise col-span-12 flex flex-col md:col-span-6 lg:col-span-4" style={{ animationDelay: "240ms" }}>
              <CardHeader title="Tasks" icon={CheckListIcon} sub="due in range" />
              <div className="flex flex-1 flex-col px-4 pb-4 pt-1">
                <div className="flex items-end justify-between gap-3">
                  <div className="font-display text-[34px] font-medium leading-none tracking-tight tabular">{tasks.rate != null ? `${tasks.rate}%` : "—"}</div>
                  <div className="pb-0.5 text-sm text-fg-3">{tasks.planned ? `${tasks.done} of ${plural(tasks.planned, "task")} done` : "Nothing was due"}</div>
                </div>
                <Progress value={tasks.rate ?? 0} className="mt-3" />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Metric value={tasks.onTime} label="On time" />
                  <Metric value={tasks.late} label="Late" />
                  <Metric value={tasks.overdue} label="Overdue" color={tasks.overdue ? "var(--danger)" : undefined} />
                </div>
                <div className="flex-1" />
                <Heading className="mt-5">Completed per day · {tasks.completed}</Heading>
                <MiniBars
                  key={range}
                  values={tasks.completions}
                  height={32}
                  color="var(--mint-fg)"
                  tips={(i) => <TipLine title={relativeDay(focus.days[i].date)} value={plural(tasks.completions[i], "task")} />}
                />
              </div>
            </Card>

            <Card className="anim-rise col-span-12 flex flex-col md:col-span-6 lg:col-span-5" style={{ animationDelay: "270ms" }}>
              <CardHeader
                title="Mistakes"
                icon={Brain02Icon}
                sub={mist.total ? `${mist.total} logged · all time` : undefined}
                action={
                  <Button size="sm" variant="ghost" iconRight={ArrowRight01Icon} onClick={() => navigate("review")}>
                    Review
                  </Button>
                }
              />
              {mist.total ? (
                <div className="flex flex-1 flex-col px-4 pb-4 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[34px] font-medium leading-none tracking-tight tabular">{Math.round((mastered / mist.total) * 100)}%</span>
                    <span className="text-sm text-fg-3">mastered</span>
                  </div>
                  <StackBar className="mt-3" parts={STATUS.map((s) => ({ key: s.key, value: mist.status[s.key] ?? 0, color: s.color }))} />
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {STATUS.map((s) => (
                      <span key={s.key} className="inline-flex items-center gap-1.5 text-fg-3">
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        {s.label}
                        <span className="font-medium tabular text-fg-2">{mist.status[s.key] ?? 0}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-x-6">
                    <div className="min-w-0">
                      <Heading>By kind</Heading>
                      <div className="space-y-2.5">
                        {mist.kinds.map(([k, n]) => (
                          <BarRow key={k} label={MISTAKE_KINDS[k] ?? k} value={n} max={mist.kinds[0][1]} right={n} grow={grow} color={mix("var(--fg)", 42)} />
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <Heading>By subject</Heading>
                      <div className="space-y-2.5">
                        {mist.subjects.map(([k, n]) => (
                          <BarRow
                            key={k}
                            label={
                              <>
                                <span className="mr-1.5">{byId[k]?.icon ?? "📄"}</span>
                                {byId[k]?.name ?? "Unsorted"}
                              </>
                            }
                            value={n}
                            max={mist.subjects[0][1]}
                            right={n}
                            grow={grow}
                            color={subjectColor(byId[k])}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="min-h-6 flex-1" />
                  <div className="grid grid-cols-3 gap-3 border-t border-stroke pt-4">
                    <Metric value={mist.due} label="Due for review" color={mist.due ? "var(--accent)" : undefined} />
                    <Metric value={mist.reviews} label="Reviews done" />
                    <Metric value={(mist.reviews / mist.total).toFixed(1)} label="Avg per mistake" />
                  </div>
                </div>
              ) : (
                <Empty className="flex-1" icon="🧠" title="No mistakes logged" hint="Log wrong answers from lessons and exams — patterns show up here." />
              )}
            </Card>
            <Card className="anim-rise col-span-12 flex flex-col lg:col-span-7" style={{ animationDelay: "300ms" }}>
              <CardHeader
                title="Exam scores"
                icon={ChartLineData01Icon}
                sub={exam.count ? `${plural(exam.count, "graded exam")} · all time` : undefined}
                action={
                  <Button size="sm" variant="ghost" iconRight={ArrowRight01Icon} onClick={() => navigate("exams")}>
                    Exams
                  </Button>
                }
              />
              {exam.count ? (
                <>
                  <div className="px-4 pb-2">
                    {exam.trends.map((t) => (
                      <div key={t.subject?.id ?? NONE} className="flex h-11 items-center gap-3">
                        <div className="flex w-32 min-w-0 items-center gap-2">
                          <SubjectBadge s={t.subject} />
                          <span className="truncate text-sm font-medium">{t.subject?.name ?? "Other"}</span>
                        </div>
                        <Sparkline points={t.points} lo={exam.lo} color={subjectFg(t.subject)} fill={subjectColor(t.subject)} />
                        <div className="w-12 text-right font-display text-lg font-medium tabular">{t.latest}%</div>
                        <div className="flex w-16 justify-end text-xs">
                          <Delta value={t.delta} unit=" pts" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mx-4 border-t border-stroke" />
                  <div className="px-2 pb-2 pt-2.5">
                    <Heading className="mb-1 px-2">Recent</Heading>
                    {exam.recent.map(({ e, p }) => {
                      const s = e.subject_id ? byId[e.subject_id] : undefined;
                      return (
                        <button key={e.id} onClick={() => navigate("exams", { exam: e.id })} className="flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-hover">
                          <SubjectBadge s={s} size={26} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium" dir="auto">
                              {e.title}
                            </div>
                            <div className="truncate text-2xs text-fg-3">
                              {EXAM_KINDS[e.kind]} · {relativeDay(e.date)}
                            </div>
                          </div>
                          <span className="text-xs tabular text-fg-3">
                            {e.score}/{e.max_score}
                          </span>
                          <span className={cn("inline-flex h-5 w-11 items-center justify-center rounded-md text-xs font-semibold tabular tint-bg tint-text", `tint-${scoreTint(p)}`)}>{p}%</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Empty className="flex-1" icon="📝" title="No scores yet" hint="Add a score to a finished quiz or trial to track how you're improving." />
              )}
            </Card>

          </div>
        </div>
      </div>
    </>
  );
}
