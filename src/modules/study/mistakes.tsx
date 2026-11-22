import { Delete02Icon, Edit02Icon, MoreHorizontalIcon, Tick02Icon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { relativeDay, timeAgo } from "@/lib/dates";
import { useCreate, useList, useRemove, useUpdate } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Id, Mistake, MistakeKind } from "@/lib/types";
import { cn, MISTAKE_KINDS } from "@/lib/utils";
import { Button, Icon, IconButton, Input } from "@/ui/core";
import { Markdown } from "@/ui/Markdown";
import { Dialog, Menu, Select, usePopover } from "@/ui/overlay";
import { RichEditor } from "@/ui/RichEditor";

export const KIND_TINT: Record<string, string> = { concept: "lilac", careless: "peach", calculation: "sky", misread: "butter", memory: "teal", time: "rose", other: "sand" };
export const STATUS_META: Record<string, { label: string; tint: string }> = {
  open: { label: "New", tint: "rose" },
  reviewing: { label: "Reviewing", tint: "butter" },
  mastered: { label: "Mastered", tint: "mint" },
};

function AnswerBox({ label, tint, children }: { label: string; tint: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg px-3.5 py-2.5 tint-bg", `tint-${tint}`)}>
      <div className="mb-0.5 text-2xs font-semibold uppercase tracking-wider tint-text">{label}</div>
      {children}
    </div>
  );
}

export function MistakeCard({ m, context, highlight }: { m: Mistake; context?: string; highlight?: boolean }) {
  const [open, setOpen] = useState(!!highlight);
  const [editing, setEditing] = useState(false);
  const menu = usePopover();
  const update = useUpdate("mistake");
  const remove = useRemove("mistake", "Mistake");
  const hasAnswer = m.correct_answer || m.my_answer || m.explanation;
  const st = STATUS_META[m.status];

  return (
    <article
      id={`m-${m.id}`}
      className={cn("group rounded-xl bg-surface shadow-card transition-shadow", highlight && "ring-2 ring-accent/40")}
      onDoubleClick={() => setEditing(true)}
    >
      <div className="flex items-center gap-1.5 px-4 pt-3">
        <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium tint-bg tint-text", `tint-${KIND_TINT[m.kind]}`)}>{MISTAKE_KINDS[m.kind]}</span>
        <span className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-fg-2")}>
          <span className={cn("size-1.5 rounded-full tint-solid", `tint-${st.tint}`)} />
          {st.label}
        </span>
        {context && <span className="truncate text-xs text-fg-3">{context}</span>}
        <div className="flex-1" />
        {m.status !== "mastered" && m.next_review_at && <span className="text-xs text-fg-4">Review {relativeDay(m.next_review_at).toLowerCase()}</span>}
        <IconButton ref={menu.ref} icon={MoreHorizontalIcon} label="More" size="xs" className="opacity-0 group-hover:opacity-100" onClick={menu.toggle} />
        <Menu
          open={menu.open}
          onClose={menu.close}
          anchor={menu.ref}
          align="end"
          items={[
            { label: "Edit", icon: Edit02Icon, onSelect: () => setEditing(true) },
            m.status === "mastered"
              ? { label: "Mark as reviewing", icon: ViewIcon, onSelect: () => update.mutate({ id: m.id, patch: { status: "reviewing" } }) }
              : { label: "Mark as mastered", icon: Tick02Icon, onSelect: () => update.mutate({ id: m.id, patch: { status: "mastered" } }) },
            { separator: true, label: "" },
            { label: "Delete", icon: Delete02Icon, danger: true, onSelect: () => remove.mutate(m.id) },
          ]}
        />
      </div>
      <div className="px-4 pb-3 pt-2">
        {m.title && (
          <div className="mb-1 text-md font-semibold" dir="auto">
            {m.title}
          </div>
        )}
        <Markdown source={m.question} className="text-fg" />
        {hasAnswer && (
          <button onClick={() => setOpen((o) => !o)} className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-md px-2 -ml-2 text-sm font-medium text-fg-3 transition-colors hover:bg-hover hover:text-fg">
            <Icon icon={open ? ViewOffIcon : ViewIcon} size={14} />
            {open ? "Hide answer" : "Show answer"}
          </button>
        )}
        {open && hasAnswer && (
          <div className="anim-fade mt-2 space-y-2">
            {m.my_answer && (
              <AnswerBox label="My answer" tint="rose">
                <Markdown source={m.my_answer} />
              </AnswerBox>
            )}
            {m.correct_answer && (
              <AnswerBox label="Correct answer" tint="mint">
                <Markdown source={m.correct_answer} />
              </AnswerBox>
            )}
            {m.explanation && (
              <div className="rounded-lg px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--color-stroke)]">
                <div className="mb-0.5 text-2xs font-semibold uppercase tracking-wider text-fg-3">Key idea</div>
                <Markdown source={m.explanation} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-stroke px-4 py-2 text-xs text-fg-4">
        {m.source && <span>{m.source}</span>}
        <span>Added {timeAgo(m.created_at)}</span>
        {m.review_count > 0 && <span>Reviewed {m.review_count}×</span>}
      </div>
      <MistakeEditor open={editing} onClose={() => setEditing(false)} mistake={m} />
    </article>
  );
}

function EditorField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-fg-3">{label}</span>
        {hint && <span className="text-2xs text-fg-4">{hint}</span>}
      </div>
      <div className="rounded-lg bg-surface-2 px-3 py-2 shadow-[inset_0_0_0_1px_var(--color-stroke)] focus-within:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-soft)]">{children}</div>
    </div>
  );
}

type Draft = Pick<Mistake, "title" | "question" | "my_answer" | "correct_answer" | "explanation" | "kind" | "source" | "exam_id" | "lesson_id">;

export function MistakeEditor({ open, onClose, mistake, lessonId }: { open: boolean; onClose: () => void; mistake?: Mistake; lessonId?: Id }) {
  const empty: Draft = { title: "", question: "", my_answer: "", correct_answer: "", explanation: "", kind: "concept", source: "", exam_id: null, lesson_id: lessonId ?? null };
  const [d, setD] = useState<Draft>(empty);
  const [nonce, setNonce] = useState(0);
  const create = useCreate("mistake");
  const update = useUpdate("mistake");
  const { data: exams = [] } = useList("exam", { order_by: "-date", limit: 40 }, open);

  useEffect(() => {
    if (!open) return;
    setD(mistake ? { title: mistake.title, question: mistake.question, my_answer: mistake.my_answer, correct_answer: mistake.correct_answer, explanation: mistake.explanation, kind: mistake.kind, source: mistake.source, exam_id: mistake.exam_id, lesson_id: mistake.lesson_id } : empty);
    setNonce((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mistake?.id]);

  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);
  const save = async (another = false) => {
    if (!d.question?.trim()) return;
    const data = { ...d, title: clean(d.title), my_answer: clean(d.my_answer), correct_answer: clean(d.correct_answer), explanation: clean(d.explanation), source: clean(d.source) };
    if (mistake) await update.mutateAsync({ id: mistake.id, patch: data });
    else await create.mutateAsync(data);
    if (another) {
      setD({ ...empty, kind: d.kind, source: d.source, exam_id: d.exam_id });
      setNonce((n) => n + 1);
    } else onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={mistake ? "Edit mistake" : "Log a mistake"} className="w-[680px]">
      <div key={nonce} className="max-h-[70vh] space-y-3.5 overflow-y-auto px-5 pb-2 pt-3">
        <Input placeholder="Short label (optional) — e.g. “sin 3x / x limit”" value={d.title ?? ""} onChange={(e) => set("title")(e.target.value)} />
        <EditorField label="Question" hint="Paste a screenshot or type it">
          <RichEditor value={d.question} onChange={set("question")} placeholder="The question you got wrong…" compact debounce={0} autofocus={!mistake} onSubmit={() => save()} className="min-h-[60px]" />
        </EditorField>
        <div className="grid grid-cols-2 gap-3">
          <EditorField label="My answer">
            <RichEditor value={d.my_answer} onChange={set("my_answer")} placeholder="What I wrote" compact debounce={0} onSubmit={() => save()} />
          </EditorField>
          <EditorField label="Correct answer">
            <RichEditor value={d.correct_answer} onChange={set("correct_answer")} placeholder="The right answer" compact debounce={0} onSubmit={() => save()} />
          </EditorField>
        </div>
        <EditorField label="Key idea / explanation">
          <RichEditor value={d.explanation} onChange={set("explanation")} placeholder="Why it's right, the trick to remember…" compact debounce={0} onSubmit={() => save()} />
        </EditorField>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <span className="text-xs font-medium text-fg-3">Type</span>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(MISTAKE_KINDS) as MistakeKind[]).map((k) => (
              <button
                key={k}
                onClick={() => set("kind")(k)}
                className={cn("h-6 rounded-md px-2 text-xs font-medium transition-colors", d.kind === k ? cn("tint-bg tint-text", `tint-${KIND_TINT[k]}`) : "text-fg-3 hover:bg-hover")}
              >
                {MISTAKE_KINDS[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pb-1">
          <Input placeholder="Source (book, teacher, trial…)" value={d.source ?? ""} onChange={(e) => set("source")(e.target.value)} className="flex-1" />
          <Select
            value={d.exam_id ?? "none"}
            className="h-8 shadow-[inset_0_0_0_1px_var(--color-stroke-strong)]"
            options={[{ value: "none", label: "Not from an exam" }, ...exams.map((e) => ({ value: e.id, label: e.title }))]}
            onChange={(v) => set("exam_id")(v === "none" ? null : v)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-stroke px-5 py-3">
        <span className="flex-1 text-xs text-fg-4">Ctrl+Enter to save</span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {!mistake && (
          <Button variant="outline" onClick={() => save(true)} disabled={!d.question?.trim()}>
            Save & add another
          </Button>
        )}
        <Button variant="solid" onClick={() => save()} disabled={!d.question?.trim()}>
          {mistake ? "Save" : "Add mistake"}
        </Button>
      </div>
    </Dialog>
  );
}

export function goToMistake(m: Mistake) {
  if (m.lesson_id) navigate("lesson", { id: m.lesson_id, tab: "mistakes", focus: m.id });
}
