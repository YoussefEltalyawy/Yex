import { Add01Icon, Brain02Icon, Delete02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/PageHeader";
import { timeAgo } from "@/lib/dates";
import { useList, useRemove, useRow, useUpdate } from "@/lib/query";
import { navigate, useApp } from "@/lib/store";
import type { MistakeStatus, Progress } from "@/lib/types";
import { cn, PROGRESS_LABEL } from "@/lib/utils";
import type { PageProps } from "@/modules/types";
import { Button, Empty, IconButton } from "@/ui/core";
import { Menu, Segmented, Select, usePopover } from "@/ui/overlay";
import { RichEditor } from "@/ui/RichEditor";
import { MistakeCard, MistakeEditor } from "./mistakes";

export const PROGRESS_OPTIONS = (Object.keys(PROGRESS_LABEL) as Progress[]).map((v) => ({
  value: v,
  label: PROGRESS_LABEL[v],
  tint: v === "not_started" ? "sand" : v === "in_progress" ? "butter" : v === "done" ? "mint" : "sky",
}));

function Tabs({ value, onChange, count }: { value: string; onChange: (v: string) => void; count: number }) {
  const tab = (id: string, label: React.ReactNode) => (
    <button
      onClick={() => onChange(id)}
      className={cn("relative h-10 px-1 text-base font-medium transition-colors", value === id ? "text-fg" : "text-fg-3 hover:text-fg-2")}
    >
      {label}
      <span className={cn("absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-fg transition-opacity", value === id ? "opacity-100" : "opacity-0")} />
    </button>
  );
  return (
    <div className="flex gap-6 border-b border-stroke">
      {tab("notes", "Notes")}
      {tab(
        "mistakes",
        <span className="flex items-center gap-1.5">
          Mistakes
          {count > 0 && <span className="rounded-md bg-hover px-1.5 text-xs tabular text-fg-2">{count}</span>}
        </span>,
      )}
    </div>
  );
}

export default function LessonPage({ params }: PageProps) {
  const { data: lesson, isLoading } = useRow("lesson", params.id);
  const { data: chapter } = useRow("chapter", lesson?.chapter_id);
  const { data: subject } = useRow("subject", lesson?.subject_id);
  const { data: mistakes = [] } = useList("mistake", { filter: { lesson_id: params.id } });
  const update = useUpdate("lesson");
  const remove = useRemove("lesson", "Lesson");
  const menu = usePopover();
  const [tab, setTab] = useState(params.tab === "mistakes" ? "mistakes" : "notes");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | MistakeStatus>("all");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  useEffect(() => setName(lesson?.name ?? ""), [lesson?.name]);
  useEffect(() => setTab(params.tab === "mistakes" ? "mistakes" : "notes"), [params.tab]);
  useEffect(() => {
    if (params.focus) setTimeout(() => document.getElementById(`m-${params.focus}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
  }, [params.focus, mistakes.length]);

  const shown = useMemo(() => (filter === "all" ? mistakes : mistakes.filter((m) => m.status === filter)), [mistakes, filter]);
  const due = mistakes.filter((m) => m.status !== "mastered").length;

  if (!lesson) return <PageHeader crumbs={[{ label: isLoading ? "" : "Lesson not found" }]} />;

  const switchTab = (t: string) => {
    setTab(t);
    useApp.getState().navigate("lesson", { id: lesson.id, ...(t === "mistakes" ? { tab: t } : {}) }, { replace: true });
  };

  return (
    <>
      <PageHeader
        crumbs={[
          ...(subject ? [{ label: subject.name, emoji: subject.icon, route: ["subject", { id: subject.id }] as [string, Record<string, string>] }] : []),
          ...(chapter ? [{ label: chapter.name, route: ["subject", { id: chapter.subject_id, chapter: chapter.id }] as [string, Record<string, string>] }] : []),
          { label: lesson.name },
        ]}
        actions={
          <>
            <span className={cn("mr-2 text-xs text-fg-4 transition-opacity duration-500", tab === "notes" && saved ? "opacity-100" : "opacity-0")}>Saved</span>
            <Select value={lesson.status} options={PROGRESS_OPTIONS} onChange={(status) => update.mutate({ id: lesson.id, patch: { status } })} align="end" />
            <IconButton ref={menu.ref} icon={MoreHorizontalIcon} label="More" onClick={menu.toggle} />
            <Menu
              open={menu.open}
              onClose={menu.close}
              anchor={menu.ref}
              align="end"
              items={[{ label: "Delete lesson", icon: Delete02Icon, danger: true, onSelect: () => remove.mutate(lesson.id, { onSuccess: () => navigate("subject", { id: lesson.subject_id ?? "" }) }) }]}
            />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[780px] px-10 pb-24 pt-6">
          <div className="anim-rise">
            <div className="mb-1 text-sm text-fg-3" dir="auto">
              {chapter?.name}
              {lesson.notes_updated_at && ` · edited ${timeAgo(lesson.notes_updated_at)}`}
            </div>
            <input
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== lesson.name && update.mutate({ id: lesson.id, patch: { name: name.trim() } })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full bg-transparent font-display text-[34px] font-medium leading-tight tracking-tight outline-none"
            />
          </div>
          <div className="mb-6 mt-4">
            <Tabs value={tab} onChange={switchTab} count={mistakes.length} />
          </div>

          {tab === "notes" ? (
            <RichEditor
              key={lesson.id}
              value={lesson.notes}
              onChange={(notes) => update.mutate({ id: lesson.id, patch: { notes } }, { onSuccess: () => setSaved(true) })}
              placeholder="Start your lesson notes… Use # for headings, - for lists, [ ] for checklists. Paste images directly."
              className="min-h-[50vh]"
            />
          ) : (
            <div className="anim-fade">
              <div className="mb-4 flex items-center gap-2">
                <Segmented
                  size="sm"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: `All ${mistakes.length}` },
                    { value: "open", label: "New" },
                    { value: "reviewing", label: "Reviewing" },
                    { value: "mastered", label: "Mastered" },
                  ]}
                />
                <div className="flex-1" />
                {due > 0 && (
                  <Button size="sm" variant="ghost" icon={Brain02Icon} onClick={() => navigate("review", { lesson: lesson.id })}>
                    Review {due}
                  </Button>
                )}
                <Button size="sm" variant="solid" icon={Add01Icon} onClick={() => setAdding(true)}>
                  Log mistake
                </Button>
              </div>
              <div className="space-y-3">
                {shown.map((m) => (
                  <MistakeCard key={m.id} m={m} highlight={m.id === params.focus} />
                ))}
              </div>
              {mistakes.length === 0 && (
                <Empty
                  icon="🎯"
                  title="No mistakes logged yet"
                  hint="Every question you get wrong is a free lesson. Log it here with the right answer and the key idea — YEX will bring it back for review."
                  action={
                    <Button variant="solid" icon={Add01Icon} onClick={() => setAdding(true)}>
                      Log your first mistake
                    </Button>
                  }
                />
              )}
              {mistakes.length > 0 && shown.length === 0 && <div className="py-10 text-center text-sm text-fg-3">No mistakes with this status.</div>}
            </div>
          )}
        </div>
      </div>
      <MistakeEditor open={adding} onClose={() => setAdding(false)} lessonId={lesson.id} />
    </>
  );
}
