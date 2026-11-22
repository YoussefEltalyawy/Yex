import { Calendar03Icon, Clock01Icon, Delete02Icon, Edit02Icon, MoreHorizontalIcon, PlayIcon, RepeatIcon, Timer02Icon } from "@hugeicons/core-free-icons";
import { useRef } from "react";
import { daysUntil, fmtMinutes, relativeDay, today } from "@/lib/dates";
import { useRemove, useUpdate } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Subject, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { timer, useTimer } from "@/modules/focus/timer";
import { Icon, IconButton } from "@/ui/core";
import { Check, Menu, usePopover } from "@/ui/overlay";

export function TaskRow({ task, subject, onOpen, showDate = true, compact, selected }: { task: Task; subject?: Subject; onOpen?: (t: Task) => void; showDate?: boolean; compact?: boolean; selected?: boolean }) {
  const update = useUpdate("task");
  const remove = useRemove("task", "Task");
  const menu = usePopover();
  const focusing = useTimer((s) => s.taskId === task.id && s.status !== "idle");
  const rowRef = useRef<HTMLDivElement>(null);
  const overdue = !task.done && task.due_date && task.due_date < today();

  const startFocus = () => {
    timer.setTask(task.id, task.subject_id);
    if (useTimer.getState().status !== "running") timer.start();
    navigate("focus");
  };

  return (
    <div
      ref={rowRef}
      onClick={() => onOpen?.(task)}
      onContextMenu={(e) => {
        e.preventDefault();
        menu.setOpen(true);
      }}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg px-2.5 transition-colors duration-100",
        compact ? "py-[7px]" : "py-2",
        selected ? "bg-selected" : "hover:bg-hover",
        onOpen && "cursor-default",
      )}
    >
      <Check checked={task.done} priority={task.priority} onChange={(done) => update.mutate({ id: task.id, patch: { done } })} className="mt-px" />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-base leading-[19px] transition-colors", task.done ? "text-fg-3 line-through decoration-fg-4" : "text-fg")} dir="auto">
          {task.title}
        </div>
        {(subject || (showDate && task.due_date) || task.estimate_min || task.repeat !== "none" || focusing) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-fg-3">
            {focusing && (
              <span className="flex items-center gap-1 font-medium text-accent">
                <Icon icon={Timer02Icon} size={12} /> Focusing
              </span>
            )}
            {subject && (
              <span className={cn("flex items-center gap-1 tint-text", `tint-${subject.color}`)}>
                <span className="text-[10px]">{subject.icon}</span>
                {subject.name}
              </span>
            )}
            {showDate && task.due_date && (
              <span className={cn("flex items-center gap-1", overdue && "text-danger")}>
                <Icon icon={Calendar03Icon} size={12} />
                {overdue && daysUntil(task.due_date) < -1 ? `${-daysUntil(task.due_date)} days overdue` : relativeDay(task.due_date)}
              </span>
            )}
            {!!task.estimate_min && (
              <span className="flex items-center gap-1">
                <Icon icon={Clock01Icon} size={12} />
                {fmtMinutes(task.estimate_min)}
              </span>
            )}
            {task.repeat !== "none" && (
              <span className="flex items-center gap-1">
                <Icon icon={RepeatIcon} size={12} />
                {task.repeat}
              </span>
            )}
          </div>
        )}
      </div>
      <div className={cn("flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100", menu.open && "opacity-100")} onClick={(e) => e.stopPropagation()}>
        {!task.done && <IconButton icon={PlayIcon} label="Focus on this" size="xs" onClick={startFocus} />}
        <IconButton ref={menu.ref} icon={MoreHorizontalIcon} label="More" size="xs" onClick={menu.toggle} />
      </div>
      <Menu
        open={menu.open}
        onClose={menu.close}
        anchor={menu.ref}
        align="end"
        items={[
          { label: "Focus on this", icon: PlayIcon, onSelect: startFocus, disabled: task.done },
          ...(onOpen ? [{ label: "Edit details", icon: Edit02Icon, onSelect: () => onOpen(task) }] : []),
          { label: "Move to today", icon: Calendar03Icon, onSelect: () => update.mutate({ id: task.id, patch: { due_date: today() } }), disabled: task.due_date === today() },
          { separator: true, label: "" },
          { label: "Delete", icon: Delete02Icon, danger: true, onSelect: () => remove.mutate(task.id) },
        ]}
      />
    </div>
  );
}
