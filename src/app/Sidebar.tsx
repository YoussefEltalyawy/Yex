import { Add01Icon, ArrowRight01Icon, Delete02Icon, Edit02Icon, Moon02Icon, PauseIcon, PlayIcon, Search01Icon, Settings01Icon, SidebarLeftIcon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { fmtClock } from "@/lib/dates";
import { useList, useOverview, useRemove } from "@/lib/query";
import { navigate, useApp } from "@/lib/store";
import type { Chapter, Lesson, Subject } from "@/lib/types";
import { cn, groupBy } from "@/lib/utils";
import { useTimerView } from "@/modules/focus/hooks";
import { PHASE_LABEL, timer } from "@/modules/focus/timer";
import { navItems } from "@/modules/registry";
import { SubjectDialog } from "@/modules/study/SubjectDialog";
import { Icon, IconButton, Kbd } from "@/ui/core";
import { Menu, useContextMenu } from "@/ui/overlay";

function NavRow({ active, icon, label, badge, onClick, collapsed, shortcut }: { active: boolean; icon: React.ReactNode; label: string; badge?: number | null; onClick: () => void; collapsed: boolean; shortcut?: string }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : shortcut ? `${label} (${shortcut})` : undefined}
      className={cn(
        "group flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-base transition-colors duration-100",
        active ? "bg-selected font-medium text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
        collapsed && "justify-center px-0",
      )}
    >
      <span className={cn("grid w-5 place-items-center", active ? "text-fg" : "text-fg-3 group-hover:text-fg-2")}>{icon}</span>
      {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
      {!collapsed && !!badge && <span className="min-w-5 rounded-md px-1 text-center text-xs font-medium text-fg-3 tabular">{badge}</span>}
    </button>
  );
}

function SubjectTree({ subject, chapters, lessons, route }: { subject: Subject; chapters: Chapter[]; lessons: Record<string, Lesson[]>; route: { name: string; params: Record<string, string> } }) {
  const open = useApp((s) => !!s.expanded[subject.id]);
  const toggle = useApp((s) => s.toggleExpanded);
  const expanded = useApp((s) => s.expanded);
  const ctx = useContextMenu();
  const [editing, setEditing] = useState(false);
  const remove = useRemove("subject", "Subject");
  const active = route.name === "subject" && route.params.id === subject.id;

  return (
    <div>
      <div
        onContextMenu={ctx.onContextMenu}
        className={cn("group flex h-8 items-center rounded-lg pr-1 transition-colors", active ? "bg-selected" : "hover:bg-hover")}
      >
        <button onClick={() => toggle(subject.id)} className="grid h-8 w-6 shrink-0 place-items-center text-fg-4 hover:text-fg-2" aria-label={open ? "Collapse" : "Expand"}>
          <Icon icon={ArrowRight01Icon} size={12} className={cn("transition-transform duration-150", open && "rotate-90")} />
        </button>
        <button onClick={() => navigate("subject", { id: subject.id })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={cn("grid size-5 shrink-0 place-items-center rounded-md text-[12px] tint-bg", `tint-${subject.color}`)}>{subject.icon}</span>
          <span className={cn("truncate text-base", active ? "font-medium text-fg" : "text-fg-2 group-hover:text-fg")} dir="auto">
            {subject.name}
          </span>
        </button>
      </div>
      {open && (
        <div className="relative ml-[17px] border-l border-stroke pl-1.5">
          {chapters.length === 0 && <div className="px-2 py-1 text-xs text-fg-4">No chapters yet</div>}
          {chapters.map((c) => {
            const chOpen = !!expanded[c.id];
            return (
              <div key={c.id}>
                <div className="group flex h-7 items-center rounded-md hover:bg-hover">
                  <button onClick={() => toggle(c.id)} className="grid h-7 w-5 shrink-0 place-items-center text-fg-4 hover:text-fg-2">
                    <Icon icon={ArrowRight01Icon} size={11} className={cn("transition-transform duration-150", chOpen && "rotate-90")} />
                  </button>
                  <button onClick={() => navigate("subject", { id: subject.id, chapter: c.id })} className="min-w-0 flex-1 truncate text-left text-sm text-fg-2 group-hover:text-fg" dir="auto">
                    {c.name}
                  </button>
                </div>
                {chOpen &&
                  (lessons[c.id] ?? []).map((l) => {
                    const on = route.name === "lesson" && route.params.id === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => navigate("lesson", { id: l.id })}
                        className={cn("flex h-7 w-full items-center gap-2 rounded-md pl-5 pr-2 text-left text-sm transition-colors", on ? "bg-selected font-medium text-fg" : "text-fg-3 hover:bg-hover hover:text-fg")}
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full", l.status === "done" || l.status === "revised" ? "bg-[var(--mint-fg)]" : l.status === "in_progress" ? "bg-[var(--butter-fg)]" : "bg-fg-4")} />
                        <span className="truncate" dir="auto">
                          {l.name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}
      <Menu
        open={ctx.open}
        onClose={ctx.close}
        anchor={ctx.anchor}
        point={ctx.point}
        items={[
          { label: "Open", icon: ArrowRight01Icon, onSelect: () => navigate("subject", { id: subject.id }) },
          { label: "Edit subject…", icon: Edit02Icon, onSelect: () => setEditing(true) },
          { separator: true, label: "" },
          { label: "Delete", icon: Delete02Icon, danger: true, onSelect: () => remove.mutate(subject.id) },
        ]}
      />
      <SubjectDialog open={editing} onClose={() => setEditing(false)} subject={subject} />
    </div>
  );
}

function MiniTimer() {
  const t = useTimerView();
  const route = useApp((s) => s.route.name);
  if (t.status === "idle" || route === "focus") return null;
  return (
    <div className="anim-rise mx-2 mb-2 flex items-center gap-2 rounded-xl bg-surface p-1.5 pl-3 shadow-card">
      <button className="min-w-0 flex-1 text-left" onClick={() => navigate("focus")}>
        <div className="text-2xs font-medium uppercase tracking-wide text-fg-3">{PHASE_LABEL[t.phase]}</div>
        <div className="font-display text-lg leading-tight tabular">{fmtClock(t.mode === "stopwatch" ? t.elapsed : t.remaining)}</div>
      </button>
      <IconButton icon={t.status === "running" ? PauseIcon : PlayIcon} label={t.status === "running" ? "Pause" : "Resume"} size="md" variant="subtle" onClick={timer.toggle} />
    </div>
  );
}

export function Sidebar() {
  const route = useApp((s) => s.route);
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const dark = useApp((s) => s.dark);
  const { data: subjects = [] } = useList("subject", { filter: { archived: false } });
  const { data: chapters = [] } = useList("chapter");
  const { data: lessons = [] } = useList("lesson", { order_by: "position, created_at" });
  const { data: ov } = useOverview();
  const [adding, setAdding] = useState(false);

  const chaptersBySubject = useMemo(() => groupBy(chapters, (c) => c.subject_id), [chapters]);
  const lessonsByChapter = useMemo(() => groupBy(lessons, (l) => l.chapter_id), [lessons]);
  const badges: Record<string, number | null> = {
    tasks: ov ? ov.tasks_today.filter((t) => !t.done).length + ov.overdue_tasks.length : null,
    exams: ov ? ov.upcoming_exams.filter((e) => e.date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).length : null,
    review: ov ? ov.mistakes_due_for_review.length : null,
  };

  return (
    <aside className={cn("flex h-full shrink-0 flex-col transition-[width] duration-200 ease-out", collapsed ? "w-[60px]" : "w-[244px]")} style={{ background: "var(--chrome-mica)" }}>
      <div data-tauri-drag-region className={cn("drag flex h-11 shrink-0 items-center gap-2", collapsed ? "justify-center" : "pl-4 pr-2")}>
        {!collapsed && (
          <div data-tauri-drag-region className="flex flex-1 items-center gap-2">
            <img src="/yex.svg" alt="" className="pointer-events-none size-[22px]" draggable={false} />
            <span data-tauri-drag-region className="text-[15px] font-semibold tracking-tight">
              YEX
            </span>
          </div>
        )}
        <IconButton icon={SidebarLeftIcon} label="Toggle sidebar (Ctrl+\)" size="sm" className="no-drag" onClick={() => useApp.getState().toggleSidebar()} />
      </div>

      <div className={cn("px-2 pb-2", collapsed && "px-2.5")}>
        <button
          onClick={() => useApp.getState().setPalette(true)}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-lg bg-surface/70 px-2.5 text-base text-fg-3 shadow-[0_0_0_1px_var(--color-stroke)] transition-colors hover:text-fg-2 dark:bg-hover",
            collapsed && "justify-center px-0",
          )}
          title="Search (Ctrl+K)"
        >
          <Icon icon={Search01Icon} size={15} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <Kbd>Ctrl K</Kbd>
            </>
          )}
        </button>
      </div>

      <nav className="space-y-px px-2">
        {navItems.map((n) => (
          <NavRow
            key={n.route}
            active={route.name === n.route}
            icon={<Icon icon={n.icon} size={17} />}
            label={n.label}
            badge={badges[n.route]}
            collapsed={collapsed}
            shortcut={n.shortcut}
            onClick={() => navigate(n.route)}
          />
        ))}
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!collapsed ? (
          <>
            <div className="group flex h-7 items-center justify-between pl-2 pr-1">
              <span className="text-xs font-medium text-fg-3">Subjects</span>
              <IconButton icon={Add01Icon} label="New subject" size="xs" className="opacity-0 group-hover:opacity-100" onClick={() => setAdding(true)} />
            </div>
            <div className="space-y-px">
              {subjects.map((s) => (
                <SubjectTree key={s.id} subject={s} chapters={chaptersBySubject[s.id] ?? []} lessons={lessonsByChapter} route={route} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            {subjects.map((s) => (
              <button
                key={s.id}
                title={s.name}
                onClick={() => navigate("subject", { id: s.id })}
                className={cn("grid size-8 place-items-center rounded-lg text-[14px] tint-bg transition-transform hover:scale-105", `tint-${s.color}`, route.params.id === s.id && "ring-2 ring-stroke-strong")}
              >
                {s.icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {!collapsed && <MiniTimer />}
      <div className={cn("flex shrink-0 items-center gap-1 px-2 pb-2.5 pt-1", collapsed && "flex-col")}>
        <NavRow active={route.name === "settings"} icon={<Icon icon={Settings01Icon} size={17} />} label="Settings" collapsed={collapsed} onClick={() => navigate("settings")} />
        <IconButton
          icon={dark ? Sun03Icon : Moon02Icon}
          label={dark ? "Light mode" : "Dark mode"}
          size="md"
          className="shrink-0"
          onClick={() => useApp.getState().setTheme(dark ? "light" : "dark")}
        />
      </div>
      <SubjectDialog open={adding} onClose={() => setAdding(false)} />
    </aside>
  );
}
