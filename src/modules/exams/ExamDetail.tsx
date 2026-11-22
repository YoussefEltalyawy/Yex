import {
  Add01Icon,
  Alert02Icon,
  Calendar03Icon,
  Cancel01Icon,
  Clock01Icon,
  Delete02Icon,
  Flag02Icon,
  MoreHorizontalIcon,
  Note01Icon,
  Notification03Icon,
  StarIcon,
  Target02Icon,
  Task01Icon,
  BookOpen01Icon,
} from "@hugeicons/core-free-icons";
import { type ReactNode, useEffect, useState } from "react";
import { fmtMonthDay, relativeDay, timeAgo } from "@/lib/dates";
import { useList, useRemove, useUpdate } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Exam, ExamKind, ExamStatus, Subject } from "@/lib/types";
import { cn, EXAM_KINDS, MISTAKE_KINDS, pct } from "@/lib/utils";
import { Button, Icon, IconButton, type IconType } from "@/ui/core";
import { Check, DatePicker, Menu, Select, usePopover } from "@/ui/overlay";
import { RichEditor } from "@/ui/RichEditor";
import { CountdownPill, DateTile, DraftInput, fmtNum, needsScore, parseNum, parseTime, scoreTint, STATUS_LABEL, StatusBadge, Switch, usePrepare } from "./parts";

const STATUS_TINT: Record<ExamStatus, string> = { upcoming: "sky", done: "mint", missed: "rose", cancelled: "sand" };

function Prop({ icon, label, children }: { icon: IconType; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2">
      <div className="flex w-[92px] shrink-0 items-center gap-2 text-sm text-fg-3">
        <Icon icon={icon} size={14} className="text-fg-4" />
        {label}
      </div>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string; icon: IconType; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-stroke px-5 py-4">
      <div className="mb-2 flex h-6 items-center gap-2 text-xs font-medium text-fg-3">
        <Icon icon={icon} size={13} />
        <span className="flex-1">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function ScoreEditor({ exam }: { exam: Exam }) {
  const update = useUpdate("exam");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("");
  useEffect(() => {
    setScore(exam.score != null ? fmtNum(exam.score) : "");
    setMax(exam.max_score != null ? fmtNum(exam.max_score) : "");
  }, [exam.score, exam.max_score]);
  const s = parseNum(score);
  const m = parseNum(max);
  const p = pct(s, m);
  const commit = () => {
    if (s === exam.score && m === exam.max_score) return;
    update.mutate({ id: exam.id, patch: { score: s, max_score: m } });
  };
  const input =
    "h-9 w-full min-w-0 rounded-lg bg-surface text-center font-display text-[19px] tabular outline-none shadow-[inset_0_0_0_1px_var(--color-stroke-strong)] transition-shadow placeholder:font-sans placeholder:text-sm placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-soft)]";
  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && e.currentTarget.blur();
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-[168px] shrink-0 items-center gap-1.5">
        <input inputMode="decimal" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} onBlur={commit} onKeyDown={keys} className={input} />
        <span className="font-display text-lg text-fg-4">/</span>
        <input inputMode="decimal" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} onBlur={commit} onKeyDown={keys} className={input} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-right font-display text-[26px] font-medium leading-none tabular transition-colors", p == null ? "text-fg-4" : `tint-${scoreTint(p)} tint-text`)}>{p == null ? "—" : `${p}%`}</div>
        <div className={cn("mt-1.5 h-1 overflow-hidden rounded-full bg-hover", p != null && `tint-${scoreTint(p)}`)}>
          <div className="h-full rounded-full tint-solid transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, p ?? 0)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ExamDetail({ exam, subjects, onClose }: { exam: Exam; subjects: Subject[]; onClose: () => void }) {
  const update = useUpdate("exam");
  const updateTask = useUpdate("task");
  const remove = useRemove("exam", "Exam");
  const prepare = usePrepare();
  const menu = usePopover();
  const { data: chapters = [] } = useList("chapter", { filter: { subject_id: exam.subject_id } }, !!exam.subject_id);
  const { data: mistakes = [] } = useList("mistake", { filter: { exam_id: exam.id } });
  const { data: tasks = [] } = useList("task", { filter: { exam_id: exam.id }, order_by: "done, due_date" });
  const subject = subjects.find((s) => s.id === exam.subject_id);
  const patch = (p: Partial<Exam>) => update.mutate({ id: exam.id, patch: p });
  const scored = exam.status !== "upcoming" || exam.score != null || needsScore(exam);

  return (
    <aside className="anim-sheet flex w-[400px] shrink-0 flex-col border-l border-stroke bg-surface">
      <div className="flex h-11 shrink-0 items-center gap-1 pl-5 pr-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg-3">
          {subject ? (
            <span className={cn("flex items-center gap-1.5 truncate tint-text", `tint-${subject.color}`)}>
              <span className="text-xs">{subject.icon}</span>
              {subject.name}
            </span>
          ) : (
            "No subject"
          )}
          <span className="text-fg-4">/</span>
          {EXAM_KINDS[exam.kind]}
        </span>
        <div className="flex-1" />
        <IconButton ref={menu.ref} icon={MoreHorizontalIcon} label="More" onClick={menu.toggle} />
        <IconButton icon={Cancel01Icon} label="Close (Esc)" onClick={onClose} />
        <Menu
          open={menu.open}
          onClose={menu.close}
          anchor={menu.ref}
          align="end"
          items={[
            { label: "Add prep task", icon: Target02Icon, onSelect: () => prepare(exam) },
            { label: "Mark as missed", icon: Alert02Icon, onSelect: () => patch({ status: "missed" }), disabled: exam.status === "missed" },
            { label: "Mark as cancelled", icon: Cancel01Icon, onSelect: () => patch({ status: "cancelled" }), disabled: exam.status === "cancelled" },
            { separator: true, label: "" },
            {
              label: "Delete",
              icon: Delete02Icon,
              danger: true,
              onSelect: () => {
                remove.mutate(exam.id);
                onClose();
              },
            },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pb-4 pt-2">
          <div className="flex items-start gap-3.5">
            <DateTile date={exam.date} color={subject?.color} large muted={exam.status === "cancelled"} />
            <div className="min-w-0 flex-1 pt-0.5">
              <DraftInput
                value={exam.title}
                normalize={(v) => v.trim() || null}
                onCommit={(title) => patch({ title })}
                placeholder="Untitled"
                className="font-display text-[22px] font-medium leading-tight tracking-tight"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {exam.status === "upcoming" && !needsScore(exam) && <CountdownPill date={exam.date} className="-ml-1.5" />}
                {needsScore(exam) && <span className="text-xs font-medium text-[var(--butter-fg)]">Needs a score</span>}
                {exam.status === "done" && <span className="text-xs font-medium text-fg-3">Done · {relativeDay(exam.date)}</span>}
                <StatusBadge status={exam.status} />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-0.5 [&_.prop-btn]:-ml-2">
            <Prop icon={Flag02Icon} label="Kind">
              <Select<ExamKind>
                value={exam.kind}
                onChange={(kind) => patch({ kind })}
                className="prop-btn"
                options={(Object.keys(EXAM_KINDS) as ExamKind[]).map((k) => ({ value: k, label: EXAM_KINDS[k] }))}
              />
            </Prop>
            <Prop icon={BookOpen01Icon} label="Subject">
              <Select
                value={exam.subject_id ?? ""}
                onChange={(v) => patch({ subject_id: v || null, chapter_id: null })}
                className="prop-btn"
                placeholder="No subject"
                options={[{ value: "", label: "No subject" }, ...subjects.map((s) => ({ value: s.id, label: s.name, emoji: s.icon }))]}
              />
            </Prop>
            <Prop icon={Task01Icon} label="Chapter">
              {exam.subject_id ? (
                <Select
                  value={exam.chapter_id ?? ""}
                  onChange={(v) => patch({ chapter_id: v || null })}
                  className="prop-btn"
                  placeholder="Any chapter"
                  options={[{ value: "", label: "Any chapter" }, ...chapters.map((c) => ({ value: c.id, label: c.name }))]}
                />
              ) : (
                <span className="text-sm text-fg-4">Pick a subject first</span>
              )}
            </Prop>
            <Prop icon={Calendar03Icon} label="Date">
              <DatePicker value={exam.date} onChange={(d) => d && patch({ date: d })} allowClear={false} className="prop-btn">
                {relativeDay(exam.date)}
                {!/\d/.test(relativeDay(exam.date)) && <span className="text-fg-3">· {fmtMonthDay(exam.date)}</span>}
              </DatePicker>
            </Prop>
            <Prop icon={Clock01Icon} label="Time">
              <DraftInput
                value={exam.time ?? ""}
                normalize={(v) => (v.trim() ? parseTime(v) : "")}
                onCommit={(v) => patch({ time: v || null })}
                placeholder="Add time"
                className="-ml-2 h-7 w-auto max-w-[140px] rounded-md px-2 text-sm tabular transition-colors hover:bg-hover focus:bg-hover"
              />
            </Prop>
            <Prop icon={Note01Icon} label="Scope">
              <DraftInput value={exam.scope ?? ""} normalize={(v) => v.trim()}
                onCommit={(v) => patch({ scope: v || null })} placeholder="What's included…" className="h-7 rounded-md px-0 text-sm" />
            </Prop>
            <Prop icon={Alert02Icon} label="Status">
              <Select<ExamStatus>
                value={exam.status}
                onChange={(status) => patch({ status })}
                className="prop-btn"
                options={(Object.keys(STATUS_LABEL) as ExamStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s], tint: STATUS_TINT[s] }))}
              />
            </Prop>
            <Prop icon={Notification03Icon} label="Remind me">
              <Switch checked={exam.remind} onChange={(remind) => patch({ remind })} label="Remind me" />
            </Prop>
          </div>
        </div>

        {scored && (
          <Section title="Score" icon={StarIcon}>
            <ScoreEditor exam={exam} />
          </Section>
        )}

        <Section title="Notes" icon={Note01Icon}>
          <RichEditor key={exam.id} value={exam.notes} onChange={(notes) => patch({ notes: notes || null })} placeholder="Reflection, topics to revise, what went well…" compact className="min-h-[60px]" />
        </Section>

        {(tasks.length > 0 || exam.status === "upcoming") && (
          <Section
            title={tasks.length ? `Prep tasks · ${tasks.filter((t) => t.done).length}/${tasks.length}` : "Prep tasks"}
            icon={Target02Icon}
            action={<IconButton icon={Add01Icon} label="Add prep task" size="xs" onClick={() => prepare(exam)} />}
          >
            {tasks.length ? (
              <div className="-mx-2">
                {tasks.map((t) => (
                  <div key={t.id} onClick={() => navigate("tasks", { task: t.id })} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-hover">
                    <Check checked={t.done} priority={t.priority} size={16} onChange={(done) => updateTask.mutate({ id: t.id, patch: { done } })} />
                    <span className={cn("min-w-0 flex-1 truncate text-sm", t.done && "text-fg-3 line-through decoration-fg-4")} dir="auto">
                      {t.title}
                    </span>
                    {t.due_date && <span className="shrink-0 text-xs text-fg-4">{relativeDay(t.due_date)}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <button onClick={() => prepare(exam)} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-fg-3 shadow-[inset_0_0_0_1px_var(--color-stroke)] transition-colors hover:bg-hover hover:text-fg-2">
                Plan a revision session for the day before →
              </button>
            )}
          </Section>
        )}

        <Section title={mistakes.length ? `Mistakes · ${mistakes.length}` : "Mistakes"} icon={Alert02Icon}>
          {mistakes.length ? (
            <div className="-mx-2">
              {mistakes.map((m) => (
                <button
                  key={m.id}
                  disabled={!m.lesson_id}
                  onClick={() => m.lesson_id && navigate("lesson", { id: m.lesson_id, tab: "mistakes" })}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover"
                >
                  <span className={cn("mt-[5px] size-1.5 shrink-0 rounded-full", m.status === "mastered" ? "bg-[var(--mint)]" : m.status === "reviewing" ? "bg-[var(--butter)]" : "bg-[var(--rose)]")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm" dir="auto">
                      {m.title || m.question.split("\n")[0]}
                    </span>
                    {m.title && (
                      <span className="block truncate text-xs text-fg-3" dir="auto">
                        {m.question.split("\n")[0]}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 pt-px text-xs text-fg-4">{MISTAKE_KINDS[m.kind]}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-fg-4">No mistakes linked yet. When you log one from a lesson, link it to this exam to see it here.</p>
          )}
        </Section>
      </div>

      <div className="flex h-11 shrink-0 items-center border-t border-stroke pl-5 pr-2.5 text-xs text-fg-4">
        <span className="flex-1">Created {timeAgo(exam.created_at)}</span>
        <Button
          variant="danger"
          size="sm"
          icon={Delete02Icon}
          onClick={() => {
            remove.mutate(exam.id);
            onClose();
          }}
        >
          Delete
        </Button>
      </div>
    </aside>
  );
}
