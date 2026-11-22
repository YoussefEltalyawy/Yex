import { ArrowDown01Icon, CheckListIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { today } from "@/lib/dates";
import { useList } from "@/lib/query";
import { cn } from "@/lib/utils";
import { Icon } from "@/ui/core";
import { Popover, usePopover } from "@/ui/overlay";
import { timer, useTimer } from "./timer";

export function TimerRing({ progress, size = 220, stroke = 6, children, className, phase = "focus" }: { progress: number; size?: number; stroke?: number; children?: React.ReactNode; className?: string; phase?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-hover" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ stroke: phase === "focus" ? "var(--accent)" : "var(--mint-fg)", transition: "stroke-dashoffset 400ms linear" }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/** Choose which of today's (or any open) tasks the timer is tracking. */
export function TaskPicker({ className, align = "center" }: { className?: string; align?: "start" | "center" | "end" }) {
  const p = usePopover();
  const taskId = useTimer((s) => s.taskId);
  const [q, setQ] = useState("");
  const { data: open = [] } = useList("task", { filter: { done: false }, order_by: "due_date, position" });
  const { data: subjects = [] } = useList("subject");
  const current = open.find((t) => t.id === taskId);
  const t = today();
  const list = open.filter((x) => !q || x.title.toLowerCase().includes(q.toLowerCase()));
  const todays = list.filter((x) => x.due_date && x.due_date <= t);
  const later = list.filter((x) => !x.due_date || x.due_date > t);

  const row = (x: (typeof open)[number]) => {
    const s = subjects.find((s) => s.id === x.subject_id);
    return (
      <button
        key={x.id}
        onClick={() => {
          timer.setTask(x.id, x.subject_id);
          p.close();
        }}
        className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-base hover:bg-hover"
      >
        <span className="w-4 text-center text-[11px]">{s?.icon ?? "•"}</span>
        <span className="flex-1 truncate" dir="auto">
          {x.title}
        </span>
        {x.id === taskId && <Icon icon={Tick02Icon} size={14} className="text-accent" />}
      </button>
    );
  };

  return (
    <>
      <button
        ref={p.ref}
        onClick={p.toggle}
        className={cn("inline-flex h-8 max-w-[340px] items-center gap-2 rounded-full px-3.5 text-base transition-colors hover:bg-hover", p.open && "bg-hover", className)}
      >
        <Icon icon={CheckListIcon} size={15} className="text-fg-3" />
        <span className={cn("truncate", !current && "text-fg-3")} dir="auto">
          {current?.title ?? "What are you working on?"}
        </span>
        <Icon icon={ArrowDown01Icon} size={13} className="text-fg-4" />
      </button>
      <Popover open={p.open} onClose={p.close} anchor={p.ref} align={align} className="w-[320px]">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="mb-1 h-8 w-full rounded-lg bg-hover px-2.5 text-base outline-none placeholder:text-fg-4" />
        <div className="max-h-[300px] overflow-y-auto">
          {todays.length > 0 && <div className="px-2 pb-0.5 pt-1.5 text-2xs font-medium uppercase tracking-wider text-fg-4">Today</div>}
          {todays.map(row)}
          {later.length > 0 && <div className="px-2 pb-0.5 pt-1.5 text-2xs font-medium uppercase tracking-wider text-fg-4">Other open tasks</div>}
          {later.map(row)}
          {list.length === 0 && <div className="px-2 py-4 text-center text-sm text-fg-3">No open tasks</div>}
        </div>
        {taskId && (
          <button
            onClick={() => {
              timer.setTask(null);
              p.close();
            }}
            className="mt-1 h-8 w-full rounded-lg border-t border-stroke text-sm text-fg-3 hover:bg-hover"
          >
            Clear selection
          </button>
        )}
      </Popover>
    </>
  );
}
