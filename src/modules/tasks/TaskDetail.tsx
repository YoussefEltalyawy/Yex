import { Calendar03Icon, Cancel01Icon, Clock01Icon, Delete02Icon, Flag02Icon, Note01Icon, PlayIcon, RepeatIcon, Book02Icon, Timer02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { fmtMinutes, relativeDay, timeAgo } from "@/lib/dates";
import { useList, useRemove, useRow, useUpdate } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Id, Priority, Repeat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { timer, useTimer } from "@/modules/focus/timer";
import { Button, Icon, IconButton } from "@/ui/core";
import { Check, DatePicker, Select } from "@/ui/overlay";
import { RichEditor } from "@/ui/RichEditor";

function Field({ icon, label, children }: { icon: typeof Flag02Icon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <div className="flex w-[104px] shrink-0 items-center gap-2 text-sm text-fg-3">
        <Icon icon={icon} size={14} />
        {label}
      </div>
      <div className="-ml-2 min-w-0 flex-1">{children}</div>
    </div>
  );
}

const PRIORITIES: { value: Priority; label: string; tint?: string }[] = [
  { value: "none", label: "None" },
  { value: "low", label: "Low", tint: "sky" },
  { value: "medium", label: "Medium", tint: "butter" },
  { value: "high", label: "High", tint: "rose" },
];
const REPEATS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every day except Friday" },
  { value: "weekly", label: "Every week" },
];

export function TaskDetail({ id, onClose }: { id: Id; onClose: () => void }) {
  const { data: task } = useRow("task", id);
  const update = useUpdate("task");
  const remove = useRemove("task", "Task");
  const { data: subjects = [] } = useList("subject");
  const { data: lessons = [] } = useList("lesson", { filter: task?.subject_id ? { subject_id: task.subject_id } : {} }, !!task);
  const { data: sessions = [] } = useList("focus_session", { filter: { task_id: id } });
  const [title, setTitle] = useState("");
  useEffect(() => setTitle(task?.title ?? ""), [task?.id, task?.title]);
  const [estimate, setEstimate] = useState("");
  useEffect(() => setEstimate(String(task?.estimate_min ?? "")), [task?.id, task?.estimate_min]);
  const focusing = useTimer((s) => s.taskId === id && s.status !== "idle");

  if (!task) return null;
  const patch = (p: Parameters<typeof update.mutate>[0]["patch"]) => update.mutate({ id, patch: p });
  const spent = sessions.reduce((a, s) => a + s.duration_sec, 0) / 60;

  return (
    <aside className="anim-sheet flex h-full w-[400px] shrink-0 flex-col border-l border-stroke bg-canvas">
      <div className="flex h-11 shrink-0 items-center gap-1 px-3">
        <span className="flex-1 text-xs font-medium text-fg-3">Task</span>
        {!task.done && (
          <Button
            size="sm"
            variant={focusing ? "subtle" : "ghost"}
            icon={focusing ? Timer02Icon : PlayIcon}
            onClick={() => {
              timer.setTask(task.id, task.subject_id);
              if (useTimer.getState().status !== "running") timer.start();
              navigate("focus");
            }}
          >
            {focusing ? "Focusing" : "Focus"}
          </Button>
        )}
        <IconButton icon={Delete02Icon} label="Delete task" onClick={() => remove.mutate(id, { onSuccess: onClose })} />
        <IconButton icon={Cancel01Icon} label="Close (Esc)" onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex items-start gap-3 pt-2">
          <Check checked={task.done} priority={task.priority} size={22} className="mt-1" onChange={(done) => patch({ done })} />
          <textarea
            dir="auto"
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && patch({ title: title.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
            className={cn("field-sizing-content min-h-0 w-full resize-none bg-transparent font-display text-[22px] font-medium leading-snug outline-none", task.done && "text-fg-3 line-through")}
          />
        </div>

        <div className="mt-5 space-y-0.5">
          <Field icon={Calendar03Icon} label="Due">
            <DatePicker value={task.due_date} onChange={(due_date) => patch({ due_date })}>
              {task.due_date ? relativeDay(task.due_date) : <span className="text-fg-3">No date</span>}
            </DatePicker>
          </Field>
          <Field icon={Flag02Icon} label="Priority">
            <Select value={task.priority} options={PRIORITIES} onChange={(priority) => patch({ priority })} />
          </Field>
          <Field icon={Clock01Icon} label="Estimate">
            <div className="flex items-center gap-1 px-2">
              <input
                type="number"
                min={0}
                step={5}
                placeholder="—"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                onBlur={() => String(task.estimate_min ?? "") !== estimate && patch({ estimate_min: estimate ? Number(estimate) : null })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="h-7 w-14 rounded-md bg-transparent text-sm tabular outline-none hover:bg-hover focus:bg-hover"
              />
              <span className="text-sm text-fg-3">min{spent > 0 && ` · ${fmtMinutes(spent)} focused`}</span>
            </div>
          </Field>
          <Field icon={RepeatIcon} label="Repeat">
            <Select value={task.repeat} options={REPEATS} onChange={(repeat) => patch({ repeat })} />
          </Field>
          <Field icon={Book02Icon} label="Subject">
            <Select
              value={task.subject_id ?? "none"}
              placeholder="None"
              options={[{ value: "none", label: "None" }, ...subjects.map((s) => ({ value: s.id, label: s.name, emoji: s.icon }))]}
              onChange={(v) => patch({ subject_id: v === "none" ? null : v, lesson_id: null })}
            />
          </Field>
          {task.subject_id && (
            <Field icon={Note01Icon} label="Lesson">
              <Select
                value={task.lesson_id ?? "none"}
                options={[{ value: "none", label: "None" }, ...lessons.map((l) => ({ value: l.id, label: l.name }))]}
                onChange={(v) => patch({ lesson_id: v === "none" ? null : v })}
              />
            </Field>
          )}
        </div>

        <div className="mt-5 border-t border-stroke pt-4">
          <RichEditor key={task.id} value={task.notes} onChange={(notes) => patch({ notes })} placeholder="Add notes, links, sub-steps…" compact />
        </div>
        <div className="mt-8 text-xs text-fg-4">
          Created {timeAgo(task.created_at)}
          {task.done_at && ` · completed ${timeAgo(task.done_at)}`}
        </div>
      </div>
    </aside>
  );
}
