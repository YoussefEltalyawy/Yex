import { ArrowRight01Icon, Brain02Icon, Calendar03Icon, FireIcon, PauseIcon, PlayIcon, Timer02Icon, Tick02Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { PageHeader } from "@/app/PageHeader";
import { addDays, countdown, daysUntil, fmtClock, fmtFullDate, fmtMinutes, greeting, relativeDay, startOfDay, toDateStr } from "@/lib/dates";
import { useList, useOverview, useSetting } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Exam, Subject, Task } from "@/lib/types";
import { cn, EXAM_KINDS, plural } from "@/lib/utils";
import { useNow, useTimerView } from "@/modules/focus/hooks";
import { TaskPicker, TimerRing } from "@/modules/focus/parts";
import { MODE_LABEL, PHASE_LABEL, timer } from "@/modules/focus/timer";
import type { PageProps } from "@/modules/types";
import { QuickAdd } from "@/modules/tasks/QuickAdd";
import { TaskRow } from "@/modules/tasks/TaskRow";
import { Button, Card, Icon, Progress } from "@/ui/core";
import { quoteOfTheDay } from "./quotes";

function CardHeader({ title, icon, action, sub }: { title: string; icon?: typeof Tick02Icon; action?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex h-11 items-center gap-2 px-4">
      {icon && <Icon icon={icon} size={15} className="text-fg-3" />}
      <span className="text-base font-semibold">{title}</span>
      {sub && <span className="text-sm text-fg-3">{sub}</span>}
      <div className="flex-1" />
      {action}
    </div>
  );
}

function Clock() {
  const now = useNow(1000 * 15);
  const d = new Date(now);
  return (
    <div className="text-right">
      <div className="font-display text-[56px] font-light leading-none tracking-tight tabular">
        {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

function FocusCard() {
  const t = useTimerView();
  const running = t.status === "running";
  return (
    <Card className="anim-rise flex items-center gap-5 p-4" style={{ animationDelay: "60ms" }}>
      <TimerRing progress={t.mode === "stopwatch" ? 0 : t.progress} size={112} stroke={5} phase={t.phase}>
        <div className="font-display text-[26px] leading-none tabular">{fmtClock(t.mode === "stopwatch" ? t.elapsed : t.remaining)}</div>
        <div className="mt-1 text-2xs font-medium uppercase tracking-wider text-fg-3">{PHASE_LABEL[t.phase]}</div>
      </TimerRing>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-fg-3">
          <Icon icon={Timer02Icon} size={13} /> {MODE_LABEL[t.mode]} · round {t.cycle + 1}
        </div>
        <TaskPicker className="-ml-3.5 mb-2" align="start" />
        <div className="flex items-center gap-1.5">
          <Button variant={running ? "subtle" : "accent"} icon={running ? PauseIcon : PlayIcon} onClick={timer.toggle}>
            {running ? "Pause" : t.status === "paused" ? "Resume" : "Start focus"}
          </Button>
          <Button variant="ghost" iconRight={ArrowRight01Icon} onClick={() => navigate("focus")}>
            Focus mode
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ExamItem({ exam, subject }: { exam: Exam; subject?: Subject }) {
  const n = daysUntil(exam.date);
  return (
    <button onClick={() => navigate("exams", { exam: exam.id })} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover">
      <div className={cn("flex w-11 shrink-0 flex-col items-center rounded-lg py-1 tint-bg", `tint-${subject?.color ?? "sand"}`)}>
        <span className="text-2xs font-semibold uppercase tint-text">{new Date(`${exam.date}T00:00`).toLocaleDateString("en", { month: "short" })}</span>
        <span className="font-display text-lg font-medium leading-none">{Number(exam.date.slice(8))}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-medium" dir="auto">
          {exam.title}
        </div>
        <div className="truncate text-xs text-fg-3">
          {EXAM_KINDS[exam.kind]}
          {exam.time && ` · ${exam.time}`}
          {exam.scope && ` · ${exam.scope}`}
        </div>
      </div>
      <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium", n <= 1 ? "bg-danger-soft text-danger" : n <= 3 ? "bg-[color-mix(in_srgb,var(--butter)_45%,transparent)] text-[var(--butter-fg)]" : "text-fg-3")}>
        {countdown(exam.date)}
      </span>
    </button>
  );
}

function Stat({ label, value, sub, icon, delay }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: typeof Tick02Icon; delay: number }) {
  return (
    <Card className="anim-rise p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-fg-3">
        <Icon icon={icon} size={13} /> {label}
      </div>
      <div className="mt-2 font-display text-[28px] font-medium leading-none tracking-tight tabular">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-fg-3">{sub}</div>}
    </Card>
  );
}

export default function HomePage(_: PageProps) {
  const { data: ov } = useOverview();
  const { data: subjects = [] } = useList("subject");
  const [name] = useSetting("profile.name", "");
  const [showDone, setShowDone] = useState(false);
  const since = useMemo(() => addDays(startOfDay(), -60).toISOString(), []);
  const { data: sessions = [] } = useList("focus_session", { filter: { kind: "focus", started_at: { gte: since } }, order_by: "started_at" });
  const bySubject = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const [quote, author] = quoteOfTheDay();

  const streak = useMemo(() => {
    const days = new Set(sessions.map((s) => toDateStr(new Date(s.started_at))));
    let n = 0;
    let d = startOfDay();
    if (!days.has(toDateStr(d))) d = addDays(d, -1);
    while (days.has(toDateStr(d))) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }, [sessions]);

  const tasks = ov?.tasks_today ?? [];
  const overdue = ov?.overdue_tasks ?? [];
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const pctDone = tasks.length ? (done.length / tasks.length) * 100 : 0;
  const plannedMin = open.reduce((a, t) => a + (t.estimate_min ?? 0), 0);
  const nextExam = ov?.upcoming_exams[0];
  const due = ov?.mistakes_due_for_review ?? [];

  const summary = [
    open.length ? `${plural(open.length, "task")} left today` : tasks.length ? "All of today's tasks are done ✨" : "Nothing planned yet",
    nextExam && `${nextExam.title} ${relativeDay(nextExam.date).toLowerCase() === "today" ? "is today" : countdown(nextExam.date)}`,
  ].filter(Boolean);

  const renderTask = (t: Task) => <TaskRow key={t.id} task={t} subject={t.subject_id ? bySubject[t.subject_id] : undefined} showDate={false} onOpen={() => navigate("tasks", { task: t.id })} compact />;

  return (
    <>
      <PageHeader crumbs={[{ label: "Home" }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1120px] px-8 pb-16 pt-6">
          <section className="anim-rise mb-8 flex items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-2 text-sm font-medium text-fg-3">{fmtFullDate()}</div>
              <h1 className="font-display text-[40px] font-normal leading-[1.1] tracking-tight">
                {greeting()}
                {name ? `, ${name}` : ""}.
              </h1>
              <p className="mt-2 text-md text-fg-2">{summary.join(" · ")}</p>
            </div>
            <Clock />
          </section>

          <div className="grid grid-cols-12 gap-4">
            <Card className="anim-rise col-span-12 flex flex-col lg:col-span-7" style={{ animationDelay: "30ms" }}>
              <CardHeader
                title="Today"
                icon={Tick02Icon}
                sub={tasks.length > 0 && `${done.length}/${tasks.length}${plannedMin ? ` · ${fmtMinutes(plannedMin)} planned` : ""}`}
                action={
                  <Button size="sm" variant="ghost" iconRight={ArrowRight01Icon} onClick={() => navigate("tasks")}>
                    All tasks
                  </Button>
                }
              />
              {tasks.length > 0 && <Progress value={pctDone} className="mx-4 mb-2" />}
              <div className="flex-1 px-1.5 pb-2">
                <QuickAdd defaults={{ due_date: ov?.today }} placeholder="Add a task for today… (try “45m !high #physics”)" />
                {overdue.length > 0 && (
                  <>
                    <div className="px-2.5 pb-0.5 pt-2.5 text-xs font-medium text-danger">Overdue</div>
                    {overdue.map((t) => (
                      <TaskRow key={t.id} task={t} subject={t.subject_id ? bySubject[t.subject_id] : undefined} onOpen={() => navigate("tasks", { task: t.id })} compact />
                    ))}
                    {open.length > 0 && <div className="px-2.5 pb-0.5 pt-2.5 text-xs font-medium text-fg-3">Today</div>}
                  </>
                )}
                {open.map(renderTask)}
                {tasks.length === 0 && overdue.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-fg-3">A clear day. Add what you want to get done — or pull something from your task list.</div>
                )}
                {done.length > 0 && (
                  <button onClick={() => setShowDone((v) => !v)} className="mt-1 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-fg-3 hover:bg-hover hover:text-fg-2">
                    <Icon icon={ArrowRight01Icon} size={12} className={cn("transition-transform", showDone && "rotate-90")} />
                    {done.length} completed
                  </button>
                )}
                {showDone && done.map(renderTask)}
              </div>
            </Card>

            <div className="col-span-12 flex flex-col gap-4 lg:col-span-5">
              <FocusCard />
              <Card className="anim-rise" style={{ animationDelay: "90ms" }}>
                <CardHeader
                  title="Coming up"
                  icon={Calendar03Icon}
                  action={
                    <Button size="sm" variant="ghost" iconRight={ArrowRight01Icon} onClick={() => navigate("exams")}>
                      Exams
                    </Button>
                  }
                />
                <div className="px-2 pb-2">
                  {(ov?.upcoming_exams ?? []).slice(0, 4).map((e) => (
                    <ExamItem key={e.id} exam={e} subject={e.subject_id ? bySubject[e.subject_id] : undefined} />
                  ))}
                  {ov && ov.upcoming_exams.length === 0 && <div className="px-2 pb-4 pt-1 text-sm text-fg-3">No quizzes or trials in the next 3 weeks.</div>}
                </div>
              </Card>
              <Card className="anim-rise flex items-center gap-4 p-4" style={{ animationDelay: "120ms" }}>
                <div className="grid size-11 shrink-0 place-items-center rounded-xl text-[20px] tint-lilac tint-bg">🧠</div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold">{due.length ? `${plural(due.length, "mistake")} to review` : "Reviews done"}</div>
                  <div className="text-sm text-fg-3">{due.length ? "Spaced review keeps them from coming back." : "Nothing due today — nice."}</div>
                </div>
                <Button variant={due.length ? "solid" : "outline"} size="md" icon={Brain02Icon} onClick={() => navigate("review")} disabled={!due.length}>
                  Review
                </Button>
              </Card>
            </div>

            <div className="col-span-12 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Focus today" value={fmtMinutes(ov?.focus_minutes_today ?? 0)} sub={`${sessions.filter((s) => s.started_at >= startOfDay().toISOString()).length} sessions`} icon={Timer02Icon} delay={150} />
              <Stat label="Last 7 days" value={fmtMinutes(ov?.focus_minutes_last_7_days ?? 0)} sub={`≈ ${fmtMinutes((ov?.focus_minutes_last_7_days ?? 0) / 7)} / day`} icon={Clock01Icon} delay={180} />
              <Stat label="Streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} sub={streak ? "Keep it alive today" : "Start one with a session"} icon={FireIcon} delay={210} />
              <Stat label="Tasks done" value={`${done.length}/${tasks.length}`} sub="today" icon={Tick02Icon} delay={240} />
            </div>
          </div>

          <figure className="anim-rise mx-auto mt-10 max-w-[560px] text-center" style={{ animationDelay: "280ms" }}>
            <blockquote className="font-display text-lg italic text-fg-2" dir="auto">
              “{quote}”
            </blockquote>
            <figcaption className="mt-1 text-xs text-fg-4">{author}</figcaption>
          </figure>
        </div>
      </div>
    </>
  );
}
