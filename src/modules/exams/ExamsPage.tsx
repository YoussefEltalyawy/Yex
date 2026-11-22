import { Add01Icon, ArrowRight01Icon, Calendar03Icon, Cancel01Icon, Clock01Icon, Target02Icon } from "@hugeicons/core-free-icons";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/app/PageHeader";
import { addDays, countdown, daysUntil, fmtFullDate, fmtMonthDay, parseDate, relativeDay, toDateStr, today, weekStart } from "@/lib/dates";
import { useList } from "@/lib/query";
import { useApp } from "@/lib/store";
import type { Exam, Subject } from "@/lib/types";
import { cn, EXAM_KINDS, pct, plural } from "@/lib/utils";
import type { PageProps } from "@/modules/types";
import { Button, Card, Empty, Icon } from "@/ui/core";
import { Segmented, Select } from "@/ui/overlay";
import { ExamDetail } from "./ExamDetail";
import { ExamDialog } from "./ExamDialog";
import { ExamRow } from "./ExamRow";
import { MonthCalendar } from "./MonthCalendar";
import { type KindFilter, LogScoreButton, matchesKind, needsScore, PrepareButton, scoreTint } from "./parts";

const setParams = (params: Record<string, string>) => useApp.getState().navigate("exams", params, { replace: true });

function SectionHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1 flex h-8 items-center gap-2 px-2">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {sub && <span className="text-xs text-fg-3 tabular">{sub}</span>}
      <div className="flex-1" />
      {action}
    </div>
  );
}

function NextUp({ exam, subject, defaultMax, onOpen }: { exam: Exam; subject?: Subject; defaultMax?: number | null; onOpen: () => void }) {
  const n = daysUntil(exam.date);
  const { data: tasks = [] } = useList("task", { filter: { exam_id: exam.id } });
  const done = tasks.filter((t) => t.done).length;
  const color = subject?.color ?? "sand";
  return (
    <div
      onClick={onOpen}
      className={cn("anim-rise group relative mb-8 flex overflow-hidden rounded-2xl bg-surface shadow-card transition-shadow hover:shadow-[var(--shadow-card),0_8px_24px_-14px_rgb(30_20_10/0.18)]", `tint-${color}`)}
      style={{ animationDelay: "30ms" }}
    >
      <div className="relative flex w-[168px] shrink-0 flex-col items-center justify-center bg-[color-mix(in_srgb,var(--tint)_calc(var(--tint-strength)*0.75),transparent)] px-4 py-6 text-center">
        {n <= 1 ? (
          <div className={cn("font-display font-medium leading-none tracking-tight", n === 0 ? "text-[44px]" : "text-[32px]")}>{n === 0 ? "Today" : "Tomorrow"}</div>
        ) : (
          <div className="font-display text-[72px] font-normal leading-[0.85] tracking-tight tabular">{n}</div>
        )}
        <div className="mt-2.5 text-sm font-medium tint-text">{n === 0 ? (exam.time ? `at ${exam.time}` : "Good luck ✨") : n === 1 ? (exam.time ? `at ${exam.time}` : "Last day to revise") : "days to go"}</div>
      </div>
      <div className="min-w-0 flex-1 px-6 py-5">
        <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.08em] text-fg-3">
          <span className="size-1.5 rounded-full tint-solid" />
          Next up · {EXAM_KINDS[exam.kind]}
        </div>
        <h2 className="mt-1.5 truncate font-display text-[28px] font-medium leading-tight tracking-tight" dir="auto">
          {exam.title}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-2">
          {subject && (
            <span className="flex items-center gap-1.5 tint-text">
              <span className="text-xs">{subject.icon}</span>
              {subject.name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Icon icon={Calendar03Icon} size={14} className="text-fg-3" />
            {relativeDay(exam.date)}
            {n > 1 && n < 7 && <span className="text-fg-3">· {parseDate(exam.date).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>}
          </span>
          {exam.time && (
            <span className="flex items-center gap-1.5">
              <Icon icon={Clock01Icon} size={14} className="text-fg-3" />
              {exam.time}
            </span>
          )}
        </div>
        {exam.scope && (
          <p className="mt-3 line-clamp-2 border-l-2 border-[color-mix(in_srgb,var(--tint)_80%,transparent)] pl-3 text-base leading-relaxed text-fg-2" dir="auto">
            {exam.scope}
          </p>
        )}
        <div className="mt-4 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrepareButton exam={exam} variant="solid" size="sm" />
          <LogScoreButton exam={exam} defaultMax={defaultMax} variant="ghost" size="sm" />
          <div className="flex-1" />
          {tasks.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-fg-3 tabular">
              <Icon icon={Target02Icon} size={13} />
              {done}/{tasks.length} prep {tasks.length === 1 ? "task" : "tasks"} done
            </span>
          )}
          <Button size="sm" variant="ghost" iconRight={ArrowRight01Icon} onClick={onOpen} className="text-fg-3">
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 88;
  const h = 22;
  const lo = Math.min(...values, 50);
  const hi = Math.max(...values, 100);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)]);
  const last = pts.at(-1)!;
  return (
    <svg width={w} height={h} className="overflow-visible text-fg-4">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} className={cn("tint-solid", `tint-${scoreTint(values.at(-1)!)}`)} fill="var(--tint)" stroke="var(--tint-fg)" strokeWidth={1} />
    </svg>
  );
}

function Stat({ label, value, sub, tint }: { label: string; value: ReactNode; sub?: ReactNode; tint?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-1 py-1.5">
      <span className="flex-1 text-sm text-fg-3">{label}</span>
      {sub && <span className="max-w-[110px] truncate text-xs text-fg-4">{sub}</span>}
      <span className={cn("font-display text-lg font-medium tabular", tint && `tint-${tint} tint-text`)}>{value}</span>
    </div>
  );
}

export default function ExamsPage({ params }: PageProps) {
  const { data: exams = [], isLoading } = useList("exam");
  const { data: subjectList = [] } = useList("subject", { filter: { archived: false }, order_by: "position" });
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [day, setDay] = useState<string | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const subjects = useMemo(() => Object.fromEntries(subjectList.map((s) => [s.id, s])), [subjectList]);
  const selectedId = params.exam;
  const creating = !!params.new;
  const selected = exams.find((e) => e.id === selectedId);

  const open = useCallback((id: string) => setParams({ exam: id }), []);
  const closePanel = useCallback(() => setParams({}), []);
  const closeDialog = useCallback(() => setParams(selectedId ? { exam: selectedId } : {}), [selectedId]);

  useEffect(() => {
    if (!selectedId || creating) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && !useApp.getState().paletteOpen && closePanel();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selectedId, creating, closePanel]);

  const filtered = useMemo(() => exams.filter((e) => (subjectFilter === "all" || e.subject_id === subjectFilter) && matchesKind(e.kind, kind)), [exams, subjectFilter, kind]);
  const t = today();
  const visible = day ? filtered.filter((e) => e.date === day) : filtered;
  const upcoming = visible.filter((e) => e.status === "upcoming" && e.date >= t);
  const past = visible.filter((e) => !(e.status === "upcoming" && e.date >= t)).sort((a, b) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? "")));
  const hero = day ? undefined : upcoming[0];
  const rest = day ? upcoming : upcoming.slice(1);

  const ws = weekStart();
  const thisWeekEnd = toDateStr(addDays(ws, 7));
  const nextWeekEnd = toDateStr(addDays(ws, 14));
  const groups: [string, Exam[]][] = (
    [
      ["This week", rest.filter((e) => e.date < thisWeekEnd)],
      ["Next week", rest.filter((e) => e.date >= thisWeekEnd && e.date < nextWeekEnd)],
      ["Later", rest.filter((e) => e.date >= nextWeekEnd)],
    ] as [string, Exam[]][]
  ).filter(([, xs]) => xs.length);

  const scored = filtered.filter((e) => e.status === "done" && pct(e.score, e.max_score) != null).sort((a, b) => a.date.localeCompare(b.date));
  const pcts = scored.map((e) => pct(e.score, e.max_score)!);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  const best = scored.reduce<Exam | null>((b, e) => (!b || pct(e.score, e.max_score)! > pct(b.score, b.max_score)! ? e : b), null);
  const pendingCount = filtered.filter(needsScore).length;
  const allUpcoming = filtered.filter((e) => e.status === "upcoming" && e.date >= t);
  const thisWeek = allUpcoming.filter((e) => e.date < thisWeekEnd).length;
  const recent = pcts.slice(-3);
  const before = pcts.slice(-6, -3);
  const trend = recent.length && before.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length - before.reduce((a, b) => a + b, 0) / before.length) : null;

  const defaultMax = (e: Exam) =>
    [...exams].reverse().find((x) => x.max_score != null && x.kind === e.kind && x.subject_id === e.subject_id)?.max_score ??
    [...exams].reverse().find((x) => x.max_score != null && x.kind === e.kind)?.max_score ??
    null;

  const pickDay = (d: string | null) => {
    setDay(d);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const summary = [
    allUpcoming.length ? `${allUpcoming.length} upcoming` : "Nothing scheduled",
    allUpcoming[0] && `next ${countdown(allUpcoming[0].date)}`,
    pendingCount > 0 && `${plural(pendingCount, "score")} to log`,
    avg != null && `averaging ${avg}%`,
  ].filter(Boolean);

  const row = (e: Exam, isPast = false) => (
    <ExamRow key={e.id} exam={e} subject={e.subject_id ? subjects[e.subject_id] : undefined} selected={e.id === selectedId} onOpen={() => open(e.id)} defaultMax={defaultMax(e)} past={isPast} />
  );
  const pastShown = showAllPast || day ? past : past.slice(0, 8);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Exams" }]}
        actions={
          <>
            <Select
              value={subjectFilter}
              onChange={setSubjectFilter}
              align="end"
              options={[{ value: "all", label: "All subjects" }, ...subjectList.map((s) => ({ value: s.id, label: s.name, emoji: s.icon }))]}
              className={cn(subjectFilter !== "all" && "bg-hover")}
            />
            <Segmented
              size="sm"
              value={kind}
              onChange={setKind}
              className="mx-1"
              options={[
                { value: "all", label: "All" },
                { value: "quiz", label: "Quizzes" },
                { value: "trial", label: "Trials" },
                { value: "other", label: "Other" },
              ]}
            />
            <Button variant="solid" size="sm" icon={Add01Icon} onClick={() => setParams({ ...(selectedId ? { exam: selectedId } : {}), new: "1" })}>
              New
            </Button>
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div ref={scroller} className="@container min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[1100px] gap-10 px-8 pb-16 pt-5">
            <div className="min-w-0 flex-1">
              <div className="anim-rise mb-7">
                <div className="mb-1.5 text-sm font-medium text-fg-3">{fmtFullDate()}</div>
                <h1 className="font-display text-[32px] font-normal leading-tight tracking-tight">Quizzes & trials</h1>
                <p className="mt-1 text-md text-fg-2">{summary.join(" · ")}</p>
              </div>

              {!isLoading && exams.length === 0 ? (
                <Card className="anim-rise">
                  <Empty
                    icon="🗓️"
                    title="No exams yet"
                    hint="Add your quizzes, trials and exams to get countdowns, prep tasks and a score history that shows how far you've come."
                    action={
                      <Button variant="solid" icon={Add01Icon} onClick={() => setParams({ new: "1" })}>
                        Add your first exam
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <>
                  {day && (
                    <div className="anim-rise mb-4 flex items-center gap-2 rounded-xl bg-hover py-1.5 pl-3.5 pr-1.5">
                      <Icon icon={Calendar03Icon} size={14} className="text-fg-3" />
                      <span className="flex-1 text-sm">
                        <span className="font-medium">{relativeDay(day)}</span>
                        {!/\d/.test(relativeDay(day)) && <span className="text-fg-3">, {fmtMonthDay(day)}</span>}
                        <span className="text-fg-3"> · {visible.length ? plural(visible.length, "exam") : "nothing scheduled"}</span>
                      </span>
                      <Button size="xs" variant="ghost" icon={Add01Icon} onClick={() => setParams({ new: "1", ...(selectedId ? { exam: selectedId } : {}) })}>
                        Add here
                      </Button>
                      <Button size="xs" variant="ghost" icon={Cancel01Icon} onClick={() => pickDay(null)}>
                        Clear
                      </Button>
                    </div>
                  )}

                  {hero ? (
                    <NextUp exam={hero} subject={hero.subject_id ? subjects[hero.subject_id] : undefined} defaultMax={defaultMax(hero)} onOpen={() => open(hero.id)} />
                  ) : (
                    !day && (
                      <div className="anim-rise mb-8 flex items-center gap-4 rounded-2xl px-5 py-5 shadow-[inset_0_0_0_1px_var(--color-stroke)]">
                        <div className="grid size-11 shrink-0 place-items-center rounded-xl text-[20px] tint-mint tint-bg">🌿</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-lg">Nothing coming up</div>
                          <div className="text-sm text-fg-3">{subjectFilter !== "all" || kind !== "all" ? "No upcoming exams match these filters." : "Enjoy the breathing room — or schedule the next quiz so it doesn't sneak up on you."}</div>
                        </div>
                        <Button variant="outline" icon={Add01Icon} onClick={() => setParams({ new: "1" })}>
                          Schedule
                        </Button>
                      </div>
                    )
                  )}

                  {groups.map(([label, xs], i) => (
                    <section key={label} className="anim-rise mb-6" style={{ animationDelay: `${60 + i * 30}ms` }}>
                      <SectionHead title={label} sub={xs.length} />
                      {xs.map((e) => row(e))}
                    </section>
                  ))}

                  {(past.length > 0 || !day) && (
                    <section className="anim-rise mt-2" style={{ animationDelay: "150ms" }}>
                      <SectionHead
                        title="Past"
                        sub={past.length || undefined}
                        action={
                          pcts.length > 1 && !day ? (
                            <span className="flex items-center gap-2.5">
                              <Sparkline values={pcts.slice(-12)} />
                              {trend != null && trend !== 0 && (
                                <span className={cn("text-xs font-medium tabular", trend > 0 ? "tint-mint tint-text" : "tint-rose tint-text")}>
                                  {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
                                </span>
                              )}
                            </span>
                          ) : undefined
                        }
                      />
                      {past.length ? (
                        <>
                          {pastShown.map((e) => row(e, true))}
                          {past.length > pastShown.length && (
                            <button onClick={() => setShowAllPast(true)} className="mt-1 flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-fg-3 hover:bg-hover hover:text-fg-2">
                              <Icon icon={ArrowRight01Icon} size={12} />
                              Show {past.length - pastShown.length} more
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="px-2 py-3 text-sm text-fg-3">Scores you log will collect here — a quiet record of how far you've come.</div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>

            <aside className={cn("hidden w-[272px] shrink-0", selected ? "@min-[940px]:block" : "@min-[760px]:block")}>
              <div className="sticky top-5 space-y-4">
                <Card className="anim-rise p-3" style={{ animationDelay: "60ms" }}>
                  <MonthCalendar exams={filtered} subjects={subjects} day={day} onDay={pickDay} />
                </Card>
                {filtered.length > 0 && (
                  <Card className="anim-rise px-3 py-2" style={{ animationDelay: "90ms" }}>
                    <Stat label="This week" value={thisWeek} />
                    <Stat label="Average" value={avg != null ? `${avg}%` : "—"} tint={avg != null ? scoreTint(avg) : undefined} />
                    {best && <Stat label="Best" sub={best.title} value={`${pct(best.score, best.max_score)}%`} />}
                    {pendingCount > 0 && <Stat label="Scores to log" value={pendingCount} tint="butter" />}
                  </Card>
                )}
              </div>
            </aside>
          </div>
        </div>
        {selected && <ExamDetail key={selected.id} exam={selected} subjects={subjectList} onClose={closePanel} />}
      </div>
      <ExamDialog
        open={creating}
        onClose={closeDialog}
        onCreated={(e) => setParams({ exam: e.id })}
        subjects={subjectList}
        exams={exams}
        defaults={{ subject_id: subjectFilter === "all" ? null : subjectFilter, kind: kind === "all" || kind === "other" ? "quiz" : kind, date: day && day >= t ? day : null }}
      />
    </>
  );
}
