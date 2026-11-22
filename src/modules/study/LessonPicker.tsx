import { ArrowDown01Icon, Note01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { useList } from "@/lib/query";
import type { Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Icon } from "@/ui/core";
import { Popover, usePopover } from "@/ui/overlay";

/** Searchable "Subject › Chapter › Lesson" picker. */
export function LessonPicker({ value, onChange, className }: { value: Id | null; onChange: (id: Id | null) => void; className?: string }) {
  const p = usePopover();
  const [q, setQ] = useState("");
  const { data: lessons = [] } = useList("lesson", { order_by: "position, created_at" });
  const { data: chapters = [] } = useList("chapter");
  const { data: subjects = [] } = useList("subject");
  const rows = useMemo(
    () =>
      lessons.map((l) => {
        const c = chapters.find((x) => x.id === l.chapter_id);
        const s = subjects.find((x) => x.id === l.subject_id);
        return { l, c, s, text: `${s?.name ?? ""} ${c?.name ?? ""} ${l.name}`.toLowerCase() };
      }),
    [lessons, chapters, subjects],
  );
  const cur = rows.find((r) => r.l.id === value);
  const shown = rows.filter((r) => !q || q.toLowerCase().split(/\s+/).every((w) => r.text.includes(w))).slice(0, 60);

  return (
    <>
      <button
        ref={p.ref}
        onClick={p.toggle}
        className={cn("inline-flex h-8 min-w-0 max-w-[280px] items-center gap-2 rounded-lg px-2.5 text-sm shadow-[inset_0_0_0_1px_var(--color-stroke-strong)] transition-colors hover:bg-hover", className)}
      >
        {cur ? <span className="text-[12px]">{cur.s?.icon}</span> : <Icon icon={Note01Icon} size={14} className="text-fg-3" />}
        <span className={cn("truncate", !cur && "text-fg-3")} dir="auto">
          {cur ? cur.l.name : "Choose lesson"}
        </span>
        <Icon icon={ArrowDown01Icon} size={12} className="shrink-0 text-fg-4" />
      </button>
      <Popover open={p.open} onClose={p.close} anchor={p.ref} className="w-[340px]">
        <input autoFocus dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons…" className="mb-1 h-8 w-full rounded-lg bg-hover px-2.5 text-base outline-none placeholder:text-fg-4" />
        <div className="max-h-[280px] overflow-y-auto">
          <button onClick={() => (onChange(null), p.close())} className="flex h-8 w-full items-center rounded-lg px-2 text-left text-sm text-fg-3 hover:bg-hover">
            No lesson
          </button>
          {shown.map(({ l, c, s }) => (
            <button key={l.id} onClick={() => (onChange(l.id), p.close())} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover">
              <span className="w-4 text-center text-[12px]">{s?.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base" dir="auto">{l.name}</span>
                <span className="block truncate text-xs text-fg-3" dir="auto">{[s?.name, c?.name].filter(Boolean).join(" › ")}</span>
              </span>
              {l.id === value && <Icon icon={Tick02Icon} size={14} className="text-accent" />}
            </button>
          ))}
          {shown.length === 0 && <div className="px-2 py-4 text-center text-sm text-fg-3">No matching lessons</div>}
        </div>
      </Popover>
    </>
  );
}
