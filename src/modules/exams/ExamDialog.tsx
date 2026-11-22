import { Calendar03Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";
import { relativeDay } from "@/lib/dates";
import { useCreate } from "@/lib/query";
import type { Exam, ExamKind, Subject } from "@/lib/types";
import { cn, EXAM_KINDS } from "@/lib/utils";
import { Button, Icon, Input, Kbd } from "@/ui/core";
import { DatePicker, Dialog, Segmented, Select } from "@/ui/overlay";
import { parseTime } from "./parts";

const KINDS = (Object.keys(EXAM_KINDS) as ExamKind[]).map((k) => ({ value: k, label: EXAM_KINDS[k] }));

export interface ExamDraft {
  subject_id?: string | null;
  kind?: ExamKind;
  date?: string | null;
}

const field = "mb-1.5 text-xs font-medium text-fg-3";
const box = "h-8 w-full justify-start rounded-lg bg-surface px-2.5 text-base shadow-[inset_0_0_0_1px_var(--color-stroke-strong)] hover:bg-hover";

export function ExamDialog({ open, onClose, onCreated, subjects, exams, defaults }: { open: boolean; onClose: () => void; onCreated: (e: Exam) => void; subjects: Subject[]; exams: Exam[]; defaults: ExamDraft }) {
  const create = useCreate("exam");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ExamKind>("quiz");
  const [subjectId, setSubjectId] = useState<string>("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [scope, setScope] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setKind(defaults.kind ?? "quiz");
    setSubjectId(defaults.subject_id ?? "");
    setDate(defaults.date ?? null);
    setTime("");
    setScope("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const subject = subjects.find((s) => s.id === subjectId);
  const suggestion = useMemo(() => {
    if (!subject) return "";
    const n = exams.filter((e) => e.subject_id === subject.id && e.kind === kind).length;
    return `${subject.name} ${EXAM_KINDS[kind].toLowerCase()} ${n + 1}`;
  }, [subject, kind, exams]);
  const finalTitle = title.trim() || suggestion;
  const parsedTime = time.trim() ? parseTime(time) : null;
  const badTime = !!time.trim() && !parsedTime;
  const ready = !!finalTitle && !!date && !badTime && !create.isPending;

  const submit = async () => {
    if (!ready) return;
    const e = await create.mutateAsync({ title: finalTitle, kind, subject_id: subjectId || null, date: date!, time: parsedTime, scope: scope.trim() || null });
    onCreated(e);
  };

  return (
    <Dialog open={open} onClose={onClose} className="w-[480px]">
      <div
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (e.target as HTMLElement).tagName === "INPUT")) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div className="flex items-center gap-3 px-5 pt-5">
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-[19px] tint-bg transition-colors", `tint-${subject?.color ?? "sand"}`)}>{subject?.icon ?? "🗓️"}</div>
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight">New {EXAM_KINDS[kind].toLowerCase()}</div>
            <div className="text-xs text-fg-3">{date ? `${relativeDay(date)}${parsedTime ? ` at ${parsedTime}` : ""}` : "Pick a date so it shows up in your countdowns"}</div>
          </div>
        </div>
        <div className="space-y-4 px-5 pb-5 pt-4">
          <Input autoFocus placeholder={suggestion || "e.g. Physics trial 4"} value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 text-md" />
          <Segmented value={kind} onChange={setKind} options={KINDS} className="flex w-full [&>button]:flex-1" />
          <div className="grid grid-cols-[1fr_1fr_112px] gap-3">
            <div className="min-w-0">
              <div className={field}>Subject</div>
              <Select
                value={subjectId}
                onChange={setSubjectId}
                placeholder="No subject"
                className={box}
                options={[{ value: "", label: "No subject" }, ...subjects.map((s) => ({ value: s.id, label: s.name, emoji: s.icon }))]}
              />
            </div>
            <div className="min-w-0">
              <div className={field}>Date</div>
              <DatePicker value={date} onChange={setDate} allowClear={false} className={box}>
                <Icon icon={Calendar03Icon} size={14} className="text-fg-3" />
                {date ? <span className="truncate">{relativeDay(date)}</span> : <span className="text-fg-4">Pick a date</span>}
              </DatePicker>
            </div>
            <div>
              <div className={field}>Time</div>
              <label className={cn(box, "flex items-center gap-1.5", badTime && "shadow-[inset_0_0_0_1px_var(--color-danger)]")}>
                <Icon icon={Clock01Icon} size={14} className="text-fg-3" />
                <input
                  placeholder="HH:MM"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  onBlur={() => parsedTime && setTime(parsedTime)}
                  className="w-full min-w-0 bg-transparent text-base tabular outline-none placeholder:text-fg-4"
                />
              </label>
            </div>
          </div>
          <div>
            <div className={field}>Scope</div>
            <Input placeholder="What's included — chapters, lessons, pages…" value={scope} onChange={(e) => setScope(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="flex items-center gap-1 text-xs text-fg-4">
              <Kbd>Ctrl</Kbd>
              <Kbd>Enter</Kbd>
              <span className="ml-1">to create</span>
            </span>
            <div className="flex-1" />
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="solid" onClick={submit} disabled={!ready}>
              Create
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
