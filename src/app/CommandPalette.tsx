import { Book02Icon, Calendar03Icon, CheckListIcon, Note01Icon, Search01Icon, AlertCircleIcon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { backend } from "@/lib/backend";
import { relativeDay } from "@/lib/dates";
import { navigate, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { commands } from "@/modules/registry";
import type { Command } from "@/modules/types";
import { Icon, Kbd } from "@/ui/core";

function useEntitySearch(q: string) {
  return useQuery({
    queryKey: ["db", "palette", q],
    enabled: q.trim().length > 0,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<Command[]> => {
      const b = backend();
      const opts = { search: q, limit: 6 };
      const [subjects, chapters, lessons, tasks, exams, mistakes] = await Promise.all([
        b.list("subject", opts),
        b.list("chapter", opts),
        b.list("lesson", opts),
        b.list("task", { ...opts, order_by: "done, -created_at" }),
        b.list("exam", { ...opts, order_by: "-date" }),
        b.list("mistake", opts),
      ]);
      return [
        ...subjects.map((s) => ({ id: s.id, label: s.name, emoji: s.icon, group: "Subjects", run: () => navigate("subject", { id: s.id }) })),
        ...lessons.map((l) => ({ id: l.id, label: l.name, icon: Note01Icon, group: "Lessons", run: () => navigate("lesson", { id: l.id }) })),
        ...chapters.map((c) => ({ id: c.id, label: c.name, icon: Book02Icon, group: "Chapters", run: () => navigate("subject", { id: c.subject_id, chapter: c.id }) })),
        ...tasks.map((t) => ({ id: t.id, label: t.title, icon: CheckListIcon, hint: t.done ? "Done" : t.due_date ? relativeDay(t.due_date) : undefined, group: "Tasks", run: () => navigate("tasks", { task: t.id }) })),
        ...exams.map((e) => ({ id: e.id, label: e.title, icon: Calendar03Icon, hint: relativeDay(e.date), group: "Exams", run: () => navigate("exams", { exam: e.id }) })),
        ...mistakes.map((m) => ({
          id: m.id,
          label: m.title || m.question.slice(0, 80),
          icon: AlertCircleIcon,
          group: "Mistakes",
          run: () => (m.lesson_id ? navigate("lesson", { id: m.lesson_id, tab: "mistakes", focus: m.id }) : navigate("review")),
        })),
      ];
    },
  });
}

export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const setOpen = useApp((s) => s.setPalette);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: found = [] } = useEntitySearch(q);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const cmds = s ? commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(s)) : commands;
    return s ? [...found, ...cmds] : cmds;
  }, [q, found]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;
  const run = (c: Command) => {
    setOpen(false);
    c.run();
  };

  let lastGroup = "";
  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[14vh] dark:bg-black/45" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="anim-pop w-[600px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="flex h-13 items-center gap-3 border-b border-stroke px-4">
          <Icon icon={Search01Icon} size={18} className="text-fg-3" />
          <input
            autoFocus
            dir="auto"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lessons, tasks, exams, mistakes… or type a command"
            className="h-13 flex-1 bg-transparent text-md outline-none placeholder:text-fg-4"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && items[active]) run(items[active]);
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[400px] overflow-y-auto p-1.5">
          {items.length === 0 && <div className="px-3 py-8 text-center text-sm text-fg-3">No results for “{q}”</div>}
          {items.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={`${c.group}-${c.id}`}>
                {header && <div className="px-2.5 pb-1 pt-2.5 text-2xs font-medium uppercase tracking-wider text-fg-4">{header}</div>}
                <button
                  data-idx={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-base", i === active ? "bg-hover text-fg" : "text-fg-2")}
                >
                  <span className="grid w-5 place-items-center text-fg-3">{c.emoji ? <span className="text-[14px]">{c.emoji}</span> : c.icon ? <Icon icon={c.icon} size={16} /> : null}</span>
                  <span className="flex-1 truncate" dir="auto">
                    {c.label}
                  </span>
                  {c.hint && <span className="text-xs text-fg-4">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-stroke px-4 py-2 text-2xs text-fg-4">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <span className="flex-1" />
          <span>Searches subjects, lessons, tasks, exams and mistakes</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
