import { useEffect, useMemo, useRef } from "react";
import { PageHeader } from "@/app/PageHeader";
import { addDays, daysUntil, relativeDay, toDateStr, today, weekStart } from "@/lib/dates";
import { useList } from "@/lib/query";
import { navigate, useApp } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import type { PageProps } from "@/modules/types";
import { Empty } from "@/ui/core";
import { Segmented } from "@/ui/overlay";
import { QuickAdd } from "./QuickAdd";
import { TaskDetail } from "./TaskDetail";
import { TaskRow } from "./TaskRow";

type View = "today" | "upcoming" | "inbox" | "all" | "done";
const VIEWS: { value: View; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "inbox", label: "No date" },
  { value: "all", label: "All" },
  { value: "done", label: "Completed" },
];

function groupFor(view: View, t: Task): string {
  const td = today();
  if (view === "done") return t.done_at ? relativeDay(toDateStr(new Date(t.done_at))) : "Earlier";
  if (!t.due_date) return "No date";
  if (t.due_date < td) return "Overdue";
  const n = daysUntil(t.due_date);
  if (n <= 1) return relativeDay(t.due_date);
  const nextWeek = toDateStr(addDays(weekStart(), 7));
  if (t.due_date < nextWeek) return relativeDay(t.due_date);
  if (t.due_date < toDateStr(addDays(weekStart(), 14))) return "Next week";
  return "Later";
}

export default function TasksPage({ params }: PageProps) {
  const view = (params.view as View) || "today";
  const selected = params.task;
  const addRef = useRef<HTMLInputElement>(null);
  const td = today();
  const { data: subjects = [] } = useList("subject");
  const query = useMemo(() => {
    switch (view) {
      case "today":
        return { filter: { due_date: { lte: td } }, order_by: "done, due_date, position, created_at" };
      case "upcoming":
        return { filter: { done: false, due_date: { gte: td } }, order_by: "due_date, position, created_at" };
      case "inbox":
        return { filter: { done: false, due_date: null }, order_by: "position, created_at" };
      case "done":
        return { filter: { done: true }, order_by: "-done_at", limit: 200 };
      default:
        return { filter: { done: false }, order_by: "due_date, position, created_at" };
    }
  }, [view, td]);
  const { data: tasks = [], isLoading } = useList("task", query);
  const visible = view === "today" ? tasks.filter((t) => !t.done || t.due_date === td) : tasks;

  const groups = useMemo(() => {
    const out: [string, Task[]][] = [];
    for (const t of visible) {
      const g = view === "today" ? (t.due_date! < td && !t.done ? "Overdue" : "Today") : groupFor(view, t);
      const last = out.at(-1);
      if (last && last[0] === g) last[1].push(t);
      else {
        const existing = out.find(([k]) => k === g);
        if (existing) existing[1].push(t);
        else out.push([g, [t]]);
      }
    }
    return out;
  }, [visible, view, td]);

  useEffect(() => {
    if (params.new) addRef.current?.focus();
  }, [params.new]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && selected && !(e.target as HTMLElement).closest("input, textarea, [contenteditable='true']") && setParam({ task: undefined });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setParam = (p: Record<string, string | undefined>) => {
    const next = Object.fromEntries(Object.entries({ ...useApp.getState().route.params, ...p }).filter(([k, v]) => v !== undefined && k !== "new")) as Record<string, string>;
    navigate("tasks", next);
  };
  const bySubject = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const defaults = view === "today" ? { due_date: td } : {};
  const openCount = visible.filter((t) => !t.done).length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Tasks" }]}
        actions={<Segmented value={view} options={VIEWS} onChange={(v) => setParam({ view: v, task: undefined })} size="sm" />}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[720px] px-8 pb-20 pt-5">
            <div className="anim-rise mb-5 flex items-baseline gap-3">
              <h1 className="font-display text-[30px] font-medium tracking-tight">{VIEWS.find((v) => v.value === view)!.label}</h1>
              <span className="text-base text-fg-3">{view === "done" ? plural(visible.length, "task") : `${plural(openCount, "open task")}`}</span>
            </div>
            {view !== "done" && <QuickAdd ref={addRef} defaults={defaults} className="mb-3" placeholder={view === "today" ? "Add a task for today…" : "Add a task… (try “tomorrow 30m !high #math”)"} />}
            {!isLoading && visible.length === 0 && (
              <Empty
                icon={view === "done" ? "🌱" : "☀️"}
                title={view === "done" ? "Nothing completed yet" : view === "today" ? "Your day is clear" : "Nothing here"}
                hint={view === "done" ? "Finished tasks will collect here." : "Type above and press Enter. Natural language works: “Solve physics sheet tomorrow 45m !high”."}
              />
            )}
            {groups.map(([g, items]) => (
              <section key={g} className="mb-4">
                <div className={cn("flex h-8 items-center gap-2 px-2.5 text-xs font-semibold", g === "Overdue" ? "text-danger" : "text-fg-3")}>
                  {g}
                  <span className="font-normal text-fg-4">{items.length}</span>
                </div>
                {items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    subject={t.subject_id ? bySubject[t.subject_id] : undefined}
                    showDate={view === "all" || view === "inbox" || g === "Overdue"}
                    selected={t.id === selected}
                    onOpen={(x) => setParam({ task: x.id === selected ? undefined : x.id })}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
        {selected && <TaskDetail key={selected} id={selected} onClose={() => setParam({ task: undefined })} />}
      </div>
    </>
  );
}
