import { Add01Icon, ArrowRight01Icon, Brain02Icon, Delete02Icon, Edit02Icon, MoreHorizontalIcon, Note01Icon, AlertCircleIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/app/PageHeader";
import { countdown, today } from "@/lib/dates";
import { useCreate, useList, useRemove, useRow, useUpdate } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Chapter, Lesson, Mistake, Progress as P } from "@/lib/types";
import { cn, EXAM_KINDS, groupBy, pct, plural } from "@/lib/utils";
import type { PageProps } from "@/modules/types";
import { BareInput, Button, Card, Empty, Icon, IconButton, Progress } from "@/ui/core";
import { Menu, Select, usePopover } from "@/ui/overlay";
import { PROGRESS_OPTIONS } from "./LessonPage";
import { goToMistake, KIND_TINT } from "./mistakes";
import { SubjectDialog } from "./SubjectDialog";

const NEXT_STATUS: Record<P, P> = { not_started: "in_progress", in_progress: "done", done: "revised", revised: "not_started" };
const STATUS_DOT: Record<P, string> = {
  not_started: "shadow-[inset_0_0_0_1.5px_var(--color-fg-4)]",
  in_progress: "bg-[conic-gradient(var(--butter-fg)_0_50%,transparent_50%)] shadow-[inset_0_0_0_1.5px_var(--butter-fg)]",
  done: "bg-[var(--mint-fg)]",
  revised: "bg-[var(--sky-fg)]",
};

function LessonRow({ lesson, mistakes }: { lesson: Lesson; mistakes: Mistake[] }) {
  const update = useUpdate("lesson");
  const open = mistakes.filter((m) => m.status !== "mastered").length;
  return (
    <div className="group flex h-10 items-center gap-3 rounded-lg px-3 transition-colors hover:bg-hover">
      <button
        title={`${PROGRESS_OPTIONS.find((o) => o.value === lesson.status)?.label} — click to advance`}
        onClick={() => update.mutate({ id: lesson.id, patch: { status: NEXT_STATUS[lesson.status] } })}
        className={cn("size-3.5 shrink-0 rounded-full transition-transform hover:scale-125", STATUS_DOT[lesson.status])}
      />
      <button onClick={() => navigate("lesson", { id: lesson.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="truncate text-base" dir="auto">
          {lesson.name}
        </span>
        {lesson.notes && <Icon icon={Note01Icon} size={13} className="shrink-0 text-fg-4" />}
        <span className="flex-1" />
        {mistakes.length > 0 && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigate("lesson", { id: lesson.id, tab: "mistakes" });
            }}
            className={cn("flex h-5 items-center gap-1 rounded-md px-1.5 text-xs font-medium tabular", open ? "bg-[color-mix(in_srgb,var(--rose)_35%,transparent)] text-[var(--rose-fg)]" : "text-fg-4")}
          >
            <Icon icon={AlertCircleIcon} size={11} />
            {open || mistakes.length}
          </span>
        )}
        <Icon icon={ArrowRight01Icon} size={14} className="text-fg-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </div>
  );
}

function ChapterCard({ chapter, lessons, mistakes, highlight }: { chapter: Chapter; lessons: Lesson[]; mistakes: Record<string, Mistake[]>; highlight: boolean }) {
  const update = useUpdate("chapter");
  const remove = useRemove("chapter", "Chapter");
  const createLesson = useCreate("lesson");
  const menu = usePopover();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(chapter.name);
  const [newLesson, setNewLesson] = useState("");
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const done = lessons.filter((l) => l.status === "done" || l.status === "revised").length;

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [highlight]);

  const addLesson = async () => {
    if (!newLesson.trim()) return setAdding(false);
    await createLesson.mutateAsync({ chapter_id: chapter.id, name: newLesson.trim(), position: (lessons.at(-1)?.position ?? -1) + 1 });
    setNewLesson("");
  };

  return (
    <div ref={ref} className="scroll-mt-4">
      <Card className={cn("anim-rise overflow-hidden transition-shadow", highlight && "ring-2 ring-accent/30")}>
        <div className="group flex items-center gap-3 px-4 pb-2 pt-3.5">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <BareInput
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  setRenaming(false);
                  if (name.trim() && name !== chapter.name) update.mutate({ id: chapter.id, patch: { name: name.trim() } });
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="text-md font-semibold"
              />
            ) : (
              <h3 className="truncate text-md font-semibold" dir="auto" onDoubleClick={() => setRenaming(true)}>
                {chapter.name}
              </h3>
            )}
            <div className="mt-0.5 text-xs text-fg-3">
              {lessons.length ? `${done} of ${plural(lessons.length, "lesson")} done` : "No lessons yet"}
            </div>
          </div>
          <Select value={chapter.status} options={PROGRESS_OPTIONS} onChange={(status) => update.mutate({ id: chapter.id, patch: { status } })} align="end" />
          <IconButton ref={menu.ref} icon={MoreHorizontalIcon} label="Chapter options" size="sm" onClick={menu.toggle} />
          <Menu
            open={menu.open}
            onClose={menu.close}
            anchor={menu.ref}
            align="end"
            items={[
              { label: "Rename", icon: Edit02Icon, onSelect: () => setRenaming(true) },
              { label: "Add lesson", icon: Add01Icon, onSelect: () => setAdding(true) },
              { separator: true, label: "" },
              { label: "Delete chapter", icon: Delete02Icon, danger: true, onSelect: () => remove.mutate(chapter.id) },
            ]}
          />
        </div>
        {lessons.length > 0 && <Progress value={(done / lessons.length) * 100} className="mx-4 mb-2 h-1" />}
        <div className="px-1.5 pb-1.5">
          {lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} mistakes={mistakes[l.id] ?? []} />
          ))}
          {adding ? (
            <div className="flex h-10 items-center gap-3 px-3">
              <span className="size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-fg-4)]" />
              <BareInput
                autoFocus
                placeholder="Lesson name — Enter to add, Esc to stop"
                value={newLesson}
                onChange={(e) => setNewLesson(e.target.value)}
                onBlur={() => !newLesson && setAdding(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLesson();
                  if (e.key === "Escape") setAdding(false);
                }}
                className="text-base"
              />
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-fg-3 transition-colors hover:bg-hover hover:text-fg-2">
              <Icon icon={Add01Icon} size={14} />
              Add lesson
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function SubjectPage({ params }: PageProps) {
  const { data: subject, isLoading } = useRow("subject", params.id);
  const { data: chapters = [] } = useList("chapter", { filter: { subject_id: params.id } });
  const { data: lessons = [] } = useList("lesson", { filter: { subject_id: params.id } });
  const { data: mistakes = [] } = useList("mistake", { filter: { subject_id: params.id } });
  const { data: exams = [] } = useList("exam", { filter: { subject_id: params.id }, order_by: "date" });
  const createChapter = useCreate("chapter");
  const [editing, setEditing] = useState(false);
  const [newChapter, setNewChapter] = useState("");

  const lessonsBy = useMemo(() => groupBy(lessons, (l) => l.chapter_id), [lessons]);
  const mistakesBy = useMemo(() => groupBy(mistakes.filter((m) => m.lesson_id), (m) => m.lesson_id!), [mistakes]);

  if (!subject) return <PageHeader crumbs={[{ label: isLoading ? "" : "Subject not found" }]} />;

  const done = lessons.filter((l) => l.status === "done" || l.status === "revised").length;
  const openMistakes = mistakes.filter((m) => m.status !== "mastered");
  const upcoming = exams.filter((e) => e.status === "upcoming" && e.date >= today());
  const past = exams.filter((e) => e.status === "done" && e.score != null).slice(-5).reverse();
  const avg = past.length ? Math.round(past.reduce((a, e) => a + (pct(e.score, e.max_score) ?? 0), 0) / past.length) : null;

  const addChapter = async () => {
    if (!newChapter.trim()) return;
    await createChapter.mutateAsync({ subject_id: subject.id, name: newChapter.trim(), position: (chapters.at(-1)?.position ?? -1) + 1 });
    setNewChapter("");
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: subject.name, emoji: subject.icon }]}
        actions={
          <>
            {openMistakes.length > 0 && (
              <Button size="sm" variant="ghost" icon={Brain02Icon} onClick={() => navigate("review", { subject: subject.id })}>
                Review
              </Button>
            )}
            <IconButton icon={Edit02Icon} label="Edit subject" onClick={() => setEditing(true)} />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] px-8 pb-24 pt-6">
          <section className="anim-rise mb-8 flex items-center gap-5">
            <button onClick={() => setEditing(true)} className={cn("grid size-[72px] shrink-0 place-items-center rounded-2xl text-[36px] tint-bg transition-transform hover:scale-105", `tint-${subject.color}`)}>
              {subject.icon}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[36px] font-medium leading-tight tracking-tight" dir="auto">
                {subject.name}
              </h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-base text-fg-3">
                <span>{plural(chapters.length, "chapter")}</span>
                <span>
                  {done}/{plural(lessons.length, "lesson")} done
                </span>
                <span>{plural(openMistakes.length, "open mistake")}</span>
                {avg != null && <span>Avg. score {avg}%</span>}
              </div>
            </div>
            <div className={cn("w-[180px]", `tint-${subject.color}`)}>
              <div className="mb-1.5 flex justify-between text-xs font-medium">
                <span className="text-fg-3">Progress</span>
                <span className="tint-text">{lessons.length ? Math.round((done / lessons.length) * 100) : 0}%</span>
              </div>
              <Progress value={lessons.length ? (done / lessons.length) * 100 : 0} tint={subject.color} className="h-2" />
            </div>
          </section>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 space-y-4 lg:col-span-8">
              {chapters.map((c) => (
                <ChapterCard key={c.id} chapter={c} lessons={lessonsBy[c.id] ?? []} mistakes={mistakesBy} highlight={params.chapter === c.id} />
              ))}
              {chapters.length === 0 && <Empty icon={subject.icon} title="Start with your first chapter" hint="Add the chapters from your syllabus, then the lessons inside each. Every lesson gets a notes page and a mistakes log." />}
              <div className="flex h-11 items-center gap-3 rounded-xl px-4 shadow-[inset_0_0_0_1px_var(--color-stroke)] transition-colors focus-within:bg-surface focus-within:shadow-[inset_0_0_0_1px_var(--color-stroke-strong)]">
                <Icon icon={Add01Icon} size={16} className="text-fg-3" />
                <BareInput placeholder="New chapter…" value={newChapter} onChange={(e) => setNewChapter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChapter()} className="text-base" />
              </div>
            </div>

            <aside className="col-span-12 space-y-4 lg:col-span-4">
              <Card className="anim-rise p-1.5" style={{ animationDelay: "60ms" }}>
                <div className="flex h-9 items-center px-2.5 text-sm font-semibold">Upcoming</div>
                {upcoming.slice(0, 4).map((e) => (
                  <button key={e.id} onClick={() => navigate("exams", { exam: e.id })} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-hover">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base">{e.title}</div>
                      <div className="text-xs text-fg-3">{EXAM_KINDS[e.kind]}{e.scope && ` · ${e.scope}`}</div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-fg-2">{countdown(e.date)}</span>
                  </button>
                ))}
                {upcoming.length === 0 && <div className="px-2.5 pb-3 text-sm text-fg-3">No upcoming quizzes or trials.</div>}
                {past.length > 0 && (
                  <>
                    <div className="mx-2.5 my-1 h-px bg-stroke" />
                    <div className="flex h-8 items-center px-2.5 text-xs font-medium text-fg-3">Recent scores</div>
                    <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
                      {past.map((e) => {
                        const p = pct(e.score, e.max_score) ?? 0;
                        return (
                          <span key={e.id} title={e.title} className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium tabular tint-bg tint-text", p >= 85 ? "tint-mint" : p >= 65 ? "tint-butter" : "tint-rose")}>
                            {p}%
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card>
              <Card className="anim-rise p-1.5" style={{ animationDelay: "90ms" }}>
                <div className="flex h-9 items-center justify-between px-2.5 text-sm font-semibold">
                  Recent mistakes
                  {openMistakes.length > 0 && (
                    <Button size="xs" variant="ghost" onClick={() => navigate("review", { subject: subject.id })}>
                      Review {openMistakes.length}
                    </Button>
                  )}
                </div>
                {mistakes.slice(0, 5).map((m) => (
                  <button key={m.id} onClick={() => goToMistake(m)} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-hover">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full tint-solid", `tint-${KIND_TINT[m.kind]}`)} />
                    <span className="line-clamp-2 text-sm text-fg-2" dir="auto">
                      {m.title || m.question}
                    </span>
                  </button>
                ))}
                {mistakes.length === 0 && <div className="px-2.5 pb-3 text-sm text-fg-3">Nothing logged yet.</div>}
              </Card>
            </aside>
          </div>
        </div>
      </div>
      <SubjectDialog open={editing} onClose={() => setEditing(false)} subject={subject} />
    </>
  );
}
