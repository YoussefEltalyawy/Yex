import { Add01Icon, Calendar03Icon, Clock01Icon, Flag02Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { forwardRef, useMemo, useState } from "react";
import { fmtMinutes, relativeDay } from "@/lib/dates";
import { useCreate, useList } from "@/lib/query";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Icon } from "@/ui/core";
import { parseQuickTask } from "./parse";

/** Natural-language task input: "Revise limits tomorrow 45m !high #math". */
export const QuickAdd = forwardRef<HTMLInputElement, { defaults?: Partial<Task>; placeholder?: string; className?: string; onCreated?: (t: Task) => void }>(function QuickAdd(
  { defaults, placeholder = "Add a task…", className, onCreated },
  ref,
) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const { data: subjects = [] } = useList("subject");
  const create = useCreate("task");
  const parsed = useMemo(() => parseQuickTask(text, subjects), [text, subjects]);
  const subject = subjects.find((s) => s.id === parsed.subject_id);
  const chips = [
    parsed.due_date && { icon: Calendar03Icon, label: relativeDay(parsed.due_date) },
    parsed.estimate_min && { icon: Clock01Icon, label: fmtMinutes(parsed.estimate_min) },
    parsed.priority && { icon: Flag02Icon, label: parsed.priority },
    parsed.repeat && { icon: RepeatIcon, label: parsed.repeat },
  ].filter(Boolean) as { icon: typeof Add01Icon; label: string }[];

  const submit = async () => {
    if (!parsed.title) return;
    const { title, ...rest } = parsed;
    const t = await create.mutateAsync({ ...defaults, ...rest, title });
    setText("");
    onCreated?.(t);
  };

  return (
    <div className={cn("rounded-lg transition-colors", focused ? "bg-surface shadow-[0_0_0_1px_var(--color-stroke-strong)]" : "hover:bg-hover", className)}>
      <div className="flex h-9 items-center gap-3 px-2.5">
        <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-full", focused ? "text-accent" : "text-fg-3")}>
          <Icon icon={Add01Icon} size={16} strokeWidth={2} />
        </span>
        <input
          ref={ref}
          dir="auto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              if (text) setText("");
              else (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={placeholder}
          className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-fg-3"
        />
      </div>
      {focused && text && (chips.length > 0 || subject) && (
        <div className="anim-fade flex flex-wrap gap-1 px-2.5 pb-2 pl-[38px]">
          {subject && <span className={cn("flex h-5 items-center gap-1 rounded-md px-1.5 text-xs tint-bg tint-text", `tint-${subject.color}`)}>{subject.icon} {subject.name}</span>}
          {chips.map((c) => (
            <span key={c.label} className="flex h-5 items-center gap-1 rounded-md bg-accent-soft px-1.5 text-xs font-medium capitalize text-accent">
              <Icon icon={c.icon} size={11} /> {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
